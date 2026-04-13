package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
)

// BrainDumpResponse is the JSON response for a brain dump entry.
type BrainDumpResponse struct {
	ID               string  `json:"id"`
	WorkspaceID      string  `json:"workspace_id"`
	Content          string  `json:"content"`
	Processed        bool    `json:"processed"`
	ConvertedIssueID *string `json:"converted_issue_id"`
	CreatedBy        string  `json:"created_by"`
	CreatedAt        string  `json:"created_at"`
	UpdatedAt        string  `json:"updated_at"`
}

func brainDumpToResponse(d db.BrainDump) BrainDumpResponse {
	return BrainDumpResponse{
		ID:               uuidToString(d.ID),
		WorkspaceID:      uuidToString(d.WorkspaceID),
		Content:          d.Content,
		Processed:        d.Processed,
		ConvertedIssueID: uuidToPtr(d.ConvertedIssueID),
		CreatedBy:        uuidToString(d.CreatedBy),
		CreatedAt:        timestampToString(d.CreatedAt),
		UpdatedAt:        timestampToString(d.UpdatedAt),
	}
}

// CreateBrainDump creates a new brain dump entry.
func (h *Handler) CreateBrainDump(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}
	workspaceID := resolveWorkspaceID(r)
	if workspaceID == "" {
		writeError(w, http.StatusBadRequest, "workspace_id is required")
		return
	}

	var req struct {
		Content string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Content == "" {
		writeError(w, http.StatusBadRequest, "content is required")
		return
	}

	dump, err := h.Queries.CreateBrainDump(r.Context(), db.CreateBrainDumpParams{
		WorkspaceID: parseUUID(workspaceID),
		Content:     req.Content,
		CreatedBy:   parseUUID(userID),
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create brain dump")
		return
	}

	writeJSON(w, http.StatusCreated, brainDumpToResponse(dump))
}

// ListBrainDumps returns brain dump entries for the workspace.
func (h *Handler) ListBrainDumps(w http.ResponseWriter, r *http.Request) {
	if _, ok := requireUserID(w, r); !ok {
		return
	}
	workspaceID := resolveWorkspaceID(r)
	if workspaceID == "" {
		writeError(w, http.StatusBadRequest, "workspace_id is required")
		return
	}

	limit := int32(50)
	offset := int32(0)
	if v := r.URL.Query().Get("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			limit = int32(n)
		}
	}
	if v := r.URL.Query().Get("offset"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n >= 0 {
			offset = int32(n)
		}
	}

	unprocessed := r.URL.Query().Get("unprocessed") == "true"

	var dumps []db.BrainDump
	var err error
	if unprocessed {
		dumps, err = h.Queries.ListUnprocessedBrainDumps(r.Context(), parseUUID(workspaceID))
	} else {
		dumps, err = h.Queries.ListBrainDumps(r.Context(), db.ListBrainDumpsParams{
			WorkspaceID: parseUUID(workspaceID),
			Limit:       limit,
			Offset:      offset,
		})
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list brain dumps")
		return
	}

	items := make([]BrainDumpResponse, len(dumps))
	for i, d := range dumps {
		items[i] = brainDumpToResponse(d)
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"brain_dumps": items,
		"total":       len(items),
	})
}

// CountUnprocessedBrainDumps returns the count of unprocessed brain dumps.
func (h *Handler) CountUnprocessedBrainDumps(w http.ResponseWriter, r *http.Request) {
	if _, ok := requireUserID(w, r); !ok {
		return
	}
	workspaceID := resolveWorkspaceID(r)
	if workspaceID == "" {
		writeError(w, http.StatusBadRequest, "workspace_id is required")
		return
	}

	count, err := h.Queries.CountUnprocessedBrainDumps(r.Context(), parseUUID(workspaceID))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to count brain dumps")
		return
	}

	writeJSON(w, http.StatusOK, map[string]int64{"count": count})
}

// ProcessBrainDump marks a brain dump as processed, optionally linking to a converted issue.
func (h *Handler) ProcessBrainDump(w http.ResponseWriter, r *http.Request) {
	if _, ok := requireUserID(w, r); !ok {
		return
	}
	workspaceID := resolveWorkspaceID(r)
	if workspaceID == "" {
		writeError(w, http.StatusBadRequest, "workspace_id is required")
		return
	}

	id := chi.URLParam(r, "id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "id is required")
		return
	}

	var req struct {
		IssueID *string `json:"issue_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		// Allow empty body — issue_id is optional.
		req.IssueID = nil
	}

	params := db.ProcessBrainDumpParams{
		ID: parseUUID(id),
	}
	if req.IssueID != nil {
		params.ConvertedIssueID = parseUUID(*req.IssueID)
	}

	dump, err := h.Queries.ProcessBrainDump(r.Context(), params)
	if err != nil {
		if isNotFound(err) {
			writeError(w, http.StatusNotFound, "brain dump not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to process brain dump")
		return
	}

	_ = workspaceID // validated for membership via middleware
	writeJSON(w, http.StatusOK, brainDumpToResponse(dump))
}

// DeleteBrainDump removes a brain dump entry.
func (h *Handler) DeleteBrainDump(w http.ResponseWriter, r *http.Request) {
	if _, ok := requireUserID(w, r); !ok {
		return
	}
	workspaceID := resolveWorkspaceID(r)
	if workspaceID == "" {
		writeError(w, http.StatusBadRequest, "workspace_id is required")
		return
	}

	id := chi.URLParam(r, "id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "id is required")
		return
	}

	if err := h.Queries.DeleteBrainDump(r.Context(), parseUUID(id)); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to delete brain dump")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
