package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
)

// DryRunResult represents the result of a dry run execution.
type DryRunResult struct {
	ApprovalID    string   `json:"approval_id"`
	ActionType    string   `json:"action_type"`
	Valid         bool     `json:"valid"`
	Preview       string   `json:"preview"`
	AffectedItems []string `json:"affected_items"`
	Warnings      []string `json:"warnings"`
	Errors        []string `json:"errors"`
}

// ExecuteDryRun validates an approval's payload without executing it.
func (h *Handler) ExecuteDryRun(w http.ResponseWriter, r *http.Request) {
	workspaceID := resolveWorkspaceID(r)
	approvalID := chi.URLParam(r, "id")

	if workspaceID == "" {
		writeError(w, http.StatusBadRequest, "workspace_id is required")
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
		writeError(w, http.StatusConflict, "can only dry run pending approvals")
		return
	}

	// Parse payload
	var payload map[string]any
	if len(existing.Payload) > 0 {
		json.Unmarshal(existing.Payload, &payload)
	}
	if payload == nil {
		payload = map[string]any{}
	}

	// Run validation based on action type
	result := validateActionPayload(uuidToString(existing.ID), existing.ActionType, payload)

	// Persist the dry run result
	resultJSON, _ := json.Marshal(result)
	h.Queries.UpdateDryRunResult(r.Context(), db.UpdateDryRunResultParams{
		ID:           parseUUID(approvalID),
		DryRunResult: resultJSON,
	})

	writeJSON(w, http.StatusOK, result)
}

// ListDryRunResults returns past dry run approvals.
func (h *Handler) ListDryRunResults(w http.ResponseWriter, r *http.Request) {
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

	approvals, err := h.Queries.ListDryRunApprovals(r.Context(), db.ListDryRunApprovalsParams{
		WorkspaceID: parseUUID(workspaceID),
		Limit:       int32(limit),
		Offset:      int32(offset),
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list dry run approvals")
		return
	}

	total, _ := h.Queries.CountDryRunApprovals(r.Context(), parseUUID(workspaceID))

	items := make([]ApprovalResponse, len(approvals))
	for i, a := range approvals {
		items[i] = approvalToResponse(a)
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"approvals": items,
		"total":     total,
	})
}

// UpdateApprovalConfigDryRun toggles the require_dry_run setting for an action type.
func (h *Handler) UpdateApprovalConfigDryRun(w http.ResponseWriter, r *http.Request) {
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
		RequireDryRun bool `json:"require_dry_run"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	err := h.Queries.SetRequireDryRun(r.Context(), db.SetRequireDryRunParams{
		WorkspaceID:   parseUUID(workspaceID),
		ActionType:    actionType,
		RequireDryRun: req.RequireDryRun,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update dry run config")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

// validateActionPayload performs dry-run validation based on action type.
func validateActionPayload(approvalID string, actionType string, payload map[string]any) DryRunResult {
	result := DryRunResult{
		ApprovalID:    approvalID,
		ActionType:    actionType,
		Valid:         true,
		AffectedItems: []string{},
		Warnings:      []string{},
		Errors:        []string{},
	}

	switch actionType {
	case "send_email":
		validateSendEmail(payload, &result)
	case "deploy":
		validateDeploy(payload, &result)
	case "create_task":
		validateCreateTask(payload, &result)
	case "update_status":
		validateUpdateStatus(payload, &result)
	case "delete":
		validateDelete(payload, &result)
	case "merge_pr":
		validateMergePR(payload, &result)
	default:
		validateGenericPayload(actionType, payload, &result)
	}

	return result
}

func validateSendEmail(payload map[string]any, result *DryRunResult) {
	recipient, _ := payload["recipient"].(string)
	subject, _ := payload["subject"].(string)
	body, _ := payload["body"].(string)

	if recipient == "" {
		result.Errors = append(result.Errors, "missing required field: recipient")
		result.Valid = false
	}
	if subject == "" {
		result.Warnings = append(result.Warnings, "email has no subject line")
	}
	if body == "" {
		result.Warnings = append(result.Warnings, "email body is empty")
	}

	if result.Valid {
		result.Preview = fmt.Sprintf("Send email to %s with subject: %s", recipient, subject)
		result.AffectedItems = append(result.AffectedItems, fmt.Sprintf("recipient: %s", recipient))
	}
}

func validateDeploy(payload map[string]any, result *DryRunResult) {
	target, _ := payload["target"].(string)
	environment, _ := payload["environment"].(string)

	if target == "" && environment == "" {
		result.Errors = append(result.Errors, "missing required field: target or environment")
		result.Valid = false
	}

	if environment == "production" {
		result.Warnings = append(result.Warnings, "deploying to production environment")
	}

	env := environment
	if env == "" {
		env = target
	}
	result.Preview = fmt.Sprintf("Deploy to %s", env)
	if target != "" {
		result.AffectedItems = append(result.AffectedItems, fmt.Sprintf("target: %s", target))
	}
	if environment != "" {
		result.AffectedItems = append(result.AffectedItems, fmt.Sprintf("environment: %s", environment))
	}
}

func validateCreateTask(payload map[string]any, result *DryRunResult) {
	title, _ := payload["title"].(string)

	if title == "" {
		result.Errors = append(result.Errors, "missing required field: title")
		result.Valid = false
	}

	assignee, _ := payload["assignee"].(string)
	result.Preview = fmt.Sprintf("Create task: %s", title)
	result.AffectedItems = append(result.AffectedItems, fmt.Sprintf("title: %s", title))
	if assignee != "" {
		result.AffectedItems = append(result.AffectedItems, fmt.Sprintf("assignee: %s", assignee))
	}
}

func validateUpdateStatus(payload map[string]any, result *DryRunResult) {
	targetID, _ := payload["target_id"].(string)
	newStatus, _ := payload["status"].(string)

	if targetID == "" {
		result.Errors = append(result.Errors, "missing required field: target_id")
		result.Valid = false
	}
	if newStatus == "" {
		result.Errors = append(result.Errors, "missing required field: status")
		result.Valid = false
	}

	validStatuses := map[string]bool{
		"backlog": true, "todo": true, "in_progress": true,
		"in_review": true, "done": true, "cancelled": true,
	}
	if newStatus != "" && !validStatuses[newStatus] {
		result.Warnings = append(result.Warnings, fmt.Sprintf("unknown status: %s", newStatus))
	}

	result.Preview = fmt.Sprintf("Update status to '%s'", newStatus)
	if targetID != "" {
		result.AffectedItems = append(result.AffectedItems, fmt.Sprintf("target: %s", targetID))
	}
}

func validateDelete(payload map[string]any, result *DryRunResult) {
	targetID, _ := payload["target_id"].(string)
	targetType, _ := payload["target_type"].(string)

	if targetID == "" {
		result.Errors = append(result.Errors, "missing required field: target_id")
		result.Valid = false
	}

	result.Warnings = append(result.Warnings, "this action is destructive and cannot be undone")

	if targetType != "" {
		result.Preview = fmt.Sprintf("Delete %s %s", targetType, targetID)
	} else {
		result.Preview = fmt.Sprintf("Delete resource %s", targetID)
	}
	if targetID != "" {
		result.AffectedItems = append(result.AffectedItems, fmt.Sprintf("target: %s", targetID))
	}
}

func validateMergePR(payload map[string]any, result *DryRunResult) {
	prNumber, _ := payload["pr_number"].(float64)
	repo, _ := payload["repository"].(string)
	branch, _ := payload["branch"].(string)

	if prNumber == 0 {
		result.Errors = append(result.Errors, "missing required field: pr_number")
		result.Valid = false
	}
	if repo == "" {
		result.Warnings = append(result.Warnings, "repository not specified")
	}

	if branch == "main" || branch == "master" {
		result.Warnings = append(result.Warnings, fmt.Sprintf("merging into protected branch: %s", branch))
	}

	result.Preview = fmt.Sprintf("Merge PR #%d", int(prNumber))
	if repo != "" {
		result.Preview = fmt.Sprintf("Merge PR #%d in %s", int(prNumber), repo)
		result.AffectedItems = append(result.AffectedItems, fmt.Sprintf("repository: %s", repo))
	}
	result.AffectedItems = append(result.AffectedItems, fmt.Sprintf("PR: #%d", int(prNumber)))
}

func validateGenericPayload(actionType string, payload map[string]any, result *DryRunResult) {
	if len(payload) == 0 {
		result.Warnings = append(result.Warnings, "payload is empty")
	}

	result.Preview = fmt.Sprintf("Execute %s action", actionType)
	for k := range payload {
		result.AffectedItems = append(result.AffectedItems, fmt.Sprintf("field: %s", k))
	}
}
