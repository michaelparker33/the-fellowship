"use client";

import { useCallback, memo } from "react";
import { useSortable, defaultAnimateLayoutChanges } from "@dnd-kit/sortable";
import type { AnimateLayoutChanges } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import type { Issue, UpdateIssueRequest } from "@multica/core/types";
import { CalendarDays, Check } from "lucide-react";
import { ActorAvatar } from "../../common/actor-avatar";
import { useUpdateIssue } from "@multica/core/issues/mutations";
import { useIssueSelectionStore } from "@multica/core/issues/stores/selection-store";
import { useModalStore } from "@multica/core/modals";
import { PriorityIcon } from "./priority-icon";
import { PriorityPicker, AssigneePicker, DueDatePicker } from "./pickers";
import { PRIORITY_CONFIG, STATUS_CONFIG } from "@multica/core/issues/config";
import { useViewStore } from "@multica/core/issues/stores/view-store-context";
import { ProgressRing } from "./progress-ring";
import type { ChildProgress } from "./list-row";

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/** Stops event from bubbling to Link/drag handlers */
function PickerWrapper({ children }: { children: React.ReactNode }) {
  const stop = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    e.preventDefault();
  };
  return (
    <div onClick={stop} onMouseDown={stop} onPointerDown={stop}>
      {children}
    </div>
  );
}

export const BoardCardContent = memo(function BoardCardContent({
  issue,
  editable = false,
  childProgress,
}: {
  issue: Issue;
  editable?: boolean;
  childProgress?: ChildProgress;
}) {
  const storeProperties = useViewStore((s) => s.cardProperties);
  const focused = useIssueSelectionStore((s) => s.focusedId === issue.id);
  const priorityCfg = PRIORITY_CONFIG[issue.priority];

  const updateIssueMutation = useUpdateIssue();
  const handleUpdate = useCallback(
    (updates: Partial<UpdateIssueRequest>) => {
      updateIssueMutation.mutate(
        { id: issue.id, ...updates },
        { onError: () => toast.error("Failed to update issue") },
      );
    },
    [issue.id, updateIssueMutation],
  );

  const showPriority = storeProperties.priority;
  const showDescription = storeProperties.description && issue.description;
  const showAssignee = storeProperties.assignee && issue.assignee_type && issue.assignee_id;
  const showDueDate = storeProperties.dueDate && issue.due_date;

  const isDone = issue.status === "done";
  const statusCfg = STATUS_CONFIG[issue.status];

  return (
    <div className={`relative rounded-xl border bg-card p-3.5 shadow-md transition-all duration-[300ms] ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:shadow-lg group-hover:border-border ${focused ? "border-brand/40 ring-1 ring-brand/20" : "border-border-subtle"}`}>
      {/* Row 1: Identifier + quick-complete toggle */}
      <div className="flex items-center gap-1.5">
        {editable && (
          <PickerWrapper>
            <button
              type="button"
              onClick={() => handleUpdate({ status: isDone ? "todo" : "done" })}
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-[1.5px] opacity-0 transition-all duration-[300ms] ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:opacity-100 hover:scale-125 active:scale-90 ${
                isDone
                  ? "border-info bg-info text-white opacity-100"
                  : `border-current ${statusCfg.iconColor}`
              }`}
              aria-label={isDone ? "Mark as todo" : "Mark as done"}
            >
              {isDone ? (
                <Check className="h-2.5 w-2.5" strokeWidth={3} />
              ) : (
                <Check className="h-2.5 w-2.5 opacity-0 transition-opacity duration-[300ms] ease-[cubic-bezier(0.32,0.72,0,1)] [button:hover>&]:opacity-100" strokeWidth={3} />
              )}
            </button>
          </PickerWrapper>
        )}
        <span className="text-xs text-text-tertiary">{issue.identifier}</span>
      </div>

      {/* Row 2: Title */}
      <p className="mt-1 text-sm font-medium leading-snug line-clamp-2">
        {issue.title}
      </p>

      {/* Sub-issue progress */}
      {childProgress && (
        <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-secondary px-1.5 py-0.5">
          <ProgressRing done={childProgress.done} total={childProgress.total} size={14} />
          <span className="text-[11px] text-text-tertiary tabular-nums font-medium">
            {childProgress.done}/{childProgress.total}
          </span>
        </div>
      )}

      {/* Description */}
      {showDescription && (
        <p className="mt-1 text-xs text-text-secondary line-clamp-1">
          {issue.description}
        </p>
      )}

      {/* Row 3: Assignee, priority badge, due date */}
      {(showAssignee || showPriority || showDueDate) && (
        <div className="mt-3 flex items-center gap-2">
          {showAssignee &&
            (editable ? (
              <PickerWrapper>
                <AssigneePicker
                  assigneeType={issue.assignee_type}
                  assigneeId={issue.assignee_id}
                  onUpdate={handleUpdate}
                  trigger={
                    <ActorAvatar
                      actorType={issue.assignee_type!}
                      actorId={issue.assignee_id!}
                      size={22}
                    />
                  }
                />
              </PickerWrapper>
            ) : (
              <ActorAvatar
                actorType={issue.assignee_type!}
                actorId={issue.assignee_id!}
                size={22}
              />
            ))}
          {showPriority &&
            (editable ? (
              <PickerWrapper>
                <PriorityPicker
                  priority={issue.priority}
                  onUpdate={handleUpdate}
                  trigger={
                    <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium ${priorityCfg.badgeBg} ${priorityCfg.badgeText}`}>
                      <PriorityIcon priority={issue.priority} className="h-3 w-3" inheritColor />
                      {priorityCfg.label}
                    </span>
                  }
                />
              </PickerWrapper>
            ) : (
              <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium ${priorityCfg.badgeBg} ${priorityCfg.badgeText}`}>
                <PriorityIcon priority={issue.priority} className="h-3 w-3" inheritColor />
                {priorityCfg.label}
              </span>
            ))}
          {showDueDate && (
            <div className="ml-auto">
              {editable ? (
                <PickerWrapper>
                  <DueDatePicker
                    dueDate={issue.due_date}
                    onUpdate={handleUpdate}
                    trigger={
                      <span
                        className={`flex items-center gap-1 text-xs ${
                          new Date(issue.due_date!) < new Date()
                            ? "text-destructive"
                            : "text-text-tertiary"
                        }`}
                      >
                        <CalendarDays className="size-3" />
                        {formatDate(issue.due_date!)}
                      </span>
                    }
                  />
                </PickerWrapper>
              ) : (
                <span
                  className={`flex items-center gap-1 text-xs ${
                    new Date(issue.due_date!) < new Date()
                      ? "text-destructive"
                      : "text-text-tertiary"
                  }`}
                >
                  <CalendarDays className="size-3" />
                  {formatDate(issue.due_date!)}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

const animateLayoutChanges: AnimateLayoutChanges = (args) => {
  const { isSorting, wasDragging } = args;
  if (isSorting || wasDragging) return false;
  return defaultAnimateLayoutChanges(args);
};

export const DraggableBoardCard = memo(function DraggableBoardCard({ issue, childProgress }: { issue: Issue; childProgress?: ChildProgress }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: issue.id,
    data: { status: issue.status },
    animateLayoutChanges,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const openIssueModal = useCallback(() => {
    useModalStore.getState().open("issue-detail", { issueId: issue.id });
  }, [issue.id]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-issue-id={issue.id}
      {...attributes}
      {...listeners}
      className={isDragging ? "opacity-30" : ""}
    >
      <button
        type="button"
        onClick={isDragging ? undefined : openIssueModal}
        className={`group block w-full text-left transition-colors cursor-pointer ${isDragging ? "pointer-events-none" : ""}`}
      >
        <BoardCardContent issue={issue} editable childProgress={childProgress} />
      </button>
    </div>
  );
});
