package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
	"github.com/multica-ai/multica/server/pkg/protocol"
)

// ClaimIssue allows an agent to atomically claim an issue.
// Uses optimistic locking — fails if claim_version has changed since the client last read.
func (h *Handler) ClaimIssue(w http.ResponseWriter, r *http.Request) {
	issueID := chi.URLParam(r, "id")
	var req struct {
		AgentID      string `json:"agent_id"`
		ClaimVersion int32  `json:"claim_version"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.AgentID == "" {
		writeError(w, http.StatusBadRequest, "agent_id is required")
		return
	}

	issue, err := h.Queries.ClaimIssue(r.Context(), db.ClaimIssueParams{
		ID:           parseUUID(issueID),
		ClaimedBy:    parseUUID(req.AgentID),
		ClaimVersion: req.ClaimVersion,
	})
	if err != nil {
		// Claim failed — another agent holds it or version mismatch
		writeError(w, http.StatusConflict, "issue already claimed or version mismatch")
		return
	}

	workspaceID := resolveWorkspaceID(r)
	userID := requestUserID(r)
	actorType, actorID := h.resolveActor(r, userID, workspaceID)
	h.publish(protocol.EventIssueClaimed, workspaceID, actorType, actorID, map[string]any{
		"issue_id": issueID,
		"agent_id": req.AgentID,
		"version":  issue.ClaimVersion,
	})
	prefix := h.getIssuePrefix(r.Context(), issue.WorkspaceID)
	writeJSON(w, http.StatusOK, issueToResponse(issue, prefix))
}

// UnclaimIssue releases an agent's claim on an issue.
func (h *Handler) UnclaimIssue(w http.ResponseWriter, r *http.Request) {
	issueID := chi.URLParam(r, "id")
	var req struct {
		AgentID string `json:"agent_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.AgentID == "" {
		writeError(w, http.StatusBadRequest, "agent_id is required")
		return
	}

	issue, err := h.Queries.UnclaimIssue(r.Context(), db.UnclaimIssueParams{
		ID:        parseUUID(issueID),
		ClaimedBy: parseUUID(req.AgentID),
	})
	if err != nil {
		writeError(w, http.StatusNotFound, "issue not found or not claimed by this agent")
		return
	}

	workspaceID := resolveWorkspaceID(r)
	userID := requestUserID(r)
	actorType, actorID := h.resolveActor(r, userID, workspaceID)
	h.publish(protocol.EventIssueUnclaimed, workspaceID, actorType, actorID, map[string]any{
		"issue_id": issueID,
		"agent_id": req.AgentID,
	})
	prefix := h.getIssuePrefix(r.Context(), issue.WorkspaceID)
	writeJSON(w, http.StatusOK, issueToResponse(issue, prefix))
}
