package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
)

// --- Response types ---

type LoopDetectionResponse struct {
	ID                  string          `json:"id"`
	WorkspaceID         string          `json:"workspace_id"`
	IssueID             string          `json:"issue_id"`
	AgentID             string          `json:"agent_id"`
	ConsecutiveFailures int32           `json:"consecutive_failures"`
	FailureHistory      json.RawMessage `json:"failure_history"`
	EscalationStatus    string          `json:"escalation_status"`
	EscalationDecision  *string         `json:"escalation_decision"`
	DecidedBy           *string         `json:"decided_by"`
	DecidedAt           *string         `json:"decided_at"`
	CreatedAt           string          `json:"created_at"`
	UpdatedAt           string          `json:"updated_at"`
}

func loopDetectionToResponse(ld db.LoopDetection) LoopDetectionResponse {
	return LoopDetectionResponse{
		ID:                  uuidToString(ld.ID),
		WorkspaceID:         uuidToString(ld.WorkspaceID),
		IssueID:             uuidToString(ld.IssueID),
		AgentID:             uuidToString(ld.AgentID),
		ConsecutiveFailures: ld.ConsecutiveFailures,
		FailureHistory:      ld.FailureHistory,
		EscalationStatus:    ld.EscalationStatus,
		EscalationDecision:  textToPtr(ld.EscalationDecision),
		DecidedBy:           uuidToPtr(ld.DecidedBy),
		DecidedAt:           timestampToPtr(ld.DecidedAt),
		CreatedAt:           timestampToString(ld.CreatedAt),
		UpdatedAt:           timestampToString(ld.UpdatedAt),
	}
}

// --- Handlers ---

func (h *Handler) ListEscalatedLoopDetections(w http.ResponseWriter, r *http.Request) {
	workspaceID := resolveWorkspaceID(r)
	if workspaceID == "" {
		writeError(w, http.StatusBadRequest, "workspace_id is required")
		return
	}

	detections, err := h.Queries.ListEscalatedLoopDetections(r.Context(), parseUUID(workspaceID))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list escalations")
		return
	}

	items := make([]LoopDetectionResponse, len(detections))
	for i, ld := range detections {
		items[i] = loopDetectionToResponse(ld)
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"items": items,
	})
}

func (h *Handler) CountEscalatedLoopDetections(w http.ResponseWriter, r *http.Request) {
	workspaceID := resolveWorkspaceID(r)
	if workspaceID == "" {
		writeError(w, http.StatusBadRequest, "workspace_id is required")
		return
	}

	count, err := h.Queries.CountEscalatedLoopDetections(r.Context(), parseUUID(workspaceID))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to count escalations")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"count": count})
}

type ResolveLoopDetectionRequest struct {
	Decision string `json:"decision"`
}

func (h *Handler) ResolveLoopDetection(w http.ResponseWriter, r *http.Request) {
	workspaceID := resolveWorkspaceID(r)
	if workspaceID == "" {
		writeError(w, http.StatusBadRequest, "workspace_id is required")
		return
	}

	escalationID := chi.URLParam(r, "id")
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	var req ResolveLoopDetectionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	switch req.Decision {
	case "retry_different", "skip", "stop":
	default:
		writeError(w, http.StatusBadRequest, "decision must be retry_different, skip, or stop")
		return
	}

	resolved, err := h.Queries.ResolveLoopDetection(r.Context(), db.ResolveLoopDetectionParams{
		ID:                 parseUUID(escalationID),
		EscalationDecision: pgtype.Text{String: req.Decision, Valid: true},
		DecidedBy:          parseUUID(userID),
	})
	if err != nil {
		writeError(w, http.StatusNotFound, "escalation not found")
		return
	}

	// Handle decision side effects
	switch req.Decision {
	case "retry_different":
		// Re-queue the task with a note
		if resolved.IssueID.Valid {
			issue, err := h.Queries.GetIssue(r.Context(), resolved.IssueID)
			if err == nil && issue.AssigneeID.Valid {
				h.TaskService.EnqueueTaskForIssue(r.Context(), issue)
			}
		}
	case "skip":
		// Move issue to backlog
		if resolved.IssueID.Valid {
			h.Queries.UpdateIssueStatus(r.Context(), db.UpdateIssueStatusParams{
				ID:     resolved.IssueID,
				Status: "backlog",
			})
		}
	case "stop":
		// No re-queue, just resolved
	}

	writeJSON(w, http.StatusOK, loopDetectionToResponse(resolved))
}
