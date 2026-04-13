export type IssueStatus =
  | "backlog"
  | "todo"
  | "in_progress"
  | "in_review"
  | "done"
  | "blocked"
  | "cancelled";

export type IssuePriority = "urgent" | "high" | "medium" | "low" | "none";

export type EisenhowerQuadrant = "do" | "schedule" | "delegate" | "eliminate";

export type IssueAssigneeType = "member" | "agent";

export interface IssueReaction {
  id: string;
  issue_id: string;
  actor_type: string;
  actor_id: string;
  emoji: string;
  created_at: string;
}

export interface Issue {
  id: string;
  workspace_id: string;
  number: number;
  identifier: string;
  title: string;
  description: string | null;
  status: IssueStatus;
  priority: IssuePriority;
  assignee_type: IssueAssigneeType | null;
  assignee_id: string | null;
  creator_type: IssueAssigneeType;
  creator_id: string;
  parent_issue_id: string | null;
  project_id: string | null;
  position: number;
  due_date: string | null;
  goal_id?: string | null;
  claimed_by?: string | null;
  claimed_at?: string | null;
  claim_version?: number;
  eisenhower_quadrant?: EisenhowerQuadrant | null;
  reactions?: IssueReaction[];
  created_at: string;
  updated_at: string;
}

export interface EisenhowerItem {
  id: string;
  title: string;
  identifier: string;
  status: string;
  priority: string;
  assignee_type: string | null;
  assignee_id: string | null;
  eisenhower_quadrant: EisenhowerQuadrant;
  due_date: string | null;
  number: number;
}

export interface EisenhowerCounts {
  do: number;
  schedule: number;
  delegate: number;
  eliminate: number;
}
