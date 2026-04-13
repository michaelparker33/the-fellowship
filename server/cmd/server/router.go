package main

import (
	"context"
	"net/http"
	"os"
	"strings"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/multica-ai/multica/server/internal/auth"
	"github.com/multica-ai/multica/server/internal/events"
	"github.com/multica-ai/multica/server/internal/handler"
	"github.com/multica-ai/multica/server/internal/middleware"
	"github.com/multica-ai/multica/server/internal/realtime"
	"github.com/multica-ai/multica/server/internal/service"
	"github.com/multica-ai/multica/server/internal/storage"
	"github.com/multica-ai/multica/server/internal/util"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
)

var defaultOrigins = []string{
	"http://localhost:3000", // Next.js dev
	"http://localhost:5173", // electron-vite dev
	"http://localhost:5174", // electron-vite dev (fallback port)
}

func allowedOrigins() []string {
	raw := strings.TrimSpace(os.Getenv("CORS_ALLOWED_ORIGINS"))
	if raw == "" {
		raw = strings.TrimSpace(os.Getenv("FRONTEND_ORIGIN"))
	}
	if raw == "" {
		return defaultOrigins
	}

	parts := strings.Split(raw, ",")
	origins := make([]string, 0, len(parts))
	for _, part := range parts {
		origin := strings.TrimSpace(part)
		if origin != "" {
			origins = append(origins, origin)
		}
	}
	if len(origins) == 0 {
		return defaultOrigins
	}
	return origins
}

// NewRouter creates the fully-configured Chi router with all middleware and routes.
func NewRouter(pool *pgxpool.Pool, hub *realtime.Hub, bus *events.Bus) chi.Router {
	queries := db.New(pool)
	emailSvc := service.NewEmailService()

	// File storage: prefer S3, fall back to local filesystem for dev
	var fileStore storage.FileStorage
	if s3 := storage.NewS3StorageFromEnv(); s3 != nil {
		fileStore = s3
	} else {
		port := os.Getenv("PORT")
		if port == "" {
			port = "8080"
		}
		fileStore = storage.NewLocalStorage("./uploads", "http://localhost:"+port+"/uploads")
	}

	cfSigner := auth.NewCloudFrontSignerFromEnv()
	h := handler.New(queries, pool, hub, bus, emailSvc, fileStore, cfSigner)

	r := chi.NewRouter()

	// Global middleware
	r.Use(chimw.RequestID)
	r.Use(middleware.RequestLogger)
	r.Use(chimw.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   allowedOrigins(),
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-Workspace-ID", "X-Request-ID", "X-Agent-ID", "X-Task-ID"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Serve local uploads (dev only — production uses S3/CloudFront)
	r.Handle("/uploads/*", http.StripPrefix("/uploads/", http.FileServer(http.Dir("./uploads"))))

	// Public webhook endpoint (no auth)
	r.Post("/api/webhooks/{triggerId}", h.FireWebhookTrigger)

	// Health check
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok"}`))
	})

	// WebSocket
	mc := &membershipChecker{queries: queries}
	pr := &patResolver{queries: queries}
	r.Get("/ws", func(w http.ResponseWriter, r *http.Request) {
		realtime.HandleWebSocket(hub, mc, pr, w, r)
	})

	// Auth (public)
	r.Post("/auth/send-code", h.SendCode)
	r.Post("/auth/verify-code", h.VerifyCode)
	r.Post("/auth/google", h.GoogleLogin)
	r.Post("/auth/dev-login", h.DevLogin)

	// Daemon API routes (require daemon token or valid user token)
	r.Route("/api/daemon", func(r chi.Router) {
		r.Use(middleware.DaemonAuth(queries))

		r.Post("/register", h.DaemonRegister)
		r.Post("/deregister", h.DaemonDeregister)
		r.Post("/heartbeat", h.DaemonHeartbeat)

		r.Post("/runtimes/{runtimeId}/tasks/claim", h.ClaimTaskByRuntime)
		r.Get("/runtimes/{runtimeId}/tasks/pending", h.ListPendingTasksByRuntime)
		r.Post("/runtimes/{runtimeId}/usage", h.ReportRuntimeUsage)
		r.Post("/runtimes/{runtimeId}/ping/{pingId}/result", h.ReportPingResult)
		r.Post("/runtimes/{runtimeId}/update/{updateId}/result", h.ReportUpdateResult)

		r.Get("/tasks/{taskId}/status", h.GetTaskStatus)
		r.Post("/tasks/{taskId}/start", h.StartTask)
		r.Post("/tasks/{taskId}/progress", h.ReportTaskProgress)
		r.Post("/tasks/{taskId}/complete", h.CompleteTask)
		r.Post("/tasks/{taskId}/fail", h.FailTask)
		r.Post("/tasks/{taskId}/usage", h.ReportTaskUsage)
		r.Post("/tasks/{taskId}/messages", h.ReportTaskMessages)
		r.Get("/tasks/{taskId}/messages", h.ListTaskMessages)
	})

	// Protected API routes
	r.Group(func(r chi.Router) {
		r.Use(middleware.Auth(queries))
		r.Use(middleware.RefreshCloudFrontCookies(cfSigner))

		// --- User-scoped routes (no workspace context required) ---
		r.Get("/api/me", h.GetMe)
		r.Patch("/api/me", h.UpdateMe)
		r.Post("/api/upload-file", h.UploadFile)

		r.Route("/api/workspaces", func(r chi.Router) {
			r.Get("/", h.ListWorkspaces)
			r.Post("/", h.CreateWorkspace)
			r.Route("/{id}", func(r chi.Router) {
				// Member-level access
				r.Group(func(r chi.Router) {
					r.Use(middleware.RequireWorkspaceMemberFromURL(queries, "id"))
					r.Get("/", h.GetWorkspace)
					r.Get("/members", h.ListMembersWithUser)
					r.Post("/leave", h.LeaveWorkspace)
				})
				// Admin-level access
				r.Group(func(r chi.Router) {
					r.Use(middleware.RequireWorkspaceRoleFromURL(queries, "id", "owner", "admin"))
					r.Put("/", h.UpdateWorkspace)
					r.Patch("/", h.UpdateWorkspace)
					r.Post("/members", h.CreateMember)
					r.Route("/members/{memberId}", func(r chi.Router) {
						r.Patch("/", h.UpdateMember)
						r.Delete("/", h.DeleteMember)
					})
				})
				// Owner-only access
				r.With(middleware.RequireWorkspaceRoleFromURL(queries, "id", "owner")).Delete("/", h.DeleteWorkspace)
			})
		})

		r.Route("/api/tokens", func(r chi.Router) {
			r.Get("/", h.ListPersonalAccessTokens)
			r.Post("/", h.CreatePersonalAccessToken)
			r.Delete("/{id}", h.RevokePersonalAccessToken)
		})

		// --- Workspace-scoped routes (all require workspace membership) ---
		r.Group(func(r chi.Router) {
			r.Use(middleware.RequireWorkspaceMember(queries))
			r.Use(middleware.FieldSelection)

			// Unified search
			r.Get("/api/search", h.UnifiedSearch)

			// Assignee frequency
			r.Get("/api/assignee-frequency", h.GetAssigneeFrequency)

			// Issues
			r.Route("/api/issues", func(r chi.Router) {
				r.Get("/search", h.SearchIssues)
				r.Get("/", h.ListIssues)
				r.Post("/", h.CreateIssue)
				r.Post("/batch-update", h.BatchUpdateIssues)
				r.Post("/batch-delete", h.BatchDeleteIssues)
				r.Route("/{id}", func(r chi.Router) {
					r.Get("/", h.GetIssue)
					r.Put("/", h.UpdateIssue)
					r.Delete("/", h.DeleteIssue)
					r.Post("/comments", h.CreateComment)
					r.Get("/comments", h.ListComments)
					r.Get("/timeline", h.ListTimeline)
					r.Get("/subscribers", h.ListIssueSubscribers)
					r.Post("/subscribe", h.SubscribeToIssue)
					r.Post("/unsubscribe", h.UnsubscribeFromIssue)
					r.Get("/active-task", h.GetActiveTaskForIssue)
					r.Post("/tasks/{taskId}/cancel", h.CancelTask)
					r.Get("/task-runs", h.ListTasksByIssue)
					r.Get("/tasks/{taskId}/continuations", h.GetTaskContinuationChain)
					r.Get("/usage", h.GetIssueUsage)
					r.Post("/reactions", h.AddIssueReaction)
					r.Delete("/reactions", h.RemoveIssueReaction)
					r.Get("/attachments", h.ListAttachments)
					r.Get("/children", h.ListChildIssues)
				})
			})

			// Projects
			r.Route("/api/projects", func(r chi.Router) {
				r.Get("/search", h.SearchProjects)
				r.Get("/", h.ListProjects)
				r.With(middleware.RequireWorkspaceRole(queries, "owner", "admin")).Post("/", h.CreateProject)
				r.Route("/{id}", func(r chi.Router) {
					r.Get("/", h.GetProject)
					r.With(middleware.RequireWorkspaceRole(queries, "owner", "admin")).Put("/", h.UpdateProject)
					r.With(middleware.RequireWorkspaceRole(queries, "owner", "admin")).Delete("/", h.DeleteProject)
				})
			})

			// Pins
			r.Route("/api/pins", func(r chi.Router) {
				r.Get("/", h.ListPins)
				r.Post("/", h.CreatePin)
				r.Put("/reorder", h.ReorderPins)
				r.Delete("/{itemType}/{itemId}", h.DeletePin)
			})

			// Attachments
			r.Get("/api/attachments/{id}", h.GetAttachmentByID)
			r.Delete("/api/attachments/{id}", h.DeleteAttachment)

			// Comments
			r.Route("/api/comments/{commentId}", func(r chi.Router) {
				r.Put("/", h.UpdateComment)
				r.Delete("/", h.DeleteComment)
				r.Post("/reactions", h.AddReaction)
				r.Delete("/reactions", h.RemoveReaction)
			})

			// Agents
			r.Route("/api/agents", func(r chi.Router) {
				r.Get("/", h.ListAgents)
				r.With(middleware.RequireWorkspaceRole(queries, "owner", "admin")).Post("/", h.CreateAgent)
				r.Route("/{id}", func(r chi.Router) {
					r.Get("/", h.GetAgent)
					r.Put("/", h.UpdateAgent)
					r.Post("/archive", h.ArchiveAgent)
					r.Post("/restore", h.RestoreAgent)
					r.Get("/tasks", h.ListAgentTasks)
					r.Get("/skills", h.ListAgentSkills)
					r.Put("/skills", h.SetAgentSkills)
				})
			})

			// Skills
			r.Route("/api/skills", func(r chi.Router) {
				r.Get("/", h.ListSkills)
				r.With(middleware.RequireWorkspaceRole(queries, "owner", "admin")).Post("/", h.CreateSkill)
				r.With(middleware.RequireWorkspaceRole(queries, "owner", "admin")).Post("/import", h.ImportSkill)
				r.Route("/{id}", func(r chi.Router) {
					r.Get("/", h.GetSkill)
					r.Put("/", h.UpdateSkill)
					r.Delete("/", h.DeleteSkill)
					r.Get("/files", h.ListSkillFiles)
					r.Put("/files", h.UpsertSkillFile)
					r.Delete("/files/{fileId}", h.DeleteSkillFile)
				})
			})

			// Usage
			r.Route("/api/usage", func(r chi.Router) {
				r.Get("/daily", h.GetWorkspaceUsageByDay)
				r.Get("/summary", h.GetWorkspaceUsageSummary)
				r.Get("/by-agent", h.GetWorkspaceUsageByAgent)
				r.Get("/daily-spend", h.GetWorkspaceDailySpend)
			})

			// Runtimes
			r.Route("/api/runtimes", func(r chi.Router) {
				r.Get("/", h.ListAgentRuntimes)
				r.Route("/{runtimeId}", func(r chi.Router) {
					r.Get("/usage", h.GetRuntimeUsage)
					r.Get("/activity", h.GetRuntimeTaskActivity)
					r.Post("/ping", h.InitiatePing)
					r.Get("/ping/{pingId}", h.GetPing)
					r.Post("/update", h.InitiateUpdate)
					r.Get("/update/{updateId}", h.GetUpdate)
					r.Delete("/", h.DeleteAgentRuntime)
				})
			})

			// Tasks (user-facing, with ownership check)
			r.Post("/api/tasks/{taskId}/cancel", h.CancelTaskByUser)

			r.Route("/api/chat/sessions", func(r chi.Router) {
				r.Post("/", h.CreateChatSession)
				r.Get("/", h.ListChatSessions)
				r.Route("/{sessionId}", func(r chi.Router) {
					r.Get("/", h.GetChatSession)
					r.Delete("/", h.ArchiveChatSession)
					r.Post("/messages", h.SendChatMessage)
					r.Get("/messages", h.ListChatMessages)
				})
			})

			// Achievements
			r.Get("/api/achievements", h.ListAchievements)

			// Safety Controls
			r.Route("/api/safety", func(r chi.Router) {
				r.Get("/", h.GetSafetyConfig)
				r.With(middleware.RequireWorkspaceRole(queries, "owner", "admin")).Put("/", h.UpdateSafetyConfig)
				r.With(middleware.RequireWorkspaceRole(queries, "owner", "admin")).Post("/emergency-stop", h.ActivateEmergencyStop)
				r.With(middleware.RequireWorkspaceRole(queries, "owner", "admin")).Post("/resume", h.DeactivateEmergencyStop)
			})

			// Scheduled Tasks (The Watch)
			r.Route("/api/scheduled-tasks", func(r chi.Router) {
				r.Get("/", h.ListScheduledTasks)
				r.Get("/enabled-count", h.CountEnabledScheduledTasks)
				r.With(middleware.RequireWorkspaceRole(queries, "owner", "admin")).Post("/", h.CreateScheduledTask)
				r.Route("/{id}", func(r chi.Router) {
					r.Get("/", h.GetScheduledTask)
					r.With(middleware.RequireWorkspaceRole(queries, "owner", "admin")).Put("/", h.UpdateScheduledTask)
					r.With(middleware.RequireWorkspaceRole(queries, "owner", "admin")).Delete("/", h.DeleteScheduledTask)
					r.With(middleware.RequireWorkspaceRole(queries, "owner", "admin")).Put("/toggle", h.ToggleScheduledTask)
					r.With(middleware.RequireWorkspaceRole(queries, "owner", "admin")).Post("/trigger", h.TriggerScheduledTask)
					r.Get("/runs", h.ListScheduledTaskRuns)
				})
			})

			// Approvals (The Council)
			r.Route("/api/approvals", func(r chi.Router) {
				r.Get("/", h.ListApprovals)
				r.Get("/pending-count", h.CountPendingApprovals)
				r.Get("/contested", h.ListContestedApprovals)
				r.Get("/dry-runs", h.ListDryRunResults)
				r.Post("/", h.CreateApproval)
				r.Post("/batch-approve", h.BatchApproveApprovals)
				r.Post("/batch-reject", h.BatchRejectApprovals)
				r.Put("/{id}/approve", h.ApproveApproval)
				r.Put("/{id}/reject", h.RejectApproval)
				r.Post("/{id}/debate", h.SubmitDebateVote)
				r.Post("/{id}/dry-run", h.ExecuteDryRun)
			})
			r.Route("/api/approval-configs", func(r chi.Router) {
				r.Get("/", h.ListApprovalConfigs)
				r.With(middleware.RequireWorkspaceRole(queries, "owner", "admin")).Put("/{actionType}", h.UpdateApprovalConfig)
				r.With(middleware.RequireWorkspaceRole(queries, "owner", "admin")).Put("/{actionType}/auto-approve", h.SetAutoApprove)
				r.With(middleware.RequireWorkspaceRole(queries, "owner", "admin")).Put("/{actionType}/dry-run", h.UpdateApprovalConfigDryRun)
			})

			// Escalations (Loop Detection)
			r.Route("/api/escalations", func(r chi.Router) {
				r.Get("/", h.ListEscalatedLoopDetections)
				r.Get("/count", h.CountEscalatedLoopDetections)
				r.Put("/{id}/resolve", h.ResolveLoopDetection)
			})

			// Trust Scores
			r.Route("/api/trust-scores", func(r chi.Router) {
				r.Get("/", h.ListTrustScores)
				r.Get("/promotions", h.ListPromotionSuggestions)
				r.With(middleware.RequireWorkspaceRole(queries, "owner", "admin")).Post("/{id}/dismiss", h.DismissPromotion)
				r.With(middleware.RequireWorkspaceRole(queries, "owner", "admin")).Post("/{id}/accept", h.AcceptPromotion)
			})

			// Event Triggers (The Watch)
			r.Route("/api/event-triggers", func(r chi.Router) {
				r.Get("/", h.ListEventTriggers)
				r.With(middleware.RequireWorkspaceRole(queries, "owner", "admin")).Post("/", h.CreateEventTrigger)
				r.Route("/{id}", func(r chi.Router) {
					r.Get("/", h.GetEventTrigger)
					r.With(middleware.RequireWorkspaceRole(queries, "owner", "admin")).Put("/", h.UpdateEventTrigger)
					r.With(middleware.RequireWorkspaceRole(queries, "owner", "admin")).Delete("/", h.DeleteEventTrigger)
					r.With(middleware.RequireWorkspaceRole(queries, "owner", "admin")).Put("/toggle", h.ToggleEventTrigger)
				})
			})

			// Shadow Mode
			r.Route("/api/shadow", func(r chi.Router) {
				r.Get("/runs", h.ListShadowRuns)
				r.Get("/stats", h.GetShadowStats)
				r.Put("/runs/{id}/rate", h.RateShadowRun)
				r.Get("/configs", h.ListShadowConfigs)
				r.With(middleware.RequireWorkspaceRole(queries, "owner", "admin")).Post("/configs", h.UpsertShadowConfig)
				r.With(middleware.RequireWorkspaceRole(queries, "owner", "admin")).Delete("/configs/{id}", h.DeleteShadowConfig)
			})

			// Debug (Fork-and-Replay)
			r.Route("/api/debug", func(r chi.Router) {
				r.Get("/forks", h.ListForks)
				r.Get("/{issueId}/timeline", h.GetDebugTimeline)
				r.Post("/{issueId}/fork", h.CreateFork)
			})

			// Weekly Digests
			r.Route("/api/digests", func(r chi.Router) {
				r.Get("/", h.ListWeeklyDigests)
				r.Get("/latest", h.GetLatestDigest)
				r.With(middleware.RequireWorkspaceRole(queries, "owner", "admin")).Post("/generate", h.GenerateDigest)
			})

			// Goals (The Ancestry)
			r.Route("/api/goals", func(r chi.Router) {
				r.Get("/", h.ListGoals)
				r.Post("/", h.CreateGoal)
				r.Route("/{id}", func(r chi.Router) {
					r.Get("/", h.GetGoal)
					r.Put("/", h.UpdateGoal)
					r.Delete("/", h.DeleteGoal)
					r.Get("/chain", h.GetGoalChain)
				})
			})

			// Missions (Continuous Run)
			r.Route("/api/missions", func(r chi.Router) {
				r.Get("/", h.ListMissions)
				r.Route("/{id}", func(r chi.Router) {
					r.Get("/", h.GetMission)
					r.Post("/stop", h.StopMission)
					r.Post("/advance", h.AdvanceMission)
				})
			})
			r.Post("/api/projects/{id}/run", h.StartMission)

			// Eisenhower Matrix
			r.Get("/api/eisenhower", h.ListEisenhowerMatrix)
			r.Get("/api/eisenhower/counts", h.CountEisenhowerQuadrants)
			r.Put("/api/issues/{id}/quadrant", h.SetEisenhowerQuadrant)

			// Issue goal + checkout
			r.Post("/api/issues/{id}/goal", h.SetIssueGoal)
			r.Post("/api/issues/{id}/claim", h.ClaimIssue)
			r.Post("/api/issues/{id}/unclaim", h.UnclaimIssue)

			// Audit Log
			r.Get("/api/audit-log", h.ListAuditLogs)

			// Observatory
			r.Route("/api/observatory", func(r chi.Router) {
				r.Get("/memory", h.GetObservatoryMemory)
				r.Get("/corrections", h.GetObservatoryCorrections)
				r.Get("/patterns", h.GetObservatoryPatterns)
				r.Get("/health", h.GetObservatoryHealth)
				r.Get("/profiles", h.GetObservatoryProfiles)
				r.Get("/sessions", h.GetObservatorySessions)
			})

			// Brain Dumps
			r.Route("/api/brain-dumps", func(r chi.Router) {
				r.Get("/", h.ListBrainDumps)
				r.Post("/", h.CreateBrainDump)
				r.Get("/unprocessed-count", h.CountUnprocessedBrainDumps)
				r.Put("/{id}/process", h.ProcessBrainDump)
				r.Delete("/{id}", h.DeleteBrainDump)
			})

			// Inbox
			r.Route("/api/inbox", func(r chi.Router) {
				r.Get("/", h.ListInbox)
				r.Get("/unread-count", h.CountUnreadInbox)
				r.Post("/mark-all-read", h.MarkAllInboxRead)
				r.Post("/archive-all", h.ArchiveAllInbox)
				r.Post("/archive-all-read", h.ArchiveAllReadInbox)
				r.Post("/archive-completed", h.ArchiveCompletedInbox)
				r.Post("/{id}/read", h.MarkInboxRead)
				r.Post("/{id}/archive", h.ArchiveInboxItem)
			})
		})
	})

	return r
}

// membershipChecker implements realtime.MembershipChecker using database queries.
type membershipChecker struct {
	queries *db.Queries
}

func (mc *membershipChecker) IsMember(ctx context.Context, userID, workspaceID string) bool {
	_, err := mc.queries.GetMemberByUserAndWorkspace(ctx, db.GetMemberByUserAndWorkspaceParams{
		UserID:      parseUUID(userID),
		WorkspaceID: parseUUID(workspaceID),
	})
	return err == nil
}

// patResolver implements realtime.PATResolver using database queries.
type patResolver struct {
	queries *db.Queries
}

func (pr *patResolver) ResolveToken(ctx context.Context, token string) (string, bool) {
	hash := auth.HashToken(token)
	pat, err := pr.queries.GetPersonalAccessTokenByHash(ctx, hash)
	if err != nil {
		return "", false
	}
	// Best-effort: update last_used_at
	go pr.queries.UpdatePersonalAccessTokenLastUsed(context.Background(), pat.ID)
	return util.UUIDToString(pat.UserID), true
}

func parseUUID(s string) pgtype.UUID {
	var u pgtype.UUID
	if err := u.Scan(s); err != nil {
		return pgtype.UUID{}
	}
	return u
}
