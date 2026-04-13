package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
)

// --- Response types ---

type WeeklyDigestResponse struct {
	ID          string   `json:"id"`
	WorkspaceID string   `json:"workspace_id"`
	PeriodStart string   `json:"period_start"`
	PeriodEnd   string   `json:"period_end"`
	Content     any      `json:"content"`
	IssueID     *string  `json:"issue_id"`
	EmailedTo   []string `json:"emailed_to"`
	CreatedAt   string   `json:"created_at"`
}

type DigestContent struct {
	TasksCompleted     int64 `json:"tasks_completed"`
	TasksFailed        int64 `json:"tasks_failed"`
	ApprovalsProcessed int64 `json:"approvals_processed"`
	IssuesCreated      int64 `json:"issues_created"`
	IssuesCompleted    int64 `json:"issues_completed"`
}

func weeklyDigestToResponse(d db.WeeklyDigest) WeeklyDigestResponse {
	var content any
	if len(d.Content) > 0 {
		json.Unmarshal(d.Content, &content)
	}
	periodStart := ""
	if d.PeriodStart.Valid {
		periodStart = d.PeriodStart.Time.Format("2006-01-02")
	}
	periodEnd := ""
	if d.PeriodEnd.Valid {
		periodEnd = d.PeriodEnd.Time.Format("2006-01-02")
	}
	return WeeklyDigestResponse{
		ID:          uuidToString(d.ID),
		WorkspaceID: uuidToString(d.WorkspaceID),
		PeriodStart: periodStart,
		PeriodEnd:   periodEnd,
		Content:     content,
		IssueID:     uuidToPtr(d.IssueID),
		EmailedTo:   d.EmailedTo,
		CreatedAt:   timestampToString(d.CreatedAt),
	}
}

// --- Handlers ---

func (h *Handler) ListWeeklyDigests(w http.ResponseWriter, r *http.Request) {
	workspaceID := resolveWorkspaceID(r)
	if workspaceID == "" {
		writeError(w, http.StatusBadRequest, "workspace_id is required")
		return
	}

	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))

	digests, err := h.Queries.ListWeeklyDigests(r.Context(), db.ListWeeklyDigestsParams{
		WorkspaceID: parseUUID(workspaceID),
		Limit:       int32(limit),
		Offset:      int32(offset),
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list digests")
		return
	}

	items := make([]WeeklyDigestResponse, len(digests))
	for i, d := range digests {
		items[i] = weeklyDigestToResponse(d)
	}

	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) GetLatestDigest(w http.ResponseWriter, r *http.Request) {
	workspaceID := resolveWorkspaceID(r)
	if workspaceID == "" {
		writeError(w, http.StatusBadRequest, "workspace_id is required")
		return
	}

	digest, err := h.Queries.GetLatestWeeklyDigest(r.Context(), parseUUID(workspaceID))
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{"digest": nil})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"digest": weeklyDigestToResponse(digest),
	})
}

func (h *Handler) GenerateDigest(w http.ResponseWriter, r *http.Request) {
	workspaceID := resolveWorkspaceID(r)
	if workspaceID == "" {
		writeError(w, http.StatusBadRequest, "workspace_id is required")
		return
	}

	// Calculate period: last 7 days
	now := time.Now().UTC()
	periodEnd := now.Truncate(24 * time.Hour)
	periodStart := periodEnd.AddDate(0, 0, -7)

	wsUUID := parseUUID(workspaceID)

	// Aggregate stats
	startTS := pgtype.Timestamptz{Time: periodStart, Valid: true}
	endTS := pgtype.Timestamptz{Time: periodEnd, Valid: true}

	tasksCompleted, _ := h.Queries.CountCompletedTasksInPeriod(r.Context(), db.CountCompletedTasksInPeriodParams{
		WorkspaceID: wsUUID,
		CompletedAt: startTS,
		CompletedAt_2: endTS,
	})

	tasksFailed, _ := h.Queries.CountFailedTasksInPeriod(r.Context(), db.CountFailedTasksInPeriodParams{
		WorkspaceID: wsUUID,
		CompletedAt: startTS,
		CompletedAt_2: endTS,
	})

	approvalsProcessed, _ := h.Queries.CountApprovalsInPeriod(r.Context(), db.CountApprovalsInPeriodParams{
		WorkspaceID: wsUUID,
		DecidedAt: startTS,
		DecidedAt_2: endTS,
	})

	issuesCreated, _ := h.Queries.CountIssuesCreatedInPeriod(r.Context(), db.CountIssuesCreatedInPeriodParams{
		WorkspaceID: wsUUID,
		CreatedAt: startTS,
		CreatedAt_2: endTS,
	})

	issuesCompleted, _ := h.Queries.CountIssuesCompletedInPeriod(r.Context(), db.CountIssuesCompletedInPeriodParams{
		WorkspaceID: wsUUID,
		UpdatedAt: startTS,
		UpdatedAt_2: endTS,
	})

	content := DigestContent{
		TasksCompleted:     tasksCompleted,
		TasksFailed:        tasksFailed,
		ApprovalsProcessed: approvalsProcessed,
		IssuesCreated:      issuesCreated,
		IssuesCompleted:    issuesCompleted,
	}

	contentBytes, _ := json.Marshal(content)

	digest, err := h.Queries.CreateWeeklyDigest(r.Context(), db.CreateWeeklyDigestParams{
		WorkspaceID: wsUUID,
		PeriodStart: pgtype.Date{Time: periodStart, Valid: true},
		PeriodEnd:   pgtype.Date{Time: periodEnd, Valid: true},
		Content:     contentBytes,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create digest")
		return
	}

	writeJSON(w, http.StatusCreated, weeklyDigestToResponse(digest))
}
