package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
)

// --- Request / Response types ---

type CreateForkRequest struct {
	ForkAtStep     int    `json:"fork_at_step"`
	ModifiedOutput string `json:"modified_output"`
}

type TaskForkResponse struct {
	ID            string  `json:"id"`
	WorkspaceID   string  `json:"workspace_id"`
	SourceTaskID  string  `json:"source_task_id"`
	ForkedTaskID  *string `json:"forked_task_id"`
	ForkAtStep    int32   `json:"fork_at_step"`
	ModifiedOutput *string `json:"modified_output"`
	Status        string  `json:"status"`
	CreatedBy     string  `json:"created_by"`
	CreatedAt     string  `json:"created_at"`
}

type TimelineStep struct {
	Step    int    `json:"step"`
	Role    string `json:"role"`
	Content string `json:"content"`
	Time    string `json:"time"`
}

func taskForkToResponse(f db.TaskFork) TaskForkResponse {
	resp := TaskForkResponse{
		ID:           uuidToString(f.ID),
		WorkspaceID:  uuidToString(f.WorkspaceID),
		SourceTaskID: uuidToString(f.SourceTaskID),
		ForkedTaskID: uuidToPtr(f.ForkedTaskID),
		ForkAtStep:   f.ForkAtStep,
		Status:       f.Status,
		CreatedBy:    uuidToString(f.CreatedBy),
		CreatedAt:    timestampToString(f.CreatedAt),
	}
	if f.ModifiedOutput.Valid {
		resp.ModifiedOutput = &f.ModifiedOutput.String
	}
	return resp
}

// --- Handlers ---

// GetDebugTimeline returns task messages as ordered steps for a given issue.
func (h *Handler) GetDebugTimeline(w http.ResponseWriter, r *http.Request) {
	workspaceID := resolveWorkspaceID(r)
	issueID := chi.URLParam(r, "issueId")

	// Find the latest task for this issue
	tasks, err := h.Queries.ListTasksByIssue(r.Context(), parseUUID(issueID))
	if err != nil || len(tasks) == 0 {
		writeJSON(w, http.StatusOK, map[string]any{
			"steps": []TimelineStep{},
			"forks": []TaskForkResponse{},
		})
		return
	}

	task := tasks[0]

	// Get messages
	messages, err := h.Queries.ListTaskMessages(r.Context(), task.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load messages")
		return
	}

	steps := make([]TimelineStep, len(messages))
	for i, msg := range messages {
		content := ""
		if msg.Content.Valid {
			content = msg.Content.String
		}
		steps[i] = TimelineStep{
			Step:    i + 1,
			Role:    msg.Type,
			Content: content,
			Time:    timestampToString(msg.CreatedAt),
		}
	}

	// Get forks for this task
	forks, err := h.Queries.ListForksBySource(r.Context(), task.ID)
	if err != nil {
		forks = nil
	}

	forkItems := make([]TaskForkResponse, len(forks))
	for i, f := range forks {
		forkItems[i] = taskForkToResponse(f)
	}

	_ = workspaceID // used for auth middleware

	writeJSON(w, http.StatusOK, map[string]any{
		"steps":   steps,
		"forks":   forkItems,
		"task_id": uuidToString(task.ID),
	})
}

// CreateFork creates a new task fork from a specific step.
func (h *Handler) CreateFork(w http.ResponseWriter, r *http.Request) {
	workspaceID := resolveWorkspaceID(r)
	issueID := chi.URLParam(r, "issueId")

	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	var req CreateForkRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.ForkAtStep < 1 {
		writeError(w, http.StatusBadRequest, "fork_at_step must be >= 1")
		return
	}

	// Find the latest task for this issue
	tasks, err := h.Queries.ListTasksByIssue(r.Context(), parseUUID(issueID))
	if err != nil || len(tasks) == 0 {
		writeError(w, http.StatusNotFound, "no task found for issue")
		return
	}

	task := tasks[0]

	params := db.CreateTaskForkParams{
		WorkspaceID:  parseUUID(workspaceID),
		SourceTaskID: task.ID,
		ForkAtStep:   int32(req.ForkAtStep),
		CreatedBy:    parseUUID(userID),
	}
	if req.ModifiedOutput != "" {
		params.ModifiedOutput = ptrToText(&req.ModifiedOutput)
	}

	fork, err := h.Queries.CreateTaskFork(r.Context(), params)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create fork")
		return
	}

	writeJSON(w, http.StatusCreated, taskForkToResponse(fork))
}

// ListForks lists all forks in the workspace.
func (h *Handler) ListForks(w http.ResponseWriter, r *http.Request) {
	workspaceID := resolveWorkspaceID(r)
	if workspaceID == "" {
		writeError(w, http.StatusBadRequest, "workspace_id is required")
		return
	}

	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))

	forks, err := h.Queries.ListForksByWorkspace(r.Context(), db.ListForksByWorkspaceParams{
		WorkspaceID: parseUUID(workspaceID),
		Limit:       int32(limit),
		Offset:      int32(offset),
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list forks")
		return
	}

	total, _ := h.Queries.CountForksByWorkspace(r.Context(), parseUUID(workspaceID))

	items := make([]TaskForkResponse, len(forks))
	for i, f := range forks {
		items[i] = taskForkToResponse(f)
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"items": items,
		"total": total,
	})
}
