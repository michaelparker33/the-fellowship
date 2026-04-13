package scheduler

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/multica-ai/multica/server/internal/events"
	"github.com/multica-ai/multica/server/internal/util"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
	"github.com/multica-ai/multica/server/pkg/protocol"
)

// ScheduleIssueCreator creates issues for scheduled tasks and enqueues agent tasks.
type ScheduleIssueCreator struct {
	queries   *db.Queries
	txStarter interface{ Begin(ctx context.Context) (pgx.Tx, error) }
	bus       *events.Bus
}

// NewIssueCreator returns an IssueCreator for the scheduler.
func NewIssueCreator(queries *db.Queries, txStarter interface{ Begin(ctx context.Context) (pgx.Tx, error) }, bus *events.Bus) *ScheduleIssueCreator {
	return &ScheduleIssueCreator{queries: queries, txStarter: txStarter, bus: bus}
}

func (c *ScheduleIssueCreator) CreateScheduledIssue(ctx context.Context, workspaceID, agentID pgtype.UUID, title, prompt string) (db.Issue, error) {
	// Start a transaction for atomic issue number increment + creation.
	tx, err := c.txStarter.Begin(ctx)
	if err != nil {
		return db.Issue{}, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	qtx := c.queries.WithTx(tx)

	// Increment the workspace issue counter.
	issueNumber, err := qtx.IncrementIssueCounter(ctx, workspaceID)
	if err != nil {
		return db.Issue{}, fmt.Errorf("increment issue counter: %w", err)
	}

	// Create the issue assigned to the agent.
	issue, err := qtx.CreateIssue(ctx, db.CreateIssueParams{
		WorkspaceID:  workspaceID,
		Title:        title,
		Description:  pgtype.Text{String: prompt, Valid: true},
		Status:       "todo",
		Priority:     "medium",
		AssigneeType: pgtype.Text{String: "agent", Valid: true},
		AssigneeID:   agentID,
		CreatorType:  "system",
		CreatorID:    agentID, // system creates attributed to agent
		Number:       issueNumber,
	})
	if err != nil {
		return db.Issue{}, fmt.Errorf("create issue: %w", err)
	}

	// Enqueue an agent task for the issue.
	agent, err := qtx.GetAgent(ctx, agentID)
	if err != nil {
		return db.Issue{}, fmt.Errorf("get agent: %w", err)
	}

	if !agent.RuntimeID.Valid {
		// Commit the issue even if agent has no runtime — issue will sit in backlog.
		if err := tx.Commit(ctx); err != nil {
			return db.Issue{}, fmt.Errorf("commit: %w", err)
		}
		slog.Warn("scheduled issue created but agent has no runtime", "issue_id", util.UUIDToString(issue.ID))
		return issue, nil
	}

	_, err = qtx.CreateAgentTask(ctx, db.CreateAgentTaskParams{
		AgentID:   agentID,
		RuntimeID: agent.RuntimeID,
		IssueID:   issue.ID,
		Priority:  2, // medium
	})
	if err != nil {
		return db.Issue{}, fmt.Errorf("create agent task: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return db.Issue{}, fmt.Errorf("commit: %w", err)
	}

	// Publish issue created event so it shows up in real time.
	c.bus.Publish(events.Event{
		Type:        protocol.EventIssueCreated,
		WorkspaceID: util.UUIDToString(workspaceID),
		ActorType:   "system",
		ActorID:     "scheduler",
		Payload: map[string]any{
			"issue_id": util.UUIDToString(issue.ID),
		},
	})

	return issue, nil
}
