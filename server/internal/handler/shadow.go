package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
)

// --- Request / Response types ---

type CreateShadowConfigRequest struct {
	ShadowModel string  `json:"shadow_model"`
	Enabled     bool    `json:"enabled"`
	SampleRate  float32 `json:"sample_rate"`
}

type RateShadowRunRequest struct {
	QualityScore int32 `json:"quality_score"`
}

type ShadowRunResponse struct {
	ID                string  `json:"id"`
	WorkspaceID       string  `json:"workspace_id"`
	TaskID            string  `json:"task_id"`
	ShadowModel       string  `json:"shadow_model"`
	PrimaryModel      string  `json:"primary_model"`
	ShadowOutput      *string `json:"shadow_output"`
	PrimaryOutput     *string `json:"primary_output"`
	ShadowCostUsd     *string `json:"shadow_cost_usd"`
	PrimaryCostUsd    *string `json:"primary_cost_usd"`
	ShadowDurationMs  *int32  `json:"shadow_duration_ms"`
	PrimaryDurationMs *int32  `json:"primary_duration_ms"`
	QualityScore      *int32  `json:"quality_score"`
	CreatedAt         string  `json:"created_at"`
}

type ShadowConfigResponse struct {
	ID          string  `json:"id"`
	WorkspaceID string  `json:"workspace_id"`
	ShadowModel string  `json:"shadow_model"`
	Enabled     bool    `json:"enabled"`
	SampleRate  float32 `json:"sample_rate"`
	CreatedAt   string  `json:"created_at"`
	UpdatedAt   string  `json:"updated_at"`
}

type ShadowStatsResponse struct {
	TotalRuns          int64   `json:"total_runs"`
	AvgQuality         float64 `json:"avg_quality"`
	AvgShadowCost      float64 `json:"avg_shadow_cost"`
	AvgPrimaryCost     float64 `json:"avg_primary_cost"`
	AvgShadowDuration  float64 `json:"avg_shadow_duration"`
	AvgPrimaryDuration float64 `json:"avg_primary_duration"`
}

func shadowRunToResponse(r db.ShadowRun) ShadowRunResponse {
	resp := ShadowRunResponse{
		ID:           uuidToString(r.ID),
		WorkspaceID:  uuidToString(r.WorkspaceID),
		TaskID:       uuidToString(r.TaskID),
		ShadowModel:  r.ShadowModel,
		PrimaryModel: r.PrimaryModel,
		CreatedAt:    timestampToString(r.CreatedAt),
	}
	if r.ShadowOutput.Valid {
		resp.ShadowOutput = &r.ShadowOutput.String
	}
	if r.PrimaryOutput.Valid {
		resp.PrimaryOutput = &r.PrimaryOutput.String
	}
	if r.ShadowCostUsd.Valid {
		s := r.ShadowCostUsd.Int.String()
		resp.ShadowCostUsd = &s
	}
	if r.PrimaryCostUsd.Valid {
		s := r.PrimaryCostUsd.Int.String()
		resp.PrimaryCostUsd = &s
	}
	if r.ShadowDurationMs.Valid {
		resp.ShadowDurationMs = &r.ShadowDurationMs.Int32
	}
	if r.PrimaryDurationMs.Valid {
		resp.PrimaryDurationMs = &r.PrimaryDurationMs.Int32
	}
	if r.QualityScore.Valid {
		resp.QualityScore = &r.QualityScore.Int32
	}
	return resp
}

func shadowConfigToResponse(c db.ShadowConfig) ShadowConfigResponse {
	return ShadowConfigResponse{
		ID:          uuidToString(c.ID),
		WorkspaceID: uuidToString(c.WorkspaceID),
		ShadowModel: c.ShadowModel,
		Enabled:     c.Enabled,
		SampleRate:  c.SampleRate,
		CreatedAt:   timestampToString(c.CreatedAt),
		UpdatedAt:   timestampToString(c.UpdatedAt),
	}
}

// --- Handlers ---

func (h *Handler) ListShadowRuns(w http.ResponseWriter, r *http.Request) {
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

	runs, err := h.Queries.ListShadowRunsByWorkspace(r.Context(), db.ListShadowRunsByWorkspaceParams{
		WorkspaceID: parseUUID(workspaceID),
		Limit:       int32(limit),
		Offset:      int32(offset),
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list shadow runs")
		return
	}

	total, _ := h.Queries.CountShadowRunsByWorkspace(r.Context(), parseUUID(workspaceID))

	items := make([]ShadowRunResponse, len(runs))
	for i, run := range runs {
		items[i] = shadowRunToResponse(run)
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"items": items,
		"total": total,
	})
}

func (h *Handler) GetShadowStats(w http.ResponseWriter, r *http.Request) {
	workspaceID := resolveWorkspaceID(r)
	if workspaceID == "" {
		writeError(w, http.StatusBadRequest, "workspace_id is required")
		return
	}

	stats, err := h.Queries.GetShadowRunStats(r.Context(), parseUUID(workspaceID))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to get shadow stats")
		return
	}

	writeJSON(w, http.StatusOK, ShadowStatsResponse{
		TotalRuns:          stats.TotalRuns,
		AvgQuality:         stats.AvgQuality,
		AvgShadowCost:      stats.AvgShadowCost,
		AvgPrimaryCost:     stats.AvgPrimaryCost,
		AvgShadowDuration:  stats.AvgShadowDuration,
		AvgPrimaryDuration: stats.AvgPrimaryDuration,
	})
}

func (h *Handler) RateShadowRun(w http.ResponseWriter, r *http.Request) {
	runID := chi.URLParam(r, "id")

	var req RateShadowRunRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.QualityScore < 1 || req.QualityScore > 5 {
		writeError(w, http.StatusBadRequest, "quality_score must be 1-5")
		return
	}

	run, err := h.Queries.RateShadowRun(r.Context(), db.RateShadowRunParams{
		ID:           parseUUID(runID),
		QualityScore: pgtype.Int4{Int32: req.QualityScore, Valid: true},
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to rate shadow run")
		return
	}

	writeJSON(w, http.StatusOK, shadowRunToResponse(run))
}

func (h *Handler) ListShadowConfigs(w http.ResponseWriter, r *http.Request) {
	workspaceID := resolveWorkspaceID(r)
	if workspaceID == "" {
		writeError(w, http.StatusBadRequest, "workspace_id is required")
		return
	}

	configs, err := h.Queries.ListShadowConfigs(r.Context(), parseUUID(workspaceID))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list shadow configs")
		return
	}

	items := make([]ShadowConfigResponse, len(configs))
	for i, c := range configs {
		items[i] = shadowConfigToResponse(c)
	}

	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) UpsertShadowConfig(w http.ResponseWriter, r *http.Request) {
	workspaceID := resolveWorkspaceID(r)
	if workspaceID == "" {
		writeError(w, http.StatusBadRequest, "workspace_id is required")
		return
	}

	var req CreateShadowConfigRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.ShadowModel == "" {
		writeError(w, http.StatusBadRequest, "shadow_model is required")
		return
	}
	if req.SampleRate < 0 || req.SampleRate > 1 {
		writeError(w, http.StatusBadRequest, "sample_rate must be 0-1")
		return
	}

	config, err := h.Queries.CreateShadowConfig(r.Context(), db.CreateShadowConfigParams{
		WorkspaceID: parseUUID(workspaceID),
		ShadowModel: req.ShadowModel,
		Enabled:     req.Enabled,
		SampleRate:  req.SampleRate,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to save shadow config")
		return
	}

	writeJSON(w, http.StatusOK, shadowConfigToResponse(config))
}

func (h *Handler) DeleteShadowConfig(w http.ResponseWriter, r *http.Request) {
	workspaceID := resolveWorkspaceID(r)
	configID := chi.URLParam(r, "id")

	err := h.Queries.DeleteShadowConfig(r.Context(), db.DeleteShadowConfigParams{
		ID:          parseUUID(configID),
		WorkspaceID: parseUUID(workspaceID),
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to delete shadow config")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}
