package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
	"github.com/multica-ai/multica/server/internal/scheduler"
)

// ScheduledTaskScheduler is set by main.go after the scheduler is initialized.
var ScheduledTaskScheduler *scheduler.Scheduler

// --- Request / Response types ---

type CreateScheduledTaskRequest struct {
	Name           string  `json:"name"`
	CronExpression string  `json:"cron_expression"`
	Timezone       string  `json:"timezone"`
	AgentID        string  `json:"agent_id"`
	Prompt         string  `json:"prompt"`
	ModelOverride  *string `json:"model_override"`
	Enabled        *bool   `json:"enabled"`
}

type UpdateScheduledTaskRequest struct {
	Name           *string `json:"name"`
	CronExpression *string `json:"cron_expression"`
	Timezone       *string `json:"timezone"`
	AgentID        *string `json:"agent_id"`
	Prompt         *string `json:"prompt"`
	ModelOverride  *string `json:"model_override"`
}

type ScheduledTaskResponse struct {
	ID             string  `json:"id"`
	WorkspaceID    string  `json:"workspace_id"`
	Name           string  `json:"name"`
	CronExpression string  `json:"cron_expression"`
	Timezone       string  `json:"timezone"`
	AgentID        string  `json:"agent_id"`
	Prompt         string  `json:"prompt"`
	ModelOverride  *string `json:"model_override"`
	Enabled        bool    `json:"enabled"`
	LastRunAt      *string `json:"last_run_at"`
	LastStatus     *string `json:"last_status"`
	LastDurationMs *int32  `json:"last_duration_ms"`
	RunCount       int32   `json:"run_count"`
	CreatedAt      string  `json:"created_at"`
	UpdatedAt      string  `json:"updated_at"`
}

type ScheduledTaskRunResponse struct {
	ID              string  `json:"id"`
	ScheduledTaskID string  `json:"scheduled_task_id"`
	IssueID         *string `json:"issue_id"`
	Status          string  `json:"status"`
	DurationMs      *int32  `json:"duration_ms"`
	ErrorMessage    *string `json:"error_message"`
	CreatedAt       string  `json:"created_at"`
}

func scheduledTaskToResponse(t db.ScheduledTask) ScheduledTaskResponse {
	resp := ScheduledTaskResponse{
		ID:             uuidToString(t.ID),
		WorkspaceID:    uuidToString(t.WorkspaceID),
		Name:           t.Name,
		CronExpression: t.CronExpression,
		Timezone:       t.Timezone,
		AgentID:        uuidToString(t.AgentID),
		Prompt:         t.Prompt,
		Enabled:        t.Enabled,
		RunCount:       t.RunCount,
		CreatedAt:      timestampToString(t.CreatedAt),
		UpdatedAt:      timestampToString(t.UpdatedAt),
	}
	if t.ModelOverride.Valid {
		resp.ModelOverride = &t.ModelOverride.String
	}
	resp.LastRunAt = timestampToPtr(t.LastRunAt)
	if t.LastStatus.Valid {
		resp.LastStatus = &t.LastStatus.String
	}
	if t.LastDurationMs.Valid {
		resp.LastDurationMs = &t.LastDurationMs.Int32
	}
	return resp
}

func scheduledTaskRunToResponse(r db.ScheduledTaskRun) ScheduledTaskRunResponse {
	resp := ScheduledTaskRunResponse{
		ID:              uuidToString(r.ID),
		ScheduledTaskID: uuidToString(r.ScheduledTaskID),
		IssueID:         uuidToPtr(r.IssueID),
		Status:          r.Status,
		CreatedAt:       timestampToString(r.CreatedAt),
	}
	if r.DurationMs.Valid {
		resp.DurationMs = &r.DurationMs.Int32
	}
	if r.ErrorMessage.Valid {
		resp.ErrorMessage = &r.ErrorMessage.String
	}
	return resp
}

// --- Handlers ---

func (h *Handler) ListScheduledTasks(w http.ResponseWriter, r *http.Request) {
	workspaceID := resolveWorkspaceID(r)
	if workspaceID == "" {
		writeError(w, http.StatusBadRequest, "workspace_id is required")
		return
	}

	tasks, err := h.Queries.ListScheduledTasksByWorkspace(r.Context(), parseUUID(workspaceID))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list tasks")
		return
	}

	items := make([]ScheduledTaskResponse, len(tasks))
	for i, t := range tasks {
		items[i] = scheduledTaskToResponse(t)
	}

	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) CreateScheduledTask(w http.ResponseWriter, r *http.Request) {
	workspaceID := resolveWorkspaceID(r)
	if workspaceID == "" {
		writeError(w, http.StatusBadRequest, "workspace_id is required")
		return
	}

	var req CreateScheduledTaskRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Name == "" || req.CronExpression == "" || req.AgentID == "" || req.Prompt == "" {
		writeError(w, http.StatusBadRequest, "name, cron_expression, agent_id, and prompt are required")
		return
	}

	if req.Timezone == "" {
		req.Timezone = "America/Los_Angeles"
	}

	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}

	params := db.CreateScheduledTaskParams{
		WorkspaceID:    parseUUID(workspaceID),
		Name:           req.Name,
		CronExpression: req.CronExpression,
		Timezone:       req.Timezone,
		AgentID:        parseUUID(req.AgentID),
		Prompt:         req.Prompt,
		Enabled:        enabled,
	}
	if req.ModelOverride != nil {
		params.ModelOverride = pgtype.Text{String: *req.ModelOverride, Valid: true}
	}

	task, err := h.Queries.CreateScheduledTask(r.Context(), params)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create task")
		return
	}

	// Register in live scheduler
	if ScheduledTaskScheduler != nil && task.Enabled {
		ScheduledTaskScheduler.Add(task)
	}

	writeJSON(w, http.StatusCreated, scheduledTaskToResponse(task))
}

func (h *Handler) GetScheduledTask(w http.ResponseWriter, r *http.Request) {
	workspaceID := resolveWorkspaceID(r)
	taskID := chi.URLParam(r, "id")

	task, err := h.Queries.GetScheduledTaskInWorkspace(r.Context(), db.GetScheduledTaskInWorkspaceParams{
		ID:          parseUUID(taskID),
		WorkspaceID: parseUUID(workspaceID),
	})
	if err != nil {
		writeError(w, http.StatusNotFound, "task not found")
		return
	}

	writeJSON(w, http.StatusOK, scheduledTaskToResponse(task))
}

func (h *Handler) UpdateScheduledTask(w http.ResponseWriter, r *http.Request) {
	workspaceID := resolveWorkspaceID(r)
	taskID := chi.URLParam(r, "id")

	// Verify ownership
	existing, err := h.Queries.GetScheduledTaskInWorkspace(r.Context(), db.GetScheduledTaskInWorkspaceParams{
		ID:          parseUUID(taskID),
		WorkspaceID: parseUUID(workspaceID),
	})
	if err != nil {
		writeError(w, http.StatusNotFound, "task not found")
		return
	}

	var req UpdateScheduledTaskRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	params := db.UpdateScheduledTaskParams{ID: parseUUID(taskID)}
	if req.Name != nil {
		params.Name = ptrToText(req.Name)
	}
	if req.CronExpression != nil {
		params.CronExpression = ptrToText(req.CronExpression)
	}
	if req.Timezone != nil {
		params.Timezone = ptrToText(req.Timezone)
	}
	if req.AgentID != nil {
		params.AgentID = parseUUID(*req.AgentID)
	}
	if req.Prompt != nil {
		params.Prompt = ptrToText(req.Prompt)
	}
	params.ModelOverride = ptrToText(req.ModelOverride)

	task, err := h.Queries.UpdateScheduledTask(r.Context(), params)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update task")
		return
	}

	// Hot-reload in scheduler
	if ScheduledTaskScheduler != nil {
		ScheduledTaskScheduler.Reload(task)
	}
	_ = existing

	writeJSON(w, http.StatusOK, scheduledTaskToResponse(task))
}

func (h *Handler) DeleteScheduledTask(w http.ResponseWriter, r *http.Request) {
	workspaceID := resolveWorkspaceID(r)
	taskID := chi.URLParam(r, "id")

	// Verify ownership
	_, err := h.Queries.GetScheduledTaskInWorkspace(r.Context(), db.GetScheduledTaskInWorkspaceParams{
		ID:          parseUUID(taskID),
		WorkspaceID: parseUUID(workspaceID),
	})
	if err != nil {
		writeError(w, http.StatusNotFound, "task not found")
		return
	}

	// Unregister from scheduler
	if ScheduledTaskScheduler != nil {
		ScheduledTaskScheduler.Remove(taskID)
	}

	if err := h.Queries.DeleteScheduledTask(r.Context(), parseUUID(taskID)); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to delete task")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) ToggleScheduledTask(w http.ResponseWriter, r *http.Request) {
	workspaceID := resolveWorkspaceID(r)
	taskID := chi.URLParam(r, "id")

	// Verify ownership
	_, err := h.Queries.GetScheduledTaskInWorkspace(r.Context(), db.GetScheduledTaskInWorkspaceParams{
		ID:          parseUUID(taskID),
		WorkspaceID: parseUUID(workspaceID),
	})
	if err != nil {
		writeError(w, http.StatusNotFound, "task not found")
		return
	}

	var req struct {
		Enabled bool `json:"enabled"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	task, err := h.Queries.SetScheduledTaskEnabled(r.Context(), db.SetScheduledTaskEnabledParams{
		ID:      parseUUID(taskID),
		Enabled: req.Enabled,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to toggle task")
		return
	}

	// Hot-reload in scheduler
	if ScheduledTaskScheduler != nil {
		ScheduledTaskScheduler.Reload(task)
	}

	writeJSON(w, http.StatusOK, scheduledTaskToResponse(task))
}

func (h *Handler) TriggerScheduledTask(w http.ResponseWriter, r *http.Request) {
	workspaceID := resolveWorkspaceID(r)
	taskID := chi.URLParam(r, "id")

	task, err := h.Queries.GetScheduledTaskInWorkspace(r.Context(), db.GetScheduledTaskInWorkspaceParams{
		ID:          parseUUID(taskID),
		WorkspaceID: parseUUID(workspaceID),
	})
	if err != nil {
		writeError(w, http.StatusNotFound, "task not found")
		return
	}

	if ScheduledTaskScheduler != nil {
		ScheduledTaskScheduler.TriggerNow(r.Context(), task)
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (h *Handler) ListScheduledTaskRuns(w http.ResponseWriter, r *http.Request) {
	taskID := chi.URLParam(r, "id")

	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 || limit > 50 {
		limit = 10
	}

	runs, err := h.Queries.ListScheduledTaskRuns(r.Context(), db.ListScheduledTaskRunsParams{
		ScheduledTaskID: parseUUID(taskID),
		Limit:           int32(limit),
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list runs")
		return
	}

	items := make([]ScheduledTaskRunResponse, len(runs))
	for i, run := range runs {
		items[i] = scheduledTaskRunToResponse(run)
	}

	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) CountEnabledScheduledTasks(w http.ResponseWriter, r *http.Request) {
	workspaceID := resolveWorkspaceID(r)
	if workspaceID == "" {
		writeError(w, http.StatusBadRequest, "workspace_id is required")
		return
	}

	count, err := h.Queries.CountEnabledScheduledTasks(r.Context(), parseUUID(workspaceID))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to count tasks")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"count": count})
}
