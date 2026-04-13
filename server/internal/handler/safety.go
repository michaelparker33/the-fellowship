package handler

import (
	"encoding/json"
	"net/http"

	db "github.com/multica-ai/multica/server/pkg/db/generated"
	"github.com/multica-ai/multica/server/pkg/protocol"
)

type SafetyConfigResponse struct {
	ID                      string  `json:"id"`
	WorkspaceID             string  `json:"workspace_id"`
	DailySpendLimitCents    int32   `json:"daily_spend_limit_cents"`
	MonthlySpendLimitCents  int32   `json:"monthly_spend_limit_cents"`
	MaxConcurrentTasks      int32   `json:"max_concurrent_tasks"`
	EmergencyStop           bool    `json:"emergency_stop"`
	EmergencyStopAt         *string `json:"emergency_stop_at"`
	EmergencyStopBy         *string `json:"emergency_stop_by"`
	CreatedAt               string  `json:"created_at"`
	UpdatedAt               string  `json:"updated_at"`
}

func safetyConfigToResponse(c db.SafetyConfig) SafetyConfigResponse {
	return SafetyConfigResponse{
		ID:                     uuidToString(c.ID),
		WorkspaceID:            uuidToString(c.WorkspaceID),
		DailySpendLimitCents:   c.DailySpendLimitCents,
		MonthlySpendLimitCents: c.MonthlySpendLimitCents,
		MaxConcurrentTasks:     c.MaxConcurrentTasks,
		EmergencyStop:          c.EmergencyStop,
		EmergencyStopAt:        timestampToPtr(c.EmergencyStopAt),
		EmergencyStopBy:        uuidToPtr(c.EmergencyStopBy),
		CreatedAt:              timestampToString(c.CreatedAt),
		UpdatedAt:              timestampToString(c.UpdatedAt),
	}
}

func (h *Handler) GetSafetyConfig(w http.ResponseWriter, r *http.Request) {
	workspaceID := resolveWorkspaceID(r)
	if workspaceID == "" {
		writeError(w, http.StatusBadRequest, "workspace_id is required")
		return
	}

	config, err := h.Queries.GetOrCreateSafetyConfig(r.Context(), parseUUID(workspaceID))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to get safety config")
		return
	}

	writeJSON(w, http.StatusOK, safetyConfigToResponse(config))
}

func (h *Handler) UpdateSafetyConfig(w http.ResponseWriter, r *http.Request) {
	workspaceID := resolveWorkspaceID(r)
	if workspaceID == "" {
		writeError(w, http.StatusBadRequest, "workspace_id is required")
		return
	}

	var req struct {
		DailySpendLimitCents   int32 `json:"daily_spend_limit_cents"`
		MonthlySpendLimitCents int32 `json:"monthly_spend_limit_cents"`
		MaxConcurrentTasks     int32 `json:"max_concurrent_tasks"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	config, err := h.Queries.UpsertSafetyConfig(r.Context(), db.UpsertSafetyConfigParams{
		WorkspaceID:            parseUUID(workspaceID),
		DailySpendLimitCents:   req.DailySpendLimitCents,
		MonthlySpendLimitCents: req.MonthlySpendLimitCents,
		MaxConcurrentTasks:     req.MaxConcurrentTasks,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update safety config")
		return
	}

	writeJSON(w, http.StatusOK, safetyConfigToResponse(config))
}

func (h *Handler) ActivateEmergencyStop(w http.ResponseWriter, r *http.Request) {
	workspaceID := resolveWorkspaceID(r)
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	// Ensure config exists
	h.Queries.GetOrCreateSafetyConfig(r.Context(), parseUUID(workspaceID))

	config, err := h.Queries.SetEmergencyStop(r.Context(), db.SetEmergencyStopParams{
		WorkspaceID:     parseUUID(workspaceID),
		EmergencyStopBy: parseUUID(userID),
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to activate emergency stop")
		return
	}

	h.publish(protocol.EventEmergencyStop, workspaceID, "member", userID, map[string]any{
		"stopped_by": userID,
		"stopped_at": timestampToString(config.EmergencyStopAt),
	})

	writeJSON(w, http.StatusOK, safetyConfigToResponse(config))
}

func (h *Handler) DeactivateEmergencyStop(w http.ResponseWriter, r *http.Request) {
	workspaceID := resolveWorkspaceID(r)
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	config, err := h.Queries.ClearEmergencyStop(r.Context(), parseUUID(workspaceID))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to deactivate emergency stop")
		return
	}

	h.publish(protocol.EventEmergencyResume, workspaceID, "member", userID, map[string]any{
		"resumed_by": userID,
	})

	writeJSON(w, http.StatusOK, safetyConfigToResponse(config))
}
