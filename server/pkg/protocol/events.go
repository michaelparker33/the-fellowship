package protocol

// Event types for WebSocket communication between server, web clients, and daemon.
const (
	// Issue events
	EventIssueCreated = "issue:created"
	EventIssueUpdated = "issue:updated"
	EventIssueDeleted = "issue:deleted"

	// Comment events
	EventCommentCreated       = "comment:created"
	EventCommentUpdated       = "comment:updated"
	EventCommentDeleted       = "comment:deleted"
	EventReactionAdded          = "reaction:added"
	EventReactionRemoved        = "reaction:removed"
	EventIssueReactionAdded     = "issue_reaction:added"
	EventIssueReactionRemoved   = "issue_reaction:removed"

	// Agent events
	EventAgentStatus   = "agent:status"
	EventAgentCreated  = "agent:created"
	EventAgentArchived = "agent:archived"
	EventAgentRestored = "agent:restored"

	// Task events (server <-> daemon)
	EventTaskDispatch  = "task:dispatch"
	EventTaskProgress  = "task:progress"
	EventTaskCompleted = "task:completed"
	EventTaskFailed    = "task:failed"
	EventTaskMessage   = "task:message"
	EventTaskCancelled = "task:cancelled"

	// Inbox events
	EventInboxNew           = "inbox:new"
	EventInboxRead          = "inbox:read"
	EventInboxArchived      = "inbox:archived"
	EventInboxBatchRead     = "inbox:batch-read"
	EventInboxBatchArchived = "inbox:batch-archived"

	// Workspace events
	EventWorkspaceUpdated = "workspace:updated"
	EventWorkspaceDeleted = "workspace:deleted"

	// Member events
	EventMemberAdded   = "member:added"
	EventMemberUpdated = "member:updated"
	EventMemberRemoved = "member:removed"

	// Subscriber events
	EventSubscriberAdded   = "subscriber:added"
	EventSubscriberRemoved = "subscriber:removed"

	// Activity events
	EventActivityCreated = "activity:created"

	// Skill events
	EventSkillCreated = "skill:created"
	EventSkillUpdated = "skill:updated"
	EventSkillDeleted = "skill:deleted"

	// Chat events
	EventChatMessage     = "chat:message"
	EventChatDone        = "chat:done"
	EventChatSessionRead = "chat:session_read"

	// Project events
	EventProjectCreated = "project:created"
	EventProjectUpdated = "project:updated"
	EventProjectDeleted = "project:deleted"

	// Pin events
	EventPinCreated = "pin:created"
	EventPinDeleted = "pin:deleted"

	// Invitation events
	EventInvitationCreated  = "invitation:created"
	EventInvitationAccepted = "invitation:accepted"
	EventInvitationDeclined = "invitation:declined"
	EventInvitationRevoked  = "invitation:revoked"

	// Autopilot events
	EventAutopilotCreated  = "autopilot:created"
	EventAutopilotUpdated  = "autopilot:updated"
	EventAutopilotDeleted  = "autopilot:deleted"
	EventAutopilotRunStart = "autopilot:run_start"
	EventAutopilotRunDone  = "autopilot:run_done"

	// Daemon events
	EventDaemonHeartbeat = "daemon:heartbeat"
	EventDaemonRegister  = "daemon:register"

	// Approval events (The Council)
	EventApprovalCreated          = "approval:created"
	EventApprovalDecided          = "approval:decided"
	EventApprovalExecutionTrigger = "approval:execution_trigger"
	EventApprovalDebated          = "approval:debated"
	EventDebateRequested          = "approval:debate_requested"

	// Scheduled task events (The Watch)
	EventScheduledTaskFired = "watch:fired"
	EventTriggerFired       = "watch:trigger_fired"

	// Safety events
	EventEmergencyStop   = "safety:emergency_stop"
	EventEmergencyResume = "safety:resume"

	// Achievement events
	EventAchievementUnlocked = "achievement:unlocked"

	// Goal events
	EventGoalCreated = "goal:created"
	EventGoalUpdated = "goal:updated"
	EventGoalDeleted = "goal:deleted"

	// Issue checkout events
	EventIssueClaimed   = "issue:claimed"
	EventIssueUnclaimed = "issue:unclaimed"
)
