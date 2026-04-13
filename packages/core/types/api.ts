import type { Issue, IssueStatus, IssuePriority, IssueAssigneeType, EisenhowerQuadrant } from "./issue";
import type { MemberRole } from "./workspace";
import type { Project } from "./project";

// Issue API
export interface CreateIssueRequest {
  title: string;
  description?: string;
  status?: IssueStatus;
  priority?: IssuePriority;
  assignee_type?: IssueAssigneeType;
  assignee_id?: string;
  parent_issue_id?: string;
  project_id?: string;
  due_date?: string;
  attachment_ids?: string[];
}

export interface UpdateIssueRequest {
  title?: string;
  description?: string;
  status?: IssueStatus;
  priority?: IssuePriority;
  assignee_type?: IssueAssigneeType | null;
  assignee_id?: string | null;
  position?: number;
  due_date?: string | null;
  parent_issue_id?: string | null;
  project_id?: string | null;
  eisenhower_quadrant?: EisenhowerQuadrant | null;
}

/** Options for compressed/sparse field selection on any GET endpoint. */
export interface FieldSelectionParams {
  /** Include only these fields in the response (id is always included). */
  fields?: string[];
  /** Exclude these fields from the response (mutually exclusive with fields). */
  exclude?: string[];
}

export interface ListIssuesParams extends FieldSelectionParams {
  limit?: number;
  offset?: number;
  workspace_id?: string;
  status?: IssueStatus;
  priority?: IssuePriority;
  assignee_id?: string;
  assignee_ids?: string[];
  creator_id?: string;
  open_only?: boolean;
}

export interface ListIssuesResponse {
  issues: Issue[];
  total: number;
  /** True total of done issues in the workspace (for load-more pagination). Not returned by backend API — set by the frontend query function. */
  doneTotal?: number;
}

export interface SearchIssueResult extends Issue {
  match_source: "title" | "description" | "comment";
  matched_snippet?: string;
}

export interface SearchIssuesResponse {
  issues: SearchIssueResult[];
  total: number;
}

export interface SearchProjectResult extends Project {
  match_source: "title" | "description";
  matched_snippet?: string;
}

export interface SearchProjectsResponse {
  projects: SearchProjectResult[];
  total: number;
}

export interface UpdateMeRequest {
  name?: string;
  avatar_url?: string;
}

export interface CreateMemberRequest {
  email: string;
  role?: MemberRole;
}

export interface UpdateMemberRequest {
  role: MemberRole;
}

// Personal Access Tokens
export interface PersonalAccessToken {
  id: string;
  name: string;
  token_prefix: string;
  expires_at: string | null;
  last_used_at: string | null;
  created_at: string;
}

export interface CreatePersonalAccessTokenRequest {
  name: string;
  expires_in_days?: number;
}

export interface CreatePersonalAccessTokenResponse extends PersonalAccessToken {
  token: string;
}

// Pagination
export interface PaginationParams {
  limit?: number;
  offset?: number;
}

// --- Compressed Context: common sparse field sets for agent API reads ---

/** Core issue fields for agent task routing and status display. */
export const AGENT_ISSUE_FIELDS = ["id", "identifier", "title", "status", "priority", "assignee_id", "assignee_type"] as const;

/** Core project fields for agent context. */
export const AGENT_PROJECT_FIELDS = ["id", "name", "prefix", "status"] as const;

/** Minimal fields for lightweight list reads. */
export const AGENT_MINIMAL_FIELDS = ["id", "title", "status"] as const;
