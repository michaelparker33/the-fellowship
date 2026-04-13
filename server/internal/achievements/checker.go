package achievements

import (
	"context"
	"encoding/json"
	"log/slog"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/multica-ai/multica/server/internal/events"
	"github.com/multica-ai/multica/server/pkg/protocol"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
)

const (
	KeyFirstLight         = "first_light"
	KeyCouncilConvenes    = "council_convenes"
	KeyRangersFirstReport = "rangers_first_report"
	KeyWhiteRider         = "white_rider"
	KeyNotAllWhoWander    = "not_all_who_wander"
	KeyGreyPilgrim        = "grey_pilgrim"
	KeyThereAndBackAgain  = "there_and_back_again"
)

type Checker struct {
	queries *db.Queries
	bus     *events.Bus
}

func New(queries *db.Queries, bus *events.Bus) *Checker {
	return &Checker{queries: queries, bus: bus}
}

func (c *Checker) RegisterListeners() {
	// first_light: first issue created in the workspace
	c.bus.Subscribe(protocol.EventIssueCreated, func(e events.Event) {
		wsID := e.WorkspaceID
		if wsID == "" {
			return
		}
		c.unlock(context.Background(), wsID, KeyFirstLight, nil)
	})

	// council_convenes: first approval created
	c.bus.Subscribe(protocol.EventApprovalCreated, func(e events.Event) {
		wsID := e.WorkspaceID
		if wsID == "" {
			return
		}
		c.unlock(context.Background(), wsID, KeyCouncilConvenes, nil)
	})

	// rangers_first_report: first scheduled task run (watch fired)
	c.bus.Subscribe(protocol.EventScheduledTaskFired, func(e events.Event) {
		wsID := e.WorkspaceID
		if wsID == "" {
			return
		}
		c.unlock(context.Background(), wsID, KeyRangersFirstReport, nil)
	})

	// white_rider: emergency stop activated
	c.bus.Subscribe(protocol.EventEmergencyStop, func(e events.Event) {
		wsID := e.WorkspaceID
		if wsID == "" {
			return
		}
		c.unlock(context.Background(), wsID, KeyWhiteRider, nil)
	})

	// grey_pilgrim: first agent task completed
	c.bus.Subscribe(protocol.EventTaskCompleted, func(e events.Event) {
		wsID := e.WorkspaceID
		if wsID == "" {
			return
		}
		c.unlock(context.Background(), wsID, KeyGreyPilgrim, nil)
	})

	// there_and_back_again: emergency stop deactivated (resume)
	c.bus.Subscribe(protocol.EventEmergencyResume, func(e events.Event) {
		wsID := e.WorkspaceID
		if wsID == "" {
			return
		}
		c.unlock(context.Background(), wsID, KeyThereAndBackAgain, nil)
	})
}

func (c *Checker) unlock(ctx context.Context, workspaceID, key string, metadata map[string]any) {
	var wsUUID pgtype.UUID
	if err := wsUUID.Scan(workspaceID); err != nil {
		return
	}

	metaBytes := []byte("{}")
	if metadata != nil {
		if b, err := json.Marshal(metadata); err == nil {
			metaBytes = b
		}
	}

	achievement, err := c.queries.UnlockAchievement(ctx, db.UnlockAchievementParams{
		WorkspaceID:    wsUUID,
		AchievementKey: key,
		Metadata:       metaBytes,
	})
	if err != nil {
		// ON CONFLICT DO NOTHING means empty result when already unlocked — not an error
		return
	}
	// Zero UUID means the INSERT was a no-op (already unlocked)
	if !achievement.ID.Valid {
		return
	}

	slog.Info("achievement unlocked", "workspace_id", workspaceID, "key", key)

	c.bus.Publish(events.Event{
		Type:        protocol.EventAchievementUnlocked,
		WorkspaceID: workspaceID,
		Payload: map[string]any{
			"achievement_key": key,
		},
	})
}
