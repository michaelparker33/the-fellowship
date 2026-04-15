"use client";

import { useMemo, useCallback, type ReactNode } from "react";
import { ChevronsLeft, EyeOff, MoreHorizontal, Plus } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@multica/ui/components/ui/tooltip";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { Issue, IssueStatus } from "@multica/core/types";
import { Button } from "@multica/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@multica/ui/components/ui/dropdown-menu";
import { STATUS_CONFIG } from "@multica/core/issues/config";
import { useModalStore } from "@multica/core/modals";
import { useViewStoreApi, useViewStore } from "@multica/core/issues/stores/view-store-context";
import { StatusIcon } from "./status-icon";
import { DraggableBoardCard } from "./board-card";
import type { ChildProgress } from "./list-row";

export function BoardColumn({
  status,
  issueIds,
  issueMap,
  childProgressMap,
  totalCount,
  footer,
}: {
  status: IssueStatus;
  issueIds: string[];
  issueMap: Map<string, Issue>;
  childProgressMap?: Map<string, ChildProgress>;
  totalCount?: number;
  footer?: ReactNode;
}) {
  const cfg = STATUS_CONFIG[status];
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const viewStoreApi = useViewStoreApi();
  const isCollapsed = useViewStore((s) => s.boardCollapsedStatuses.includes(status));

  const toggleCollapsed = useCallback(() => {
    viewStoreApi.getState().toggleBoardCollapsed(status);
  }, [viewStoreApi, status]);

  // Resolve IDs to Issue objects, preserving parent-provided order
  const resolvedIssues = useMemo(
    () =>
      issueIds.flatMap((id) => {
        const issue = issueMap.get(id);
        return issue ? [issue] : [];
      }),
    [issueIds, issueMap],
  );

  const count = totalCount ?? issueIds.length;

  // ── Collapsed column: thin vertical strip ──
  if (isCollapsed) {
    return (
      <button
        type="button"
        onClick={toggleCollapsed}
        className={`group flex w-9 shrink-0 flex-col items-center rounded-xl ${cfg.columnBg} py-3 transition-all duration-[400ms] ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-secondary cursor-pointer`}
      >
        {/* Count */}
        <span className="text-[11px] text-text-tertiary tabular-nums font-medium">{count}</span>

        {/* Vertical label using writing-mode for proper layout flow */}
        <div className="mt-3 flex items-center gap-1.5 [writing-mode:vertical-lr] [text-orientation:mixed]">
          <StatusIcon status={status} className="h-3 w-3 shrink-0" />
          <span className="text-xs font-medium text-text-secondary tracking-wide">{cfg.label}</span>
        </div>
      </button>
    );
  }

  return (
    <div className={`flex w-[280px] shrink-0 flex-col rounded-xl ${cfg.columnBg} p-2 transition-all duration-[400ms] ease-[cubic-bezier(0.32,0.72,0,1)]`}>
      <div className="mb-2 flex items-center justify-between px-1.5">
        {/* Left: status badge + count */}
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-semibold ${cfg.badgeBg} ${cfg.badgeText}`}>
            <StatusIcon status={status} className="h-3 w-3" inheritColor />
            {cfg.label}
          </span>
          <span className="text-xs text-text-tertiary">
            {count}
          </span>
        </div>

        {/* Right: collapse + add + menu */}
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="rounded-full text-text-tertiary"
                  onClick={toggleCollapsed}
                >
                  <ChevronsLeft className="size-3.5" />
                </Button>
              }
            />
            <TooltipContent>Collapse column</TooltipContent>
          </Tooltip>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon-sm" className="rounded-full text-text-tertiary">
                  <MoreHorizontal className="size-3.5" />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => viewStoreApi.getState().hideStatus(status)}>
                <EyeOff className="size-3.5" />
                Hide column
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="rounded-full text-text-tertiary"
                  onClick={() => useModalStore.getState().open("create-issue", { status })}
                >
                  <Plus className="size-3.5" />
                </Button>
              }
            />
            <TooltipContent>Add issue</TooltipContent>
          </Tooltip>
        </div>
      </div>
      <div
        ref={setNodeRef}
        className={`min-h-[200px] flex-1 space-y-2 overflow-y-auto rounded-lg p-1 transition-colors duration-[300ms] ease-[cubic-bezier(0.32,0.72,0,1)] ${
          isOver ? "bg-accent/60" : ""
        }`}
      >
        <SortableContext items={issueIds} strategy={verticalListSortingStrategy}>
          {resolvedIssues.map((issue) => (
            <DraggableBoardCard key={issue.id} issue={issue} childProgress={childProgressMap?.get(issue.id)} />
          ))}
        </SortableContext>
        {issueIds.length === 0 && (
          <p className="py-8 text-center text-xs text-text-tertiary">
            No issues
          </p>
        )}
        {footer}
      </div>
    </div>
  );
}
