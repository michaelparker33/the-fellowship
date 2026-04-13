package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
	"github.com/multica-ai/multica/server/pkg/protocol"
)

type GoalResponse struct {
	ID           string  `json:"id"`
	WorkspaceID  string  `json:"workspace_id"`
	Title        string  `json:"title"`
	Description  *string `json:"description,omitempty"`
	ParentGoalID *string `json:"parent_goal_id,omitempty"`
	CreatedAt    string  `json:"created_at"`
	UpdatedAt    string  `json:"updated_at"`
}

func goalToResponse(g db.Goal) GoalResponse {
	resp := GoalResponse{
		ID:          uuidToString(g.ID),
		WorkspaceID: uuidToString(g.WorkspaceID),
		Title:       g.Title,
		CreatedAt:   timestampToString(g.CreatedAt),
		UpdatedAt:   timestampToString(g.UpdatedAt),
	}
	if g.Description.Valid {
		s := g.Description.String
		resp.Description = &s
	}
	if g.ParentGoalID.Valid {
		s := uuidToString(g.ParentGoalID)
		resp.ParentGoalID = &s
	}
	return resp
}

func (h *Handler) ListGoals(w http.ResponseWriter, r *http.Request) {
	workspaceID := resolveWorkspaceID(r)
	if workspaceID == "" {
		writeError(w, http.StatusBadRequest, "workspace_id is required")
		return
	}
	goals, err := h.Queries.ListGoals(r.Context(), parseUUID(workspaceID))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list goals")
		return
	}
	items := make([]GoalResponse, len(goals))
	for i, g := range goals {
		items[i] = goalToResponse(g)
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) CreateGoal(w http.ResponseWriter, r *http.Request) {
	workspaceID := resolveWorkspaceID(r)
	if workspaceID == "" {
		writeError(w, http.StatusBadRequest, "workspace_id is required")
		return
	}
	var req struct {
		Title        string  `json:"title"`
		Description  *string `json:"description"`
		ParentGoalID *string `json:"parent_goal_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Title == "" {
		writeError(w, http.StatusBadRequest, "title is required")
		return
	}

	desc := pgtype.Text{}
	if req.Description != nil {
		desc = pgtype.Text{String: *req.Description, Valid: true}
	}
	var parentID pgtype.UUID
	if req.ParentGoalID != nil {
		parentID = parseUUID(*req.ParentGoalID)
	}

	goal, err := h.Queries.CreateGoal(r.Context(), db.CreateGoalParams{
		WorkspaceID:  parseUUID(workspaceID),
		Title:        req.Title,
		Description:  desc,
		ParentGoalID: parentID,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create goal")
		return
	}

	userID := requestUserID(r)
	actorType, actorID := h.resolveActor(r, userID, workspaceID)
	h.publish(protocol.EventGoalCreated, workspaceID, actorType, actorID, map[string]any{"goal": goalToResponse(goal)})
	writeJSON(w, http.StatusCreated, goalToResponse(goal))
}

func (h *Handler) GetGoal(w http.ResponseWriter, r *http.Request) {
	workspaceID := resolveWorkspaceID(r)
	id := chi.URLParam(r, "id")
	goal, err := h.Queries.GetGoal(r.Context(), db.GetGoalParams{
		ID:          parseUUID(id),
		WorkspaceID: parseUUID(workspaceID),
	})
	if err != nil {
		writeError(w, http.StatusNotFound, "goal not found")
		return
	}
	writeJSON(w, http.StatusOK, goalToResponse(goal))
}

func (h *Handler) UpdateGoal(w http.ResponseWriter, r *http.Request) {
	workspaceID := resolveWorkspaceID(r)
	id := chi.URLParam(r, "id")

	// Fetch existing first so COALESCE has a default
	existing, err := h.Queries.GetGoal(r.Context(), db.GetGoalParams{
		ID:          parseUUID(id),
		WorkspaceID: parseUUID(workspaceID),
	})
	if err != nil {
		writeError(w, http.StatusNotFound, "goal not found")
		return
	}

	var req struct {
		Title        *string `json:"title"`
		Description  *string `json:"description"`
		ParentGoalID *string `json:"parent_goal_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	title := existing.Title
	if req.Title != nil {
		title = *req.Title
	}
	desc := existing.Description
	if req.Description != nil {
		desc = pgtype.Text{String: *req.Description, Valid: true}
	}
	parentID := existing.ParentGoalID
	if req.ParentGoalID != nil {
		parentID = parseUUID(*req.ParentGoalID)
	}

	goal, err := h.Queries.UpdateGoal(r.Context(), db.UpdateGoalParams{
		ID:           parseUUID(id),
		WorkspaceID:  parseUUID(workspaceID),
		Title:        title,
		Description:  desc,
		ParentGoalID: parentID,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update goal")
		return
	}
	writeJSON(w, http.StatusOK, goalToResponse(goal))
}

func (h *Handler) DeleteGoal(w http.ResponseWriter, r *http.Request) {
	workspaceID := resolveWorkspaceID(r)
	id := chi.URLParam(r, "id")
	if err := h.Queries.DeleteGoal(r.Context(), db.DeleteGoalParams{
		ID:          parseUUID(id),
		WorkspaceID: parseUUID(workspaceID),
	}); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to delete goal")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) GetGoalChain(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	chain, err := h.Queries.GetGoalChain(r.Context(), parseUUID(id))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to get goal chain")
		return
	}
	items := make([]GoalResponse, len(chain))
	for i, g := range chain {
		items[i] = goalToResponse(db.Goal{
			ID:           g.ID,
			WorkspaceID:  g.WorkspaceID,
			Title:        g.Title,
			Description:  g.Description,
			ParentGoalID: g.ParentGoalID,
			CreatedAt:    g.CreatedAt,
			UpdatedAt:    g.UpdatedAt,
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{"chain": items})
}

func (h *Handler) SetIssueGoal(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req struct {
		GoalID *string `json:"goal_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	var goalID pgtype.UUID
	if req.GoalID != nil {
		goalID = parseUUID(*req.GoalID)
	}
	issue, err := h.Queries.SetIssueGoal(r.Context(), db.SetIssueGoalParams{
		ID:     parseUUID(id),
		GoalID: goalID,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to set issue goal")
		return
	}
	prefix := h.getIssuePrefix(r.Context(), issue.WorkspaceID)
	writeJSON(w, http.StatusOK, issueToResponse(issue, prefix))
}
