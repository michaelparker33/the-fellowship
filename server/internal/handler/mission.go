package handler

import (
	"log/slog"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
)

// ---------------------------------------------------------------------------
// Response
// ---------------------------------------------------------------------------

type MissionResponse struct {
	ID             string  `json:"id"`
	WorkspaceID    string  `json:"workspace_id"`
	ProjectID      string  `json:"project_id"`
	Status         string  `json:"status"`
	TotalTasks     int32   `json:"total_tasks"`
	CompletedTasks int32   `json:"completed_tasks"`
	FailedTasks    int32   `json:"failed_tasks"`
	SkippedTasks   int32   `json:"skipped_tasks"`
	CurrentTaskID  *string `json:"current_task_id"`
	StartedBy      string  `json:"started_by"`
	StartedAt      string  `json:"started_at"`
	CompletedAt    *string `json:"completed_at"`
	StoppedAt      *string `json:"stopped_at"`
	Progress       float64 `json:"progress"`
	CreatedAt      string  `json:"created_at"`
}

func missionToResponse(m db.Mission) MissionResponse {
	var progress float64
	if m.TotalTasks > 0 {
		progress = float64(m.CompletedTasks+m.FailedTasks+m.SkippedTasks) / float64(m.TotalTasks)
	}
	return MissionResponse{
		ID:             uuidToString(m.ID),
		WorkspaceID:    uuidToString(m.WorkspaceID),
		ProjectID:      uuidToString(m.ProjectID),
		Status:         m.Status,
		TotalTasks:     m.TotalTasks,
		CompletedTasks: m.CompletedTasks,
		FailedTasks:    m.FailedTasks,
		SkippedTasks:   m.SkippedTasks,
		CurrentTaskID:  uuidToPtr(m.CurrentTaskID),
		StartedBy:      uuidToString(m.StartedBy),
		StartedAt:      timestampToString(m.StartedAt),
		CompletedAt:    timestampToPtr(m.CompletedAt),
		StoppedAt:      timestampToPtr(m.StoppedAt),
		Progress:       progress,
		CreatedAt:      timestampToString(m.CreatedAt),
	}
}

// eligibleIssueRow filters a ListIssuesRow for mission eligibility: non-done, agent-assigned.
func isEligibleForMission(row db.ListIssuesRow) bool {
	if row.Status == "done" || row.Status == "cancelled" {
		return false
	}
	if !row.AssigneeID.Valid {
		return false
	}
	at := textToPtr(row.AssigneeType)
	return at != nil && *at == "agent"
}

// ---------------------------------------------------------------------------
// StartMission — POST /api/projects/{id}/run
// ---------------------------------------------------------------------------

func (h *Handler) StartMission(w http.ResponseWriter, r *http.Request) {
	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}
	workspaceID := resolveWorkspaceID(r)
	if workspaceID == "" {
		writeError(w, http.StatusBadRequest, "workspace_id is required")
		return
	}

	projectID := chi.URLParam(r, "id")
	if projectID == "" {
		writeError(w, http.StatusBadRequest, "project id is required")
		return
	}

	// Verify project exists in workspace.
	project, err := h.Queries.GetProject(r.Context(), parseUUID(projectID))
	if err != nil || uuidToString(project.WorkspaceID) != workspaceID {
		writeError(w, http.StatusNotFound, "project not found")
		return
	}

	// Check no active mission for this project.
	_, err = h.Queries.GetActiveMissionForProject(r.Context(), parseUUID(projectID))
	if err == nil {
		writeError(w, http.StatusConflict, "a mission is already running for this project")
		return
	}

	// Get all issues for the project, ordered by position.
	rows, err := h.Queries.ListIssues(r.Context(), db.ListIssuesParams{
		WorkspaceID: parseUUID(workspaceID),
		ProjectID:   pgtype.UUID{Bytes: parseUUID(projectID).Bytes, Valid: true},
		Limit:       1000,
		Offset:      0,
	})
	if err != nil {
		slog.Error("start mission: list issues failed", "error", err)
		writeError(w, http.StatusInternalServerError, "failed to list issues")
		return
	}

	// Filter to eligible (agent-assigned, non-done) issues.
	var eligibleRows []db.ListIssuesRow
	for _, row := range rows {
		if isEligibleForMission(row) {
			eligibleRows = append(eligibleRows, row)
		}
	}

	if len(eligibleRows) == 0 {
		writeError(w, http.StatusBadRequest, "no eligible agent-assigned tasks found")
		return
	}

	// Create mission record.
	mission, err := h.Queries.CreateMission(r.Context(), db.CreateMissionParams{
		WorkspaceID: parseUUID(workspaceID),
		ProjectID:   parseUUID(projectID),
		TotalTasks:  int32(len(eligibleRows)),
		StartedBy:   parseUUID(userID),
	})
	if err != nil {
		slog.Error("start mission: create failed", "error", err)
		writeError(w, http.StatusInternalServerError, "failed to create mission")
		return
	}

	// Update status to running.
	mission, err = h.Queries.UpdateMissionStatus(r.Context(), db.UpdateMissionStatusParams{
		ID:     mission.ID,
		Status: "running",
	})
	if err != nil {
		slog.Error("start mission: status update failed", "error", err)
		writeError(w, http.StatusInternalServerError, "failed to start mission")
		return
	}

	// Dispatch the first task — fetch full Issue for TaskService.
	firstRow := eligibleRows[0]
	firstIssue, err := h.Queries.GetIssue(r.Context(), firstRow.ID)
	if err != nil {
		slog.Warn("start mission: fetch first issue failed", "error", err)
	} else {
		_, taskErr := h.TaskService.EnqueueTaskForIssue(r.Context(), firstIssue)
		if taskErr != nil {
			slog.Warn("start mission: first task dispatch failed", "error", taskErr, "issue_id", uuidToString(firstIssue.ID))
		}
	}

	// Update mission progress with current task.
	mission, _ = h.Queries.UpdateMissionProgress(r.Context(), db.UpdateMissionProgressParams{
		ID:             mission.ID,
		CompletedTasks: 0,
		FailedTasks:    0,
		SkippedTasks:   0,
		CurrentTaskID:  firstRow.ID,
	})

	writeJSON(w, http.StatusCreated, missionToResponse(mission))
}

// ---------------------------------------------------------------------------
// GetMission — GET /api/missions/{id}
// ---------------------------------------------------------------------------

func (h *Handler) GetMission(w http.ResponseWriter, r *http.Request) {
	if _, ok := requireUserID(w, r); !ok {
		return
	}

	missionID := chi.URLParam(r, "id")
	mission, err := h.Queries.GetMission(r.Context(), parseUUID(missionID))
	if err != nil {
		writeError(w, http.StatusNotFound, "mission not found")
		return
	}

	writeJSON(w, http.StatusOK, missionToResponse(mission))
}

// ---------------------------------------------------------------------------
// ListMissions — GET /api/missions?project_id=...&limit=...&offset=...
// ---------------------------------------------------------------------------

func (h *Handler) ListMissions(w http.ResponseWriter, r *http.Request) {
	if _, ok := requireUserID(w, r); !ok {
		return
	}
	workspaceID := resolveWorkspaceID(r)
	if workspaceID == "" {
		writeError(w, http.StatusBadRequest, "workspace_id is required")
		return
	}

	limit := 50
	offset := 0
	if v := r.URL.Query().Get("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 && n <= 100 {
			limit = n
		}
	}
	if v := r.URL.Query().Get("offset"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n >= 0 {
			offset = n
		}
	}

	projectID := r.URL.Query().Get("project_id")

	var missions []db.Mission
	var err error

	if projectID != "" {
		missions, err = h.Queries.ListMissionsByProject(r.Context(), db.ListMissionsByProjectParams{
			ProjectID: parseUUID(projectID),
			Limit:     int32(limit),
			Offset:    int32(offset),
		})
	} else {
		missions, err = h.Queries.ListMissionsByWorkspace(r.Context(), db.ListMissionsByWorkspaceParams{
			WorkspaceID: parseUUID(workspaceID),
			Limit:       int32(limit),
			Offset:      int32(offset),
		})
	}
	if err != nil {
		slog.Error("list missions failed", "error", err)
		writeError(w, http.StatusInternalServerError, "failed to list missions")
		return
	}

	items := make([]MissionResponse, len(missions))
	for i, m := range missions {
		items[i] = missionToResponse(m)
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"missions": items,
		"total":    len(items),
	})
}

// ---------------------------------------------------------------------------
// StopMission — POST /api/missions/{id}/stop
// ---------------------------------------------------------------------------

func (h *Handler) StopMission(w http.ResponseWriter, r *http.Request) {
	if _, ok := requireUserID(w, r); !ok {
		return
	}

	missionID := chi.URLParam(r, "id")
	mission, err := h.Queries.GetMission(r.Context(), parseUUID(missionID))
	if err != nil {
		writeError(w, http.StatusNotFound, "mission not found")
		return
	}

	if mission.Status != "pending" && mission.Status != "running" {
		writeError(w, http.StatusBadRequest, "mission is not active")
		return
	}

	mission, err = h.Queries.StopMission(r.Context(), mission.ID)
	if err != nil {
		slog.Error("stop mission failed", "error", err)
		writeError(w, http.StatusInternalServerError, "failed to stop mission")
		return
	}

	writeJSON(w, http.StatusOK, missionToResponse(mission))
}

// ---------------------------------------------------------------------------
// AdvanceMission — POST /api/missions/{id}/advance
// Called by daemon on task completion.
// ---------------------------------------------------------------------------

func (h *Handler) AdvanceMission(w http.ResponseWriter, r *http.Request) {
	missionID := chi.URLParam(r, "id")
	mission, err := h.Queries.GetMission(r.Context(), parseUUID(missionID))
	if err != nil {
		writeError(w, http.StatusNotFound, "mission not found")
		return
	}

	if mission.Status != "running" {
		writeError(w, http.StatusBadRequest, "mission is not running")
		return
	}

	workspaceID := uuidToString(mission.WorkspaceID)
	projectID := uuidToString(mission.ProjectID)

	// Increment completed tasks.
	newCompleted := mission.CompletedTasks + 1

	// Find next undone, agent-assigned issue in the project.
	rows, err := h.Queries.ListIssues(r.Context(), db.ListIssuesParams{
		WorkspaceID: parseUUID(workspaceID),
		ProjectID:   pgtype.UUID{Bytes: parseUUID(projectID).Bytes, Valid: true},
		Limit:       1000,
		Offset:      0,
	})
	if err != nil {
		slog.Error("advance mission: list issues failed", "error", err)
		writeError(w, http.StatusInternalServerError, "failed to list issues")
		return
	}

	// Find the next eligible issue after the current one.
	var nextRow *db.ListIssuesRow
	currentTaskID := uuidToPtr(mission.CurrentTaskID)
	pastCurrent := currentTaskID == nil
	for i := range rows {
		row := rows[i]
		rowID := uuidToString(row.ID)

		if !pastCurrent {
			if currentTaskID != nil && rowID == *currentTaskID {
				pastCurrent = true
			}
			continue
		}

		if isEligibleForMission(row) {
			nextRow = &row
			break
		}
	}

	if nextRow == nil {
		// No more tasks — mark mission as completed.
		mission, _ = h.Queries.UpdateMissionProgress(r.Context(), db.UpdateMissionProgressParams{
			ID:             mission.ID,
			CompletedTasks: newCompleted,
			FailedTasks:    mission.FailedTasks,
			SkippedTasks:   mission.SkippedTasks,
			CurrentTaskID:  pgtype.UUID{},
		})
		mission, _ = h.Queries.CompleteMission(r.Context(), mission.ID)
		writeJSON(w, http.StatusOK, missionToResponse(mission))
		return
	}

	// Fetch full issue and dispatch.
	fullIssue, err := h.Queries.GetIssue(r.Context(), nextRow.ID)
	if err != nil {
		slog.Warn("advance mission: fetch issue failed", "error", err, "issue_id", uuidToString(nextRow.ID))
	} else {
		_, taskErr := h.TaskService.EnqueueTaskForIssue(r.Context(), fullIssue)
		if taskErr != nil {
			slog.Warn("advance mission: task dispatch failed", "error", taskErr, "issue_id", uuidToString(nextRow.ID))
		}
	}

	// Update mission progress.
	mission, _ = h.Queries.UpdateMissionProgress(r.Context(), db.UpdateMissionProgressParams{
		ID:             mission.ID,
		CompletedTasks: newCompleted,
		FailedTasks:    mission.FailedTasks,
		SkippedTasks:   mission.SkippedTasks,
		CurrentTaskID:  nextRow.ID,
	})

	writeJSON(w, http.StatusOK, missionToResponse(mission))
}
