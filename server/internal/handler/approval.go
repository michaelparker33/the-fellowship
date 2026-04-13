package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
	"github.com/multica-ai/multica/server/pkg/protocol"
)

// --- Request / Response types ---

type CreateApprovalRequest struct {
	IssueID        *string `json:"issue_id"`
	AgentID        string  `json:"agent_id"`
	ActionType     string  `json:"action_type"`
	AutonomyLevel  string  `json:"autonomy_level"`
	Payload        any     `json:"payload"`
	RiskLevel      string  `json:"risk_level"`
	RiskScore      *int    `json:"risk_score"`
}

// Default risk scores by action type (1-10 scale).
var defaultRiskScores = map[string]int{
	"read":          1,
	"create_task":   3,
	"update_status": 4,
	"send_email":    6,
	"post_slack":    6,
	"merge_pr":      7,
	"delete":        8,
	"deploy":        9,
	"financial":     10,
}

func resolveRiskScore(actionType string, explicit *int) int32 {
	if explicit != nil && *explicit >= 1 && *explicit <= 10 {
		return int32(*explicit)
	}
	if score, ok := defaultRiskScores[actionType]; ok {
		return int32(score)
	}
	return 3 // default for unknown action types
}

func autonomyLevelFromScore(score int32) string {
	switch {
	case score <= 3:
		return "full"
	case score <= 6:
		return "supervised"
	default:
		return "manual"
	}
}

type DecideApprovalRequest struct {
	Note string `json:"note"`
}

type UpdateApprovalConfigRequest struct {
	AutonomyLevel string `json:"autonomy_level"`
}

type ApprovalResponse struct {
	ID            string        `json:"id"`
	WorkspaceID   string        `json:"workspace_id"`
	IssueID       *string       `json:"issue_id"`
	AgentID       string        `json:"agent_id"`
	ActionType    string        `json:"action_type"`
	AutonomyLevel string        `json:"autonomy_level"`
	Status        string        `json:"status"`
	Payload       any           `json:"payload"`
	RiskLevel     string        `json:"risk_level"`
	RiskScore     int32         `json:"risk_score"`
	ContestedBy   *string       `json:"contested_by"`
	DebateNotes   []DebateVote  `json:"debate_notes"`
	DecidedBy     *string       `json:"decided_by"`
	DecidedAt     *string       `json:"decided_at"`
	DecisionNote  *string       `json:"decision_note"`
	DryRunResult  any           `json:"dry_run_result"`
	IsDryRun      bool          `json:"is_dry_run"`
	CreatedAt     string        `json:"created_at"`
	UpdatedAt     string        `json:"updated_at"`
}

type DebateVote struct {
	AgentID   string `json:"agent_id"`
	AgentName string `json:"agent_name"`
	Verdict   string `json:"verdict"`
	Reasoning string `json:"reasoning"`
	CreatedAt string `json:"created_at"`
}

type SubmitDebateVoteRequest struct {
	AgentID   string `json:"agent_id"`
	Verdict   string `json:"verdict"`
	Reasoning string `json:"reasoning"`
}

type ApprovalConfigResponse struct {
	ID                   string `json:"id"`
	WorkspaceID          string `json:"workspace_id"`
	ActionType           string `json:"action_type"`
	AutonomyLevel        string `json:"autonomy_level"`
	ConsecutiveApprovals int32  `json:"consecutive_approvals"`
	AutoApprove          bool   `json:"auto_approve"`
	RequireDryRun        bool   `json:"require_dry_run"`
	CreatedAt            string `json:"created_at"`
	UpdatedAt            string `json:"updated_at"`
}

func approvalToResponse(a db.Approval) ApprovalResponse {
	var payload any
	if len(a.Payload) > 0 {
		json.Unmarshal(a.Payload, &payload)
	}
	var debateNotes []DebateVote
	if len(a.DebateNotes) > 0 {
		json.Unmarshal(a.DebateNotes, &debateNotes)
	}
	var dryRunResult any
	if len(a.DryRunResult) > 0 {
		json.Unmarshal(a.DryRunResult, &dryRunResult)
	}
	return ApprovalResponse{
		ID:            uuidToString(a.ID),
		WorkspaceID:   uuidToString(a.WorkspaceID),
		IssueID:       uuidToPtr(a.IssueID),
		AgentID:       uuidToString(a.AgentID),
		ActionType:    a.ActionType,
		AutonomyLevel: a.AutonomyLevel,
		Status:        a.Status,
		Payload:       payload,
		RiskLevel:     a.RiskLevel,
		RiskScore:     a.RiskScore,
		ContestedBy:   uuidToPtr(a.ContestedBy),
		DebateNotes:   debateNotes,
		DecidedBy:     uuidToPtr(a.DecidedBy),
		DecidedAt:     timestampToPtr(a.DecidedAt),
		DecisionNote:  textToPtr(a.DecisionNote),
		DryRunResult:  dryRunResult,
		IsDryRun:      a.IsDryRun,
		CreatedAt:     timestampToString(a.CreatedAt),
		UpdatedAt:     timestampToString(a.UpdatedAt),
	}
}

func approvalConfigToResponse(c db.ApprovalConfig) ApprovalConfigResponse {
	return ApprovalConfigResponse{
		ID:                   uuidToString(c.ID),
		WorkspaceID:          uuidToString(c.WorkspaceID),
		ActionType:           c.ActionType,
		AutonomyLevel:        c.AutonomyLevel,
		ConsecutiveApprovals: c.ConsecutiveApprovals,
		AutoApprove:          c.AutoApprove,
		RequireDryRun:        c.RequireDryRun,
		CreatedAt:            timestampToString(c.CreatedAt),
		UpdatedAt:            timestampToString(c.UpdatedAt),
	}
}

// --- Handlers ---

func (h *Handler) ListApprovals(w http.ResponseWriter, r *http.Request) {
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

	params := db.ListApprovalsByWorkspaceParams{
		WorkspaceID: parseUUID(workspaceID),
		Limit:       int32(limit),
		Offset:      int32(offset),
	}
	if s := r.URL.Query().Get("status"); s != "" {
		params.Status = ptrToText(&s)
	}
	if rl := r.URL.Query().Get("risk_level"); rl != "" {
		params.RiskLevel = ptrToText(&rl)
	}
	if at := r.URL.Query().Get("action_type"); at != "" {
		params.ActionType = ptrToText(&at)
	}

	approvals, err := h.Queries.ListApprovalsByWorkspace(r.Context(), params)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list approvals")
		return
	}

	countParams := db.CountApprovalsByWorkspaceParams{
		WorkspaceID: parseUUID(workspaceID),
		Status:      params.Status,
		RiskLevel:   params.RiskLevel,
		ActionType:  params.ActionType,
	}
	total, _ := h.Queries.CountApprovalsByWorkspace(r.Context(), countParams)

	items := make([]ApprovalResponse, len(approvals))
	for i, a := range approvals {
		items[i] = approvalToResponse(a)
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"items": items,
		"total": total,
	})
}

func (h *Handler) CreateApproval(w http.ResponseWriter, r *http.Request) {
	workspaceID := resolveWorkspaceID(r)
	if workspaceID == "" {
		writeError(w, http.StatusBadRequest, "workspace_id is required")
		return
	}

	var req CreateApprovalRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.AgentID == "" || req.ActionType == "" || req.AutonomyLevel == "" {
		writeError(w, http.StatusBadRequest, "agent_id, action_type, and autonomy_level are required")
		return
	}

	riskScore := resolveRiskScore(req.ActionType, req.RiskScore)

	// Auto-derive risk_level from score if not provided
	if req.RiskLevel == "" {
		switch {
		case riskScore <= 3:
			req.RiskLevel = "low"
		case riskScore <= 6:
			req.RiskLevel = "medium"
		case riskScore <= 8:
			req.RiskLevel = "high"
		default:
			req.RiskLevel = "critical"
		}
	}

	// Override autonomy level based on risk score
	req.AutonomyLevel = autonomyLevelFromScore(riskScore)

	payloadBytes, _ := json.Marshal(req.Payload)

	params := db.CreateApprovalParams{
		WorkspaceID:   parseUUID(workspaceID),
		AgentID:       parseUUID(req.AgentID),
		ActionType:    req.ActionType,
		AutonomyLevel: req.AutonomyLevel,
		Payload:       payloadBytes,
		RiskLevel:     req.RiskLevel,
		RiskScore:     riskScore,
	}
	if req.IssueID != nil {
		params.IssueID = parseUUID(*req.IssueID)
	}

	// Check if dry run is required for this action type
	dryRunRequired := false
	if requireDryRun, err := h.Queries.GetApprovalConfigDryRun(r.Context(), db.GetApprovalConfigDryRunParams{
		WorkspaceID: parseUUID(workspaceID),
		ActionType:  req.ActionType,
	}); err == nil {
		dryRunRequired = requireDryRun
	}

	approval, err := h.Queries.CreateApproval(r.Context(), params)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create approval")
		return
	}

	// If dry run is required, auto-run validation and attach result
	if dryRunRequired {
		var payload map[string]any
		if len(approval.Payload) > 0 {
			json.Unmarshal(approval.Payload, &payload)
		}
		if payload == nil {
			payload = map[string]any{}
		}
		dryResult := validateActionPayload(uuidToString(approval.ID), approval.ActionType, payload)
		resultJSON, _ := json.Marshal(dryResult)
		approval, _ = h.Queries.UpdateDryRunResult(r.Context(), db.UpdateDryRunResultParams{
			ID:           approval.ID,
			DryRunResult: resultJSON,
		})
	}

	// Get agent name for the event payload
	agent, _ := h.Queries.GetAgent(r.Context(), parseUUID(req.AgentID))
	agentName := "Unknown Agent"
	if agent.Name != "" {
		agentName = agent.Name
	}

	// Auto-execute low-risk actions (score 1-3)
	if riskScore <= 3 {
		approval, _ = h.Queries.UpdateApprovalStatus(r.Context(), db.UpdateApprovalStatusParams{
			ID:     approval.ID,
			Status: "approved",
		})
		resp := approvalToResponse(approval)
		h.publish(protocol.EventApprovalExecutionTrigger, workspaceID, "system", "", map[string]any{
			"approval_id": uuidToString(approval.ID),
			"payload":     resp.Payload,
		})
		h.publish(protocol.EventApprovalCreated, workspaceID, "agent", req.AgentID, map[string]any{
			"approval":      resp,
			"agent_name":    agentName,
			"auto_executed": true,
		})
		writeJSON(w, http.StatusCreated, resp)
		return
	}

	resp := approvalToResponse(approval)

	h.publish(protocol.EventApprovalCreated, workspaceID, "agent", req.AgentID, map[string]any{
		"approval":   resp,
		"agent_name": agentName,
	})

	// Request debate for high-risk actions (score >= 7)
	if riskScore >= 7 {
		h.publish(protocol.EventDebateRequested, workspaceID, "system", "", map[string]any{
			"approval_id": uuidToString(approval.ID),
			"action_type": req.ActionType,
			"risk_score":  riskScore,
			"agent_id":    req.AgentID,
		})
	}

	writeJSON(w, http.StatusCreated, resp)
}

func (h *Handler) ApproveApproval(w http.ResponseWriter, r *http.Request) {
	h.decideApproval(w, r, "approved")
}

func (h *Handler) RejectApproval(w http.ResponseWriter, r *http.Request) {
	h.decideApproval(w, r, "rejected")
}

func (h *Handler) decideApproval(w http.ResponseWriter, r *http.Request, status string) {
	workspaceID := resolveWorkspaceID(r)
	approvalID := chi.URLParam(r, "id")

	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	// Verify the approval belongs to this workspace
	existing, err := h.Queries.GetApprovalInWorkspace(r.Context(), db.GetApprovalInWorkspaceParams{
		ID:          parseUUID(approvalID),
		WorkspaceID: parseUUID(workspaceID),
	})
	if err != nil {
		writeError(w, http.StatusNotFound, "approval not found")
		return
	}

	if existing.Status != "pending" {
		writeError(w, http.StatusConflict, "approval already decided")
		return
	}

	// Check role-based delegation: members can only decide supervised items
	member, ok := ctxMember(r.Context())
	if !ok {
		writeError(w, http.StatusUnauthorized, "member context not found")
		return
	}

	if existing.AutonomyLevel == "manual" && member.Role == "member" {
		writeError(w, http.StatusForbidden, "only admins can decide manual-tier approvals")
		return
	}

	var req DecideApprovalRequest
	json.NewDecoder(r.Body).Decode(&req)

	approval, err := h.Queries.UpdateApprovalStatus(r.Context(), db.UpdateApprovalStatusParams{
		ID:           parseUUID(approvalID),
		Status:       status,
		DecidedBy:    parseUUID(userID),
		DecisionNote: ptrToText(&req.Note),
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update approval")
		return
	}

	resp := approvalToResponse(approval)

	h.publish(protocol.EventApprovalDecided, workspaceID, "member", userID, map[string]any{
		"approval": resp,
	})

	// On approve: broadcast execution trigger and handle auto-approve suggestion
	autoApproveSuggested := false
	if status == "approved" {
		h.publish(protocol.EventApprovalExecutionTrigger, workspaceID, "member", userID, map[string]any{
			"approval_id": uuidToString(approval.ID),
			"payload":     resp.Payload,
		})

		// Increment consecutive approvals for this action type
		config, err := h.Queries.IncrementConsecutiveApprovals(r.Context(), db.IncrementConsecutiveApprovalsParams{
			WorkspaceID: parseUUID(workspaceID),
			ActionType:  existing.ActionType,
		})
		if err == nil && config.ConsecutiveApprovals >= 5 && !config.AutoApprove {
			autoApproveSuggested = true
			// Reset the counter
			h.Queries.ResetConsecutiveApprovals(r.Context(), db.ResetConsecutiveApprovalsParams{
				WorkspaceID: parseUUID(workspaceID),
				ActionType:  existing.ActionType,
			})
		}
	} else {
		// On reject: reset consecutive approvals
		h.Queries.ResetConsecutiveApprovals(r.Context(), db.ResetConsecutiveApprovalsParams{
			WorkspaceID: parseUUID(workspaceID),
			ActionType:  existing.ActionType,
		})
	}

	// Track trust score
	h.trackTrustScore(r, workspaceID, uuidToString(existing.AgentID), existing.ActionType, status, req.Note != "")

	writeJSON(w, http.StatusOK, map[string]any{
		"approval":               resp,
		"auto_approve_suggested": autoApproveSuggested,
	})
}

func (h *Handler) CountPendingApprovals(w http.ResponseWriter, r *http.Request) {
	workspaceID := resolveWorkspaceID(r)
	if workspaceID == "" {
		writeError(w, http.StatusBadRequest, "workspace_id is required")
		return
	}

	count, err := h.Queries.CountPendingApprovals(r.Context(), parseUUID(workspaceID))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to count approvals")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"count": count})
}

func (h *Handler) ListApprovalConfigs(w http.ResponseWriter, r *http.Request) {
	workspaceID := resolveWorkspaceID(r)
	if workspaceID == "" {
		writeError(w, http.StatusBadRequest, "workspace_id is required")
		return
	}

	configs, err := h.Queries.ListApprovalConfigs(r.Context(), parseUUID(workspaceID))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list configs")
		return
	}

	items := make([]ApprovalConfigResponse, len(configs))
	for i, c := range configs {
		items[i] = approvalConfigToResponse(c)
	}

	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) UpdateApprovalConfig(w http.ResponseWriter, r *http.Request) {
	workspaceID := resolveWorkspaceID(r)
	if workspaceID == "" {
		writeError(w, http.StatusBadRequest, "workspace_id is required")
		return
	}

	var req UpdateApprovalConfigRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	actionType := chi.URLParam(r, "actionType")
	if actionType == "" {
		writeError(w, http.StatusBadRequest, "action_type is required")
		return
	}

	switch req.AutonomyLevel {
	case "full", "supervised", "manual":
	default:
		writeError(w, http.StatusBadRequest, "autonomy_level must be full, supervised, or manual")
		return
	}

	config, err := h.Queries.UpsertApprovalConfig(r.Context(), db.UpsertApprovalConfigParams{
		WorkspaceID:   parseUUID(workspaceID),
		ActionType:    actionType,
		AutonomyLevel: req.AutonomyLevel,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update config")
		return
	}

	writeJSON(w, http.StatusOK, approvalConfigToResponse(config))
}

func (h *Handler) SetAutoApprove(w http.ResponseWriter, r *http.Request) {
	workspaceID := resolveWorkspaceID(r)
	if workspaceID == "" {
		writeError(w, http.StatusBadRequest, "workspace_id is required")
		return
	}

	actionType := chi.URLParam(r, "actionType")
	if actionType == "" {
		writeError(w, http.StatusBadRequest, "action_type is required")
		return
	}

	var req struct {
		AutoApprove bool `json:"auto_approve"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	err := h.Queries.SetAutoApprove(r.Context(), db.SetAutoApproveParams{
		WorkspaceID: parseUUID(workspaceID),
		ActionType:  actionType,
		AutoApprove: req.AutoApprove,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to set auto-approve")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

// --- Council Debate ---

func (h *Handler) SubmitDebateVote(w http.ResponseWriter, r *http.Request) {
	workspaceID := resolveWorkspaceID(r)
	approvalID := chi.URLParam(r, "id")

	var req SubmitDebateVoteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.AgentID == "" || req.Verdict == "" || req.Reasoning == "" {
		writeError(w, http.StatusBadRequest, "agent_id, verdict, and reasoning are required")
		return
	}
	if req.Verdict != "approve" && req.Verdict != "reject" {
		writeError(w, http.StatusBadRequest, "verdict must be 'approve' or 'reject'")
		return
	}

	// Get existing approval
	existing, err := h.Queries.GetApprovalInWorkspace(r.Context(), db.GetApprovalInWorkspaceParams{
		ID:          parseUUID(approvalID),
		WorkspaceID: parseUUID(workspaceID),
	})
	if err != nil {
		writeError(w, http.StatusNotFound, "approval not found")
		return
	}

	if existing.Status != "pending" {
		writeError(w, http.StatusConflict, "approval already decided")
		return
	}

	// Get agent name
	agent, _ := h.Queries.GetAgent(r.Context(), parseUUID(req.AgentID))
	agentName := "Unknown Agent"
	if agent.Name != "" {
		agentName = agent.Name
	}

	// Parse existing debate notes
	var notes []DebateVote
	if len(existing.DebateNotes) > 0 {
		json.Unmarshal(existing.DebateNotes, &notes)
	}

	// Add new vote
	vote := DebateVote{
		AgentID:   req.AgentID,
		AgentName: agentName,
		Verdict:   req.Verdict,
		Reasoning: req.Reasoning,
		CreatedAt: time.Now().UTC().Format(time.RFC3339),
	}
	notes = append(notes, vote)

	notesJSON, _ := json.Marshal(notes)

	// Determine if contested: 2+ votes with disagreement
	var contestedBy *string
	if len(notes) >= 2 {
		hasApprove := false
		hasReject := false
		var lastDissenter string
		for _, n := range notes {
			if n.Verdict == "approve" {
				hasApprove = true
			} else {
				hasReject = true
				lastDissenter = n.AgentID
			}
		}
		if hasApprove && hasReject {
			contestedBy = &lastDissenter
		}
	}

	var contestedUUID pgtype.UUID
	if contestedBy != nil {
		contestedUUID = parseUUID(*contestedBy)
	}

	approval, err := h.Queries.UpdateApprovalDebate(r.Context(), db.UpdateApprovalDebateParams{
		ID:          parseUUID(approvalID),
		DebateNotes: notesJSON,
		ContestedBy: contestedUUID,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update debate")
		return
	}

	resp := approvalToResponse(approval)

	h.publish(protocol.EventApprovalDebated, workspaceID, "agent", req.AgentID, map[string]any{
		"approval":   resp,
		"agent_name": agentName,
		"vote":       vote,
		"contested":  contestedBy != nil,
	})

	writeJSON(w, http.StatusOK, resp)
}

// --- Batch Operations ---

type BatchApproveRequest struct {
	ApprovalIDs  []string `json:"approval_ids"`
	MaxRiskScore *int     `json:"max_risk_score"`
}

type BatchRejectRequest struct {
	ApprovalIDs []string `json:"approval_ids"`
	Reason      string   `json:"reason"`
}

type BatchResultResponse struct {
	Approved int      `json:"approved,omitempty"`
	Rejected int      `json:"rejected,omitempty"`
	Failed   int      `json:"failed"`
	Errors   []string `json:"errors"`
}

func (h *Handler) BatchApproveApprovals(w http.ResponseWriter, r *http.Request) {
	workspaceID := resolveWorkspaceID(r)
	if workspaceID == "" {
		writeError(w, http.StatusBadRequest, "workspace_id is required")
		return
	}

	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	var req BatchApproveRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if len(req.ApprovalIDs) == 0 && req.MaxRiskScore == nil {
		writeError(w, http.StatusBadRequest, "either approval_ids or max_risk_score is required")
		return
	}

	var ids []string

	if req.MaxRiskScore != nil {
		// Find all pending approvals with risk_score <= max_risk_score
		pending, err := h.Queries.ListPendingApprovalsByRiskScore(r.Context(), db.ListPendingApprovalsByRiskScoreParams{
			WorkspaceID: parseUUID(workspaceID),
			RiskScore:   int32(*req.MaxRiskScore),
		})
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to list pending approvals")
			return
		}
		for _, a := range pending {
			ids = append(ids, uuidToString(a.ID))
		}
	} else {
		ids = req.ApprovalIDs
	}

	if len(ids) == 0 {
		writeJSON(w, http.StatusOK, BatchResultResponse{Approved: 0, Failed: 0, Errors: []string{}})
		return
	}

	if len(ids) > 50 {
		writeError(w, http.StatusBadRequest, "maximum 50 items per batch")
		return
	}

	uuids := make([]pgtype.UUID, len(ids))
	for i, id := range ids {
		uuids[i] = parseUUID(id)
	}

	err := h.Queries.BatchApproveApprovals(r.Context(), db.BatchApproveApprovalsParams{
		Column1:     uuids,
		DecidedBy:   parseUUID(userID),
		WorkspaceID: parseUUID(workspaceID),
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to batch approve")
		return
	}

	// Publish events for each approved item
	for _, id := range ids {
		h.publish(protocol.EventApprovalDecided, workspaceID, "member", userID, map[string]any{
			"approval_id": id,
			"status":      "approved",
			"batch":       true,
		})
		h.publish(protocol.EventApprovalExecutionTrigger, workspaceID, "member", userID, map[string]any{
			"approval_id": id,
		})
	}

	writeJSON(w, http.StatusOK, BatchResultResponse{
		Approved: len(ids),
		Failed:   0,
		Errors:   []string{},
	})
}

func (h *Handler) BatchRejectApprovals(w http.ResponseWriter, r *http.Request) {
	workspaceID := resolveWorkspaceID(r)
	if workspaceID == "" {
		writeError(w, http.StatusBadRequest, "workspace_id is required")
		return
	}

	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	var req BatchRejectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if len(req.ApprovalIDs) == 0 {
		writeError(w, http.StatusBadRequest, "approval_ids is required")
		return
	}

	if len(req.ApprovalIDs) > 50 {
		writeError(w, http.StatusBadRequest, "maximum 50 items per batch")
		return
	}

	uuids := make([]pgtype.UUID, len(req.ApprovalIDs))
	for i, id := range req.ApprovalIDs {
		uuids[i] = parseUUID(id)
	}

	err := h.Queries.BatchRejectApprovals(r.Context(), db.BatchRejectApprovalsParams{
		Column1:     uuids,
		DecidedBy:   parseUUID(userID),
		WorkspaceID: parseUUID(workspaceID),
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to batch reject")
		return
	}

	// Publish events for each rejected item
	for _, id := range req.ApprovalIDs {
		h.publish(protocol.EventApprovalDecided, workspaceID, "member", userID, map[string]any{
			"approval_id": id,
			"status":      "rejected",
			"batch":       true,
		})
	}

	writeJSON(w, http.StatusOK, BatchResultResponse{
		Rejected: len(req.ApprovalIDs),
		Failed:   0,
		Errors:   []string{},
	})
}

func (h *Handler) ListContestedApprovals(w http.ResponseWriter, r *http.Request) {
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

	approvals, err := h.Queries.ListContestedApprovals(r.Context(), db.ListContestedApprovalsParams{
		WorkspaceID: parseUUID(workspaceID),
		Limit:       int32(limit),
		Offset:      int32(offset),
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list contested approvals")
		return
	}

	total, _ := h.Queries.CountContestedApprovals(r.Context(), parseUUID(workspaceID))

	items := make([]ApprovalResponse, len(approvals))
	for i, a := range approvals {
		items[i] = approvalToResponse(a)
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"items": items,
		"total": total,
	})
}
