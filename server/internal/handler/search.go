package handler

import (
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"sync"

	"github.com/jackc/pgx/v5/pgtype"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
)

// --- Unified Search Response Types ---

type UnifiedSearchIssue struct {
	ID         string `json:"id"`
	Identifier string `json:"identifier"`
	Title      string `json:"title"`
	Status     string `json:"status"`
	Priority   string `json:"priority"`
}

type UnifiedSearchProject struct {
	ID     string  `json:"id"`
	Name   string  `json:"name"`
	Icon   *string `json:"icon,omitempty"`
	Status string  `json:"status"`
}

type UnifiedSearchGoal struct {
	ID          string  `json:"id"`
	Title       string  `json:"title"`
	Description *string `json:"description,omitempty"`
}

type UnifiedSearchBrainDump struct {
	ID        string `json:"id"`
	Content   string `json:"content"`
	Processed bool   `json:"processed"`
	CreatedAt string `json:"created_at"`
}

type UnifiedSearchAgent struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	RuntimeMode string `json:"runtime_mode"`
}

type UnifiedSearchChat struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	UpdatedAt string `json:"updated_at"`
}

type UnifiedSearchResponse struct {
	Issues     []UnifiedSearchIssue     `json:"issues,omitempty"`
	Projects   []UnifiedSearchProject   `json:"projects,omitempty"`
	Goals      []UnifiedSearchGoal      `json:"goals,omitempty"`
	BrainDumps []UnifiedSearchBrainDump `json:"brain_dumps,omitempty"`
	Agents     []UnifiedSearchAgent     `json:"agents,omitempty"`
	Chats      []UnifiedSearchChat      `json:"chats,omitempty"`
}

// UnifiedSearch handles GET /api/search?q=...&types=...&limit=...
func (h *Handler) UnifiedSearch(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	workspaceID := resolveWorkspaceID(r)

	q := r.URL.Query().Get("q")
	if q == "" {
		writeError(w, http.StatusBadRequest, "q parameter is required")
		return
	}

	limit := int32(5)
	if l := r.URL.Query().Get("limit"); l != "" {
		if v, err := strconv.Atoi(l); err == nil && v > 0 && v <= 20 {
			limit = int32(v)
		}
	}

	// Parse which types to search (default: all)
	typesParam := r.URL.Query().Get("types")
	searchTypes := map[string]bool{
		"issues":     true,
		"projects":   true,
		"goals":      true,
		"brain_dumps": true,
		"agents":     true,
		"chats":      true,
	}
	if typesParam != "" {
		// Reset all to false, only enable requested
		for k := range searchTypes {
			searchTypes[k] = false
		}
		for _, t := range strings.Split(typesParam, ",") {
			t = strings.TrimSpace(t)
			if _, ok := searchTypes[t]; ok {
				searchTypes[t] = true
			}
		}
	}

	wsUUID := parseUUID(workspaceID)
	searchText := pgtype.Text{String: q, Valid: true}

	var resp UnifiedSearchResponse
	var mu sync.Mutex
	var wg sync.WaitGroup

	// Search issues
	if searchTypes["issues"] {
		wg.Add(1)
		go func() {
			defer wg.Done()
			issues, err := h.Queries.QuickSearchIssues(ctx, db.QuickSearchIssuesParams{
				WorkspaceID: wsUUID,
				Column2:     searchText,
				Limit:       limit,
			})
			if err != nil {
				slog.Warn("unified search: issues failed", "error", err)
				return
			}
			prefix := h.getIssuePrefix(ctx, wsUUID)
			results := make([]UnifiedSearchIssue, len(issues))
			for i, iss := range issues {
				results[i] = UnifiedSearchIssue{
					ID:         uuidToString(iss.ID),
					Identifier: fmt.Sprintf("%s-%d", prefix, iss.Number),
					Title:      iss.Title,
					Status:     iss.Status,
					Priority:   iss.Priority,
				}
			}
			mu.Lock()
			resp.Issues = results
			mu.Unlock()
		}()
	}

	// Search projects
	if searchTypes["projects"] {
		wg.Add(1)
		go func() {
			defer wg.Done()
			projects, err := h.Queries.QuickSearchProjects(ctx, db.QuickSearchProjectsParams{
				WorkspaceID: wsUUID,
				Column2:     searchText,
				Limit:       limit,
			})
			if err != nil {
				slog.Warn("unified search: projects failed", "error", err)
				return
			}
			results := make([]UnifiedSearchProject, len(projects))
			for i, p := range projects {
				results[i] = UnifiedSearchProject{
					ID:     uuidToString(p.ID),
					Name:   p.Title,
					Icon:   textToPtr(p.Icon),
					Status: p.Status,
				}
			}
			mu.Lock()
			resp.Projects = results
			mu.Unlock()
		}()
	}

	// Search goals
	if searchTypes["goals"] {
		wg.Add(1)
		go func() {
			defer wg.Done()
			goals, err := h.Queries.SearchGoals(ctx, db.SearchGoalsParams{
				WorkspaceID: wsUUID,
				Column2:     searchText,
				Limit:       limit,
			})
			if err != nil {
				slog.Warn("unified search: goals failed", "error", err)
				return
			}
			results := make([]UnifiedSearchGoal, len(goals))
			for i, g := range goals {
				results[i] = UnifiedSearchGoal{
					ID:          uuidToString(g.ID),
					Title:       g.Title,
					Description: textToPtr(g.Description),
				}
			}
			mu.Lock()
			resp.Goals = results
			mu.Unlock()
		}()
	}

	// Search brain dumps
	if searchTypes["brain_dumps"] {
		wg.Add(1)
		go func() {
			defer wg.Done()
			dumps, err := h.Queries.SearchBrainDumps(ctx, db.SearchBrainDumpsParams{
				WorkspaceID: wsUUID,
				Column2:     searchText,
				Limit:       limit,
			})
			if err != nil {
				slog.Warn("unified search: brain_dumps failed", "error", err)
				return
			}
			results := make([]UnifiedSearchBrainDump, len(dumps))
			for i, d := range dumps {
				// Truncate content for search results
				content := d.Content
				if len(content) > 200 {
					content = content[:200] + "..."
				}
				results[i] = UnifiedSearchBrainDump{
					ID:        uuidToString(d.ID),
					Content:   content,
					Processed: d.Processed,
					CreatedAt: timestampToString(d.CreatedAt),
				}
			}
			mu.Lock()
			resp.BrainDumps = results
			mu.Unlock()
		}()
	}

	// Search agents
	if searchTypes["agents"] {
		wg.Add(1)
		go func() {
			defer wg.Done()
			agents, err := h.Queries.SearchAgents(ctx, db.SearchAgentsParams{
				WorkspaceID: wsUUID,
				Column2:     searchText,
				Limit:       limit,
			})
			if err != nil {
				slog.Warn("unified search: agents failed", "error", err)
				return
			}
			results := make([]UnifiedSearchAgent, len(agents))
			for i, a := range agents {
				results[i] = UnifiedSearchAgent{
					ID:          uuidToString(a.ID),
					Name:        a.Name,
					RuntimeMode: a.RuntimeMode,
				}
			}
			mu.Lock()
			resp.Agents = results
			mu.Unlock()
		}()
	}

	// Search chats
	if searchTypes["chats"] {
		wg.Add(1)
		go func() {
			defer wg.Done()
			chats, err := h.Queries.SearchChatSessions(ctx, db.SearchChatSessionsParams{
				WorkspaceID: wsUUID,
				Column2:     searchText,
				Limit:       limit,
			})
			if err != nil {
				slog.Warn("unified search: chats failed", "error", err)
				return
			}
			results := make([]UnifiedSearchChat, len(chats))
			for i, c := range chats {
				results[i] = UnifiedSearchChat{
					ID:        uuidToString(c.ID),
					Title:     c.Title,
					UpdatedAt: timestampToString(c.UpdatedAt),
				}
			}
			mu.Lock()
			resp.Chats = results
			mu.Unlock()
		}()
	}

	wg.Wait()
	writeJSON(w, http.StatusOK, resp)
}
