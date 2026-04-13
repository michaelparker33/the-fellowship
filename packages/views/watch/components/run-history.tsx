"use client";

import { useQuery } from "@tanstack/react-query";
import { useWorkspaceId } from "@multica/core/hooks";
import { scheduledTaskRunsOptions } from "@multica/core/watch/queries";
import { Skeleton } from "@multica/ui/components/ui/skeleton";

function timeAgo(dateStr: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 1000,
  );
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function RunHistory({ taskId }: { taskId: string }) {
  const wsId = useWorkspaceId();
  const { data, isLoading } = useQuery(scheduledTaskRunsOptions(wsId, taskId));
  const runs = data?.items ?? [];

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-2">
        No runs yet
      </p>
    );
  }

  return (
    <div className="rounded border divide-y">
      <div className="grid grid-cols-[100px_80px_80px_1fr] gap-3 px-3 py-1.5 text-xs font-medium text-muted-foreground">
        <span>Time</span>
        <span>Status</span>
        <span>Duration</span>
        <span>Error</span>
      </div>
      {runs.map((run) => (
        <div
          key={run.id}
          className="grid grid-cols-[100px_80px_80px_1fr] gap-3 items-center px-3 py-1.5 text-xs"
        >
          <span className="text-muted-foreground">{timeAgo(run.created_at)}</span>
          <span className="flex items-center gap-1">
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                run.status === "success"
                  ? "bg-green-500"
                  : run.status === "failed"
                    ? "bg-red-500"
                    : "bg-yellow-500"
              }`}
            />
            {run.status}
          </span>
          <span className="text-muted-foreground">
            {run.duration_ms != null ? `${run.duration_ms}ms` : "—"}
          </span>
          <span className="text-red-400 truncate">
            {run.error_message ?? "—"}
          </span>
        </div>
      ))}
    </div>
  );
}
