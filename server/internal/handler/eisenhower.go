package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
)

// EisenhowerItem is a compact response for the Eisenhower Matrix view.
type EisenhowerItem struct {
	ID                 string  `json:"id"`
	Title              string  `json:"title"`
	Identifier         string  `json:"identifier"`
	Status             string  `json:"status"`
	Priority           string  `json:"priority"`
	AssigneeType       *string `json:"assignee_type"`
	AssigneeID         *string `json:"assignee_id"`
	Quadrant           string  `json:"eisenhower_quadrant"`
	DueDate            *string `json:"due_date"`
	Number             int32   `json:"number"`
}

type EisenhowerMatrixResponse struct {
	Items  []EisenhowerItem   `json:"items"`
	Counts map[string]int     `json:"counts"`
}

func eisenhowerRowToItem(row db.ListEisenhowerMatrixRow, prefix string) EisenhowerItem {
	return EisenhowerItem{
		ID:           uuidToString(row.ID),
		Title:        row.Title,
		Identifier:   prefix + "-" + strconv.Itoa(int(row.Number)),
		Status:       row.Status,
		Priority:     row.Priority,
		AssigneeType: textToPtr(row.AssigneeType),
		AssigneeID:   uuidToPtr(row.AssigneeID),
		Quadrant:     row.EisenhowerQuadrant.String,
		DueDate:      timestampToPtr(row.DueDate),
		Number:       row.Number,
	}
}

// ListEisenhowerMatrix returns all issues with an eisenhower quadrant set,
// grouped by quadrant with counts.
func (h *Handler) ListEisenhowerMatrix(w http.ResponseWriter, r *http.Request) {
	workspaceID := resolveWorkspaceID(r)
	if workspaceID == "" {
		writeError(w, http.StatusBadRequest, "workspace_id is required")
		return
	}
	wsUUID := parseUUID(workspaceID)
	ctx := r.Context()

	rows, err := h.Queries.ListEisenhowerMatrix(ctx, wsUUID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list eisenhower matrix")
		return
	}

	prefix := h.getIssuePrefix(ctx, wsUUID)

	items := make([]EisenhowerItem, len(rows))
	counts := map[string]int{
		"do":        0,
		"schedule":  0,
		"delegate":  0,
		"eliminate": 0,
	}

	for i, row := range rows {
		items[i] = eisenhowerRowToItem(row, prefix)
		if row.EisenhowerQuadrant.Valid {
			counts[row.EisenhowerQuadrant.String]++
		}
	}

	writeJSON(w, http.StatusOK, EisenhowerMatrixResponse{
		Items:  items,
		Counts: counts,
	})
}

// CountEisenhowerQuadrants returns the count of issues per quadrant.
func (h *Handler) CountEisenhowerQuadrants(w http.ResponseWriter, r *http.Request) {
	workspaceID := resolveWorkspaceID(r)
	if workspaceID == "" {
		writeError(w, http.StatusBadRequest, "workspace_id is required")
		return
	}

	rows, err := h.Queries.CountEisenhowerQuadrants(r.Context(), parseUUID(workspaceID))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to count eisenhower quadrants")
		return
	}

	counts := map[string]int{
		"do":        0,
		"schedule":  0,
		"delegate":  0,
		"eliminate": 0,
	}
	for _, row := range rows {
		if row.EisenhowerQuadrant.Valid {
			counts[row.EisenhowerQuadrant.String] = int(row.Count)
		}
	}

	writeJSON(w, http.StatusOK, counts)
}

// SetEisenhowerQuadrant sets (or clears) the eisenhower quadrant on a single issue.
func (h *Handler) SetEisenhowerQuadrant(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	issue, ok := h.loadIssueForUser(w, r, id)
	if !ok {
		return
	}

	var req struct {
		Quadrant *string `json:"eisenhower_quadrant"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	updated, err := h.Queries.SetEisenhowerQuadrant(r.Context(), db.SetEisenhowerQuadrantParams{
		ID:                 issue.ID,
		EisenhowerQuadrant: ptrToText(req.Quadrant),
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to set eisenhower quadrant")
		return
	}

	prefix := h.getIssuePrefix(r.Context(), updated.WorkspaceID)
	writeJSON(w, http.StatusOK, issueToResponse(updated, prefix))
}
