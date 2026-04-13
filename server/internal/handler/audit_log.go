package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/jackc/pgx/v5/pgtype"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
)

// WriteAuditLog is called internally to record an immutable audit event.
func (h *Handler) WriteAuditLog(ctx context.Context, workspaceID, actorType, actorID, action, entityType string, entityID pgtype.UUID, payload map[string]any) {
	payloadBytes, _ := json.Marshal(payload)
	_, _ = h.Queries.CreateAuditLog(ctx, db.CreateAuditLogParams{
		WorkspaceID: parseUUID(workspaceID),
		ActorType:   actorType,
		ActorID:     parseUUID(actorID),
		Action:      action,
		EntityType:  entityType,
		EntityID:    entityID,
		Payload:     payloadBytes,
	})
}

type AuditLogResponse struct {
	ID         string         `json:"id"`
	ActorType  string         `json:"actor_type"`
	ActorID    string         `json:"actor_id"`
	Action     string         `json:"action"`
	EntityType string         `json:"entity_type"`
	EntityID   string         `json:"entity_id,omitempty"`
	Payload    map[string]any `json:"payload"`
	CreatedAt  string         `json:"created_at"`
}

func (h *Handler) ListAuditLogs(w http.ResponseWriter, r *http.Request) {
	workspaceID := resolveWorkspaceID(r)
	if workspaceID == "" {
		writeError(w, http.StatusBadRequest, "workspace_id is required")
		return
	}

	entityType := r.URL.Query().Get("entity_type")
	entityIDStr := r.URL.Query().Get("entity_id")

	limit := int32(100)
	offset := int32(0)
	if l := r.URL.Query().Get("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil {
			limit = int32(n)
		}
	}
	if o := r.URL.Query().Get("offset"); o != "" {
		if n, err := strconv.Atoi(o); err == nil {
			offset = int32(n)
		}
	}

	var entityID pgtype.UUID
	if entityIDStr != "" {
		entityID = parseUUID(entityIDStr)
	}

	rows, err := h.Queries.ListAuditLogs(r.Context(), db.ListAuditLogsParams{
		WorkspaceID: parseUUID(workspaceID),
		Column2:     entityType,
		Column3:     entityID,
		Limit:       limit,
		Offset:      offset,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list audit logs")
		return
	}

	items := make([]AuditLogResponse, 0, len(rows))
	for _, row := range rows {
		var payload map[string]any
		_ = json.Unmarshal(row.Payload, &payload)
		items = append(items, AuditLogResponse{
			ID:         uuidToString(row.ID),
			ActorType:  row.ActorType,
			ActorID:    uuidToString(row.ActorID),
			Action:     row.Action,
			EntityType: row.EntityType,
			EntityID:   uuidToString(row.EntityID),
			Payload:    payload,
			CreatedAt:  timestampToString(row.CreatedAt),
		})
	}

	writeJSON(w, http.StatusOK, map[string]any{"items": items, "total": len(items)})
}
