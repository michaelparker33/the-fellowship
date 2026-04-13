"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWorkspaceId } from "@multica/core/hooks";
import { scheduledTaskListOptions } from "@multica/core/watch/queries";
import {
  useDeleteScheduledTask,
  useToggleScheduledTask,
  useTriggerScheduledTask,
} from "@multica/core/watch/mutations";
import type { ScheduledTask } from "@multica/core/types";
import { toast } from "sonner";
import { Clock, Plus, Play, Trash2, MoreHorizontal, Zap } from "lucide-react";
import { Button } from "@multica/ui/components/ui/button";
import { cn } from "@multica/ui/lib/utils";
import { Switch } from "@multica/ui/components/ui/switch";
import { Skeleton } from "@multica/ui/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@multica/ui/components/ui/dropdown-menu";
import { TaskFormModal } from "./task-form-modal";
import { RunHistory } from "./run-history";
import { TriggerList } from "./trigger-list";

function cronToHuman(cron: string): string {
  const parts = cron.split(" ");
  if (parts.length !== 5) return cron;
  const [min, hour, dom, mon, dow] = parts;

  if (min?.startsWith("*/"))
    return `Every ${min.slice(2)} minutes`;
  if (hour?.startsWith("*/"))
    return `Every ${hour.slice(2)} hours`;
  if (dow === "*" && dom === "*" && mon === "*" && hour !== "*" && min !== "*")
    return `Daily at ${hour}:${min?.padStart(2, "0")}`;
  if (dow === "1-5" && dom === "*" && mon === "*")
    return `Weekdays at ${hour}:${min?.padStart(2, "0")}`;
  if (dow === "1" && dom === "*" && mon === "*")
    return `Mondays at ${hour}:${min?.padStart(2, "0")}`;
  return cron;
}

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

export function WatchPage() {
  const wsId = useWorkspaceId();
  const { data, isLoading } = useQuery(scheduledTaskListOptions(wsId));
  const tasks = data?.items ?? [];

  const [tab, setTab] = useState<"crons" | "events">("crons");
  const [createOpen, setCreateOpen] = useState(false);
  const [editTask, setEditTask] = useState<ScheduledTask | null>(null);
  const [expandedRuns, setExpandedRuns] = useState<string | null>(null);

  const deleteMut = useDeleteScheduledTask();
  const toggleMut = useToggleScheduledTask();
  const triggerMut = useTriggerScheduledTask();

  const handleDelete = (id: string) => {
    deleteMut.mutate(id, {
      onSuccess: () => toast.success("Task deleted"),
      onError: (err) => toast.error(err.message),
    });
  };

  const handleToggle = (id: string, enabled: boolean) => {
    toggleMut.mutate({ id, enabled });
  };

  const handleTrigger = (id: string) => {
    triggerMut.mutate(id, {
      onSuccess: () => toast.success("Task triggered"),
      onError: (err) => toast.error(err.message),
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b px-5">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <h1 className="text-sm font-medium">The Watch</h1>
          </div>
          <div className="flex items-center gap-1 border-l pl-4">
            <button
              type="button"
              onClick={() => setTab("crons")}
              className={cn(
                "px-2.5 py-1 text-xs font-medium rounded-md transition-colors",
                tab === "crons"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Clock className="h-3 w-3 inline mr-1" />
              Crons
            </button>
            <button
              type="button"
              onClick={() => setTab("events")}
              className={cn(
                "px-2.5 py-1 text-xs font-medium rounded-md transition-colors",
                tab === "events"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Zap className="h-3 w-3 inline mr-1" />
              Events
            </button>
          </div>
        </div>
        {tab === "crons" && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Task
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
      {tab === "events" ? (
        <TriggerList />
      ) : (
      <>
      {/* Task List */}
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Clock className="h-12 w-12 mb-4 opacity-30" />
          <p className="text-lg">No scheduled tasks</p>
          <p className="text-sm mt-1">
            Create automated tasks that run on a cron schedule
          </p>
        </div>
      ) : (
        <div className="rounded-lg border divide-y">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_180px_120px_120px_60px_48px] gap-4 px-4 py-2 text-xs font-medium text-muted-foreground">
            <span>Name</span>
            <span>Schedule</span>
            <span>Last Run</span>
            <span>Enabled</span>
            <span>Runs</span>
            <span />
          </div>
          {tasks.map((task) => (
            <div key={task.id}>
              <div className="grid grid-cols-[1fr_180px_120px_120px_60px_48px] gap-4 items-center px-4 py-3">
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedRuns(expandedRuns === task.id ? null : task.id)
                    }
                    className="font-medium text-sm hover:underline text-left truncate block w-full"
                  >
                    {task.name}
                  </button>
                  <p className="text-xs text-muted-foreground truncate">
                    {task.timezone}
                  </p>
                </div>
                <span className="text-sm text-muted-foreground">
                  {cronToHuman(task.cron_expression)}
                </span>
                <div className="flex items-center gap-1.5">
                  {task.last_run_at ? (
                    <>
                      <span
                        className={`inline-block h-2 w-2 rounded-full ${
                          task.last_status === "success"
                            ? "bg-green-500"
                            : task.last_status === "failed"
                              ? "bg-red-500"
                              : "bg-yellow-500"
                        }`}
                      />
                      <span className="text-xs text-muted-foreground">
                        {timeAgo(task.last_run_at)}
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">Never</span>
                  )}
                </div>
                <div>
                  <Switch
                    checked={task.enabled}
                    onCheckedChange={(checked) =>
                      handleToggle(task.id, !!checked)
                    }
                  />
                </div>
                <span className="text-sm text-muted-foreground">
                  {task.run_count}
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger render={<button type="button" className="p-1 rounded hover:bg-muted" />}>
                    <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setEditTask(task)}>
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleTrigger(task.id)}>
                      <Play className="h-3.5 w-3.5 mr-2" />
                      Run Now
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => handleDelete(task.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {expandedRuns === task.id && (
                <div className="px-4 pb-3">
                  <RunHistory taskId={task.id} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      </>
      )}

      </div>

      {/* Create / Edit modals */}
      {createOpen && (
        <TaskFormModal onClose={() => setCreateOpen(false)} />
      )}
      {editTask && (
        <TaskFormModal
          task={editTask}
          onClose={() => setEditTask(null)}
        />
      )}
    </div>
  );
}
