package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
)

type TrustScoreResponse struct {
	ID                        string  `json:"id"`
	WorkspaceID               string  `json:"workspace_id"`
	AgentID                   string  `json:"agent_id"`
	AgentName                 string  `json:"agent_name"`
	ActionType                string  `json:"action_type"`
	TotalApprovals            int32   `json:"total_approvals"`
	TotalRejections           int32   `json:"total_rejections"`
	TotalEdits                int32   `json:"total_edits"`
	ConsecutiveCleanApprovals int32   `json:"consecutive_clean_approvals"`
	ApprovalRate              float64 `json:"approval_rate"`
	PromotionSuggested        bool    `json:"promotion_suggested"`
	CreatedAt                 string  `json:"created_at"`
	UpdatedAt                 string  `json:"updated_at"`
}

func trustScoreToResponse(ts db.ListTrustScoresByWorkspaceRow) TrustScoreResponse {
	total := float64(ts.TotalApprovals + ts.TotalRejections + ts.TotalEdits)
	rate := float64(0)
	if total > 0 {
		rate = float64(ts.TotalApprovals) / total
	}
	return TrustScoreResponse{
		ID:                        uuidToString(ts.ID),
		WorkspaceID:               uuidToString(ts.WorkspaceID),
		AgentID:                   uuidToString(ts.AgentID),
		AgentName:                 ts.AgentName,
		ActionType:                ts.ActionType,
		TotalApprovals:            ts.TotalApprovals,
		TotalRejections:           ts.TotalRejections,
		TotalEdits:                ts.TotalEdits,
		ConsecutiveCleanApprovals: ts.ConsecutiveCleanApprovals,
		ApprovalRate:              rate,
		PromotionSuggested:        ts.PromotionSuggested,
		CreatedAt:                 timestampToString(ts.CreatedAt),
		UpdatedAt:                 timestampToString(ts.UpdatedAt),
	}
}

func promotionToResponse(ts db.ListPromotionSuggestionsRow) TrustScoreResponse {
	total := float64(ts.TotalApprovals + ts.TotalRejections + ts.TotalEdits)
	rate := float64(0)
	if total > 0 {
		rate = float64(ts.TotalApprovals) / total
	}
	return TrustScoreResponse{
		ID:                        uuidToString(ts.ID),
		WorkspaceID:               uuidToString(ts.WorkspaceID),
		AgentID:                   uuidToString(ts.AgentID),
		AgentName:                 ts.AgentName,
		ActionType:                ts.ActionType,
		TotalApprovals:            ts.TotalApprovals,
		TotalRejections:           ts.TotalRejections,
		TotalEdits:                ts.TotalEdits,
		ConsecutiveCleanApprovals: ts.ConsecutiveCleanApprovals,
		ApprovalRate:              rate,
		PromotionSuggested:        ts.PromotionSuggested,
		CreatedAt:                 timestampToString(ts.CreatedAt),
		UpdatedAt:                 timestampToString(ts.UpdatedAt),
	}
}

func (h *Handler) ListTrustScores(w http.ResponseWriter, r *http.Request) {
	workspaceID := resolveWorkspaceID(r)
	if workspaceID == "" {
		writeError(w, http.StatusBadRequest, "workspace_id is required")
		return
	}

	rows, err := h.Queries.ListTrustScoresByWorkspace(r.Context(), parseUUID(workspaceID))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list trust scores")
		return
	}

	items := make([]TrustScoreResponse, len(rows))
	for i, ts := range rows {
		items[i] = trustScoreToResponse(ts)
	}

	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) ListPromotionSuggestions(w http.ResponseWriter, r *http.Request) {
	workspaceID := resolveWorkspaceID(r)
	if workspaceID == "" {
		writeError(w, http.StatusBadRequest, "workspace_id is required")
		return
	}

	rows, err := h.Queries.ListPromotionSuggestions(r.Context(), parseUUID(workspaceID))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list promotions")
		return
	}

	items := make([]TrustScoreResponse, len(rows))
	for i, ts := range rows {
		items[i] = promotionToResponse(ts)
	}

	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) DismissPromotion(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.Queries.DismissPromotion(r.Context(), parseUUID(id)); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to dismiss promotion")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (h *Handler) AcceptPromotion(w http.ResponseWriter, r *http.Request) {
	workspaceID := resolveWorkspaceID(r)
	id := chi.URLParam(r, "id")

	ts, err := h.Queries.GetTrustScore(r.Context(), parseUUID(id))
	if err != nil {
		writeError(w, http.StatusNotFound, "trust score not found")
		return
	}

	// Promote the action type to the next autonomy tier
	currentConfig, err := h.Queries.GetApprovalConfig(r.Context(), db.GetApprovalConfigParams{
		WorkspaceID: parseUUID(workspaceID),
		ActionType:  ts.ActionType,
	})
	if err == nil {
		newLevel := promoteAutonomyLevel(currentConfig.AutonomyLevel)
		if newLevel != currentConfig.AutonomyLevel {
			h.Queries.UpsertApprovalConfig(r.Context(), db.UpsertApprovalConfigParams{
				WorkspaceID:   parseUUID(workspaceID),
				ActionType:    ts.ActionType,
				AutonomyLevel: newLevel,
			})
		}
	}

	if err := h.Queries.AcceptPromotion(r.Context(), parseUUID(id)); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to accept promotion")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func promoteAutonomyLevel(current string) string {
	switch current {
	case "manual":
		return "supervised"
	case "supervised":
		return "full"
	default:
		return current
	}
}

// trackTrustScore updates trust tracking after an approval decision.
// Called from decideApproval in approval.go.
func (h *Handler) trackTrustScore(r *http.Request, workspaceID string, agentID string, actionType string, status string, hasNote bool) {
	wsUUID := parseUUID(workspaceID)
	agentUUID := parseUUID(agentID)

	switch {
	case status == "approved" && !hasNote:
		// Clean approval — no edits
		h.Queries.UpsertTrustScoreApproval(r.Context(), db.UpsertTrustScoreApprovalParams{
			WorkspaceID: wsUUID,
			AgentID:     agentUUID,
			ActionType:  actionType,
		})
	case status == "approved" && hasNote:
		// Approved with edits — reset consecutive
		h.Queries.IncrementTrustScoreEdit(r.Context(), db.IncrementTrustScoreEditParams{
			WorkspaceID: wsUUID,
			AgentID:     agentUUID,
			ActionType:  actionType,
		})
	case status == "rejected":
		h.Queries.IncrementTrustScoreRejection(r.Context(), db.IncrementTrustScoreRejectionParams{
			WorkspaceID: wsUUID,
			AgentID:     agentUUID,
			ActionType:  actionType,
		})
	}
}

// Ensure the handler doesn't use json import warning
var _ = json.NewDecoder
