package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
	"github.com/multica-ai/multica/server/pkg/protocol"
)

// --- Request / Response types ---

type CreateEventTriggerRequest struct {
	Name           string `json:"name"`
	TriggerType    string `json:"trigger_type"`
	TriggerConfig  any    `json:"trigger_config"`
	AgentID        string `json:"agent_id"`
	PromptTemplate string `json:"prompt_template"`
	Enabled        *bool  `json:"enabled"`
}

type UpdateEventTriggerRequest struct {
	Name           *string `json:"name"`
	TriggerType    *string `json:"trigger_type"`
	TriggerConfig  any     `json:"trigger_config"`
	AgentID        *string `json:"agent_id"`
	PromptTemplate *string `json:"prompt_template"`
	Enabled        *bool   `json:"enabled"`
}

type EventTriggerResponse struct {
	ID             string  `json:"id"`
	WorkspaceID    string  `json:"workspace_id"`
	Name           string  `json:"name"`
	TriggerType    string  `json:"trigger_type"`
	TriggerConfig  any     `json:"trigger_config"`
	AgentID        string  `json:"agent_id"`
	PromptTemplate string  `json:"prompt_template"`
	Enabled        bool    `json:"enabled"`
	LastFiredAt    *string `json:"last_fired_at"`
	FireCount      int32   `json:"fire_count"`
	CreatedAt      string  `json:"created_at"`
	UpdatedAt      string  `json:"updated_at"`
}

func eventTriggerToResponse(t db.EventTrigger) EventTriggerResponse {
	var config any
	if len(t.TriggerConfig) > 0 {
		json.Unmarshal(t.TriggerConfig, &config)
	}
	return EventTriggerResponse{
		ID:             uuidToString(t.ID),
		WorkspaceID:    uuidToString(t.WorkspaceID),
		Name:           t.Name,
		TriggerType:    t.TriggerType,
		TriggerConfig:  config,
		AgentID:        uuidToString(t.AgentID),
		PromptTemplate: t.PromptTemplate,
		Enabled:        t.Enabled,
		LastFiredAt:    timestampToPtr(t.LastFiredAt),
		FireCount:      t.FireCount,
		CreatedAt:      timestampToString(t.CreatedAt),
		UpdatedAt:      timestampToString(t.UpdatedAt),
	}
}

// --- Handlers ---

func (h *Handler) ListEventTriggers(w http.ResponseWriter, r *http.Request) {
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

	triggers, err := h.Queries.ListEventTriggersByWorkspace(r.Context(), db.ListEventTriggersByWorkspaceParams{
		WorkspaceID: parseUUID(workspaceID),
		Limit:       int32(limit),
		Offset:      int32(offset),
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list event triggers")
		return
	}

	total, _ := h.Queries.CountEventTriggersByWorkspace(r.Context(), parseUUID(workspaceID))

	items := make([]EventTriggerResponse, len(triggers))
	for i, t := range triggers {
		items[i] = eventTriggerToResponse(t)
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"items": items,
		"total": total,
	})
}

func (h *Handler) CreateEventTrigger(w http.ResponseWriter, r *http.Request) {
	workspaceID := resolveWorkspaceID(r)
	if workspaceID == "" {
		writeError(w, http.StatusBadRequest, "workspace_id is required")
		return
	}

	var req CreateEventTriggerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Name == "" || req.TriggerType == "" || req.AgentID == "" || req.PromptTemplate == "" {
		writeError(w, http.StatusBadRequest, "name, trigger_type, agent_id, and prompt_template are required")
		return
	}

	switch req.TriggerType {
	case "webhook", "db_change", "agent_output", "github_event":
	default:
		writeError(w, http.StatusBadRequest, "trigger_type must be webhook, db_change, agent_output, or github_event")
		return
	}

	configBytes, _ := json.Marshal(req.TriggerConfig)

	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}

	trigger, err := h.Queries.CreateEventTrigger(r.Context(), db.CreateEventTriggerParams{
		WorkspaceID:    parseUUID(workspaceID),
		Name:           req.Name,
		TriggerType:    req.TriggerType,
		TriggerConfig:  configBytes,
		AgentID:        parseUUID(req.AgentID),
		PromptTemplate: req.PromptTemplate,
		Enabled:        enabled,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create event trigger")
		return
	}

	writeJSON(w, http.StatusCreated, eventTriggerToResponse(trigger))
}

func (h *Handler) GetEventTrigger(w http.ResponseWriter, r *http.Request) {
	workspaceID := resolveWorkspaceID(r)
	triggerID := chi.URLParam(r, "id")

	trigger, err := h.Queries.GetEventTriggerInWorkspace(r.Context(), db.GetEventTriggerInWorkspaceParams{
		ID:          parseUUID(triggerID),
		WorkspaceID: parseUUID(workspaceID),
	})
	if err != nil {
		writeError(w, http.StatusNotFound, "event trigger not found")
		return
	}

	writeJSON(w, http.StatusOK, eventTriggerToResponse(trigger))
}

func (h *Handler) UpdateEventTrigger(w http.ResponseWriter, r *http.Request) {
	workspaceID := resolveWorkspaceID(r)
	triggerID := chi.URLParam(r, "id")

	var req UpdateEventTriggerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	params := db.UpdateEventTriggerParams{
		ID:          parseUUID(triggerID),
		WorkspaceID: parseUUID(workspaceID),
	}
	if req.Name != nil {
		params.Name = pgtype.Text{String: *req.Name, Valid: true}
	}
	if req.TriggerType != nil {
		params.TriggerType = pgtype.Text{String: *req.TriggerType, Valid: true}
	}
	if req.TriggerConfig != nil {
		configBytes, _ := json.Marshal(req.TriggerConfig)
		params.TriggerConfig = configBytes
	}
	if req.AgentID != nil {
		params.AgentID = parseUUID(*req.AgentID)
	}
	if req.PromptTemplate != nil {
		params.PromptTemplate = pgtype.Text{String: *req.PromptTemplate, Valid: true}
	}
	if req.Enabled != nil {
		params.Enabled = pgtype.Bool{Bool: *req.Enabled, Valid: true}
	}

	trigger, err := h.Queries.UpdateEventTrigger(r.Context(), params)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update event trigger")
		return
	}

	writeJSON(w, http.StatusOK, eventTriggerToResponse(trigger))
}

func (h *Handler) DeleteEventTrigger(w http.ResponseWriter, r *http.Request) {
	workspaceID := resolveWorkspaceID(r)
	triggerID := chi.URLParam(r, "id")

	err := h.Queries.DeleteEventTrigger(r.Context(), db.DeleteEventTriggerParams{
		ID:          parseUUID(triggerID),
		WorkspaceID: parseUUID(workspaceID),
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to delete event trigger")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (h *Handler) ToggleEventTrigger(w http.ResponseWriter, r *http.Request) {
	workspaceID := resolveWorkspaceID(r)
	triggerID := chi.URLParam(r, "id")

	trigger, err := h.Queries.ToggleEventTrigger(r.Context(), db.ToggleEventTriggerParams{
		ID:          parseUUID(triggerID),
		WorkspaceID: parseUUID(workspaceID),
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to toggle event trigger")
		return
	}

	writeJSON(w, http.StatusOK, eventTriggerToResponse(trigger))
}

// FireWebhookTrigger handles incoming webhook calls (public, no auth).
func (h *Handler) FireWebhookTrigger(w http.ResponseWriter, r *http.Request) {
	triggerID := chi.URLParam(r, "triggerId")

	trigger, err := h.Queries.GetEventTrigger(r.Context(), parseUUID(triggerID))
	if err != nil {
		writeError(w, http.StatusNotFound, "trigger not found")
		return
	}

	if !trigger.Enabled {
		writeError(w, http.StatusConflict, "trigger is disabled")
		return
	}

	if trigger.TriggerType != "webhook" {
		writeError(w, http.StatusBadRequest, "trigger is not a webhook type")
		return
	}

	// Parse webhook body
	var body any
	json.NewDecoder(r.Body).Decode(&body)

	// Update fire count
	h.Queries.UpdateEventTriggerLastFired(r.Context(), trigger.ID)

	wsID := uuidToString(trigger.WorkspaceID)
	agentID := uuidToString(trigger.AgentID)

	h.publish(protocol.EventTriggerFired, wsID, "system", "", map[string]any{
		"trigger_id":   uuidToString(trigger.ID),
		"trigger_name": trigger.Name,
		"agent_id":     agentID,
		"webhook_body": body,
	})

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":         true,
		"trigger_id": uuidToString(trigger.ID),
		"fire_count": trigger.FireCount + 1,
	})
}
