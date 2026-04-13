package handler

import (
	"net/http"
)

type AchievementResponse struct {
	ID             string  `json:"id"`
	WorkspaceID    string  `json:"workspace_id"`
	AchievementKey string  `json:"achievement_key"`
	UnlockedAt     string  `json:"unlocked_at"`
	Metadata       any     `json:"metadata"`
}

func (h *Handler) ListAchievements(w http.ResponseWriter, r *http.Request) {
	workspaceID := resolveWorkspaceID(r)
	if workspaceID == "" {
		writeError(w, http.StatusBadRequest, "workspace_id is required")
		return
	}

	achievements, err := h.Queries.ListAchievements(r.Context(), parseUUID(workspaceID))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list achievements")
		return
	}

	items := make([]AchievementResponse, len(achievements))
	for i, a := range achievements {
		items[i] = AchievementResponse{
			ID:             uuidToString(a.ID),
			WorkspaceID:    uuidToString(a.WorkspaceID),
			AchievementKey: a.AchievementKey,
			UnlockedAt:     timestampToString(a.UnlockedAt),
			Metadata:       a.Metadata,
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}
