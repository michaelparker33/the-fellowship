package scheduler

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/robfig/cron/v3"

	"github.com/multica-ai/multica/server/internal/events"
	"github.com/multica-ai/multica/server/internal/util"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
	"github.com/multica-ai/multica/server/pkg/protocol"
)

// IssueCreator abstracts the ability to create an issue and enqueue a task,
// so the scheduler doesn't depend on the full handler package.
type IssueCreator interface {
	CreateScheduledIssue(ctx context.Context, workspaceID, agentID pgtype.UUID, title, prompt string) (db.Issue, error)
}

// Scheduler manages cron jobs for scheduled tasks.
type Scheduler struct {
	cron     *cron.Cron
	queries  *db.Queries
	bus      *events.Bus
	creator  IssueCreator
	mu       sync.Mutex
	entries  map[string]cron.EntryID // scheduledTaskID -> cronEntryID
}

// New creates a new Scheduler.
func New(queries *db.Queries, bus *events.Bus, creator IssueCreator) *Scheduler {
	return &Scheduler{
		cron:    cron.New(cron.WithSeconds()),
		queries: queries,
		bus:     bus,
		creator: creator,
		entries: make(map[string]cron.EntryID),
	}
}

// Start loads all enabled tasks and starts the cron runner.
func (s *Scheduler) Start(ctx context.Context) {
	tasks, err := s.queries.ListEnabledScheduledTasks(ctx)
	if err != nil {
		slog.Error("scheduler: failed to load tasks", "error", err)
		return
	}

	for _, task := range tasks {
		if err := s.addCronEntry(task); err != nil {
			slog.Error("scheduler: failed to register task", "task_id", util.UUIDToString(task.ID), "name", task.Name, "error", err)
		}
	}

	s.cron.Start()
	slog.Info("scheduler started", "tasks_loaded", len(tasks))
}

// Stop gracefully stops the cron runner.
func (s *Scheduler) Stop() {
	ctx := s.cron.Stop()
	<-ctx.Done()
	slog.Info("scheduler stopped")
}

// Add registers a new scheduled task.
func (s *Scheduler) Add(task db.ScheduledTask) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.addCronEntry(task)
}

// Remove unregisters a scheduled task.
func (s *Scheduler) Remove(taskID string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if entryID, ok := s.entries[taskID]; ok {
		s.cron.Remove(entryID)
		delete(s.entries, taskID)
	}
}

// Reload removes and re-adds a task (for updates).
func (s *Scheduler) Reload(task db.ScheduledTask) error {
	taskID := util.UUIDToString(task.ID)
	s.Remove(taskID)
	if task.Enabled {
		return s.Add(task)
	}
	return nil
}

// TriggerNow executes a task immediately outside the schedule.
func (s *Scheduler) TriggerNow(ctx context.Context, task db.ScheduledTask) {
	go s.fireTask(task)
}

func (s *Scheduler) addCronEntry(task db.ScheduledTask) error {
	taskID := util.UUIDToString(task.ID)

	// Parse timezone
	loc, err := time.LoadLocation(task.Timezone)
	if err != nil {
		loc = time.UTC
	}

	// robfig/cron/v3 with WithSeconds expects 6 fields.
	// Standard 5-field cron needs "0 " prefix for seconds.
	cronExpr := "0 " + task.CronExpression

	// Create a timezone-aware schedule
	parser := cron.NewParser(cron.Second | cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow)
	schedule, err := parser.Parse(cronExpr)
	if err != nil {
		return fmt.Errorf("invalid cron expression %q: %w", task.CronExpression, err)
	}

	// Wrap in timezone schedule
	tzSchedule := &tzSched{schedule: schedule, loc: loc}

	captured := task // capture for closure
	entryID := s.cron.Schedule(tzSchedule, cron.FuncJob(func() {
		s.fireTask(captured)
	}))

	s.entries[taskID] = entryID
	return nil
}

func (s *Scheduler) fireTask(task db.ScheduledTask) {
	ctx := context.Background()
	start := time.Now()
	taskID := util.UUIDToString(task.ID)
	wsID := util.UUIDToString(task.WorkspaceID)

	slog.Info("scheduler: firing task", "task_id", taskID, "name", task.Name)

	// Create a run record
	run, err := s.queries.CreateScheduledTaskRun(ctx, db.CreateScheduledTaskRunParams{
		ScheduledTaskID: task.ID,
		Status:          "running",
	})
	if err != nil {
		slog.Error("scheduler: failed to create run record", "task_id", taskID, "error", err)
		return
	}

	// Create an issue assigned to the agent
	title := fmt.Sprintf("[%s] Scheduled run — %s", task.Name, time.Now().Format("2006-01-02 15:04"))
	issue, err := s.creator.CreateScheduledIssue(ctx, task.WorkspaceID, task.AgentID, title, task.Prompt)

	duration := int32(time.Since(start).Milliseconds())

	if err != nil {
		slog.Error("scheduler: failed to create issue", "task_id", taskID, "error", err)
		s.queries.UpdateScheduledTaskRun(ctx, db.UpdateScheduledTaskRunParams{
			ID:           run.ID,
			Status:       "failed",
			DurationMs:   pgtype.Int4{Int32: duration, Valid: true},
			ErrorMessage: pgtype.Text{String: err.Error(), Valid: true},
		})
		s.queries.UpdateScheduledTaskLastRun(ctx, db.UpdateScheduledTaskLastRunParams{
			ID:           task.ID,
			LastStatus:   pgtype.Text{String: "failed", Valid: true},
			LastDurationMs: pgtype.Int4{Int32: duration, Valid: true},
		})
		return
	}

	// Update run with success and issue link
	s.queries.UpdateScheduledTaskRun(ctx, db.UpdateScheduledTaskRunParams{
		ID:         run.ID,
		Status:     "success",
		DurationMs: pgtype.Int4{Int32: duration, Valid: true},
	})
	s.queries.UpdateScheduledTaskLastRun(ctx, db.UpdateScheduledTaskLastRunParams{
		ID:           task.ID,
		LastStatus:   pgtype.Text{String: "success", Valid: true},
		LastDurationMs: pgtype.Int4{Int32: duration, Valid: true},
	})

	// Broadcast event
	s.bus.Publish(events.Event{
		Type:        protocol.EventScheduledTaskFired,
		WorkspaceID: wsID,
		ActorType:   "system",
		ActorID:     "scheduler",
		Payload: map[string]any{
			"task_id":   taskID,
			"task_name": task.Name,
			"issue_id":  util.UUIDToString(issue.ID),
		},
	})

	slog.Info("scheduler: task fired successfully", "task_id", taskID, "issue_id", util.UUIDToString(issue.ID))
}

// tzSched wraps a cron.Schedule to apply timezone.
type tzSched struct {
	schedule cron.Schedule
	loc      *time.Location
}

func (s *tzSched) Next(t time.Time) time.Time {
	return s.schedule.Next(t.In(s.loc))
}
