"use client";

import { useQuery } from "@tanstack/react-query";
import { useWorkspaceId } from "@multica/core/hooks";
import { eventTriggerListOptions } from "@multica/core/watch/queries";
import {
  useDeleteEventTrigger,
  useToggleEventTrigger,
} from "@multica/core/watch/mutations";
import { toast } from "sonner";
import {
  Webhook,
  Database,
  Bot,
  GitBranch,
  Trash2,
  MoreHorizontal,
  Zap,
} from "lucide-react";
import { Switch } from "@multica/ui/components/ui/switch";
import { Skeleton } from "@multica/ui/components/ui/skeleton";
import { Badge } from "@multica/ui/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@multica/ui/components/ui/dropdown-menu";
import { cn } from "@multica/ui/lib/utils";

const triggerTypeIcons: Record<string, typeof Webhook> = {
  webhook: Webhook,
  db_change: Database,
  agent_output: Bot,
  github_event: GitBranch,
};

const triggerTypeLabels: Record<string, string> = {
  webhook: "Webhook",
  db_change: "DB Change",
  agent_output: "Agent Output",
  github_event: "GitHub Event",
};

const triggerTypeColors: Record<string, string> = {
  webhook: "bg-blue-500/15 text-blue-500",
  db_change: "bg-purple-500/15 text-purple-500",
  agent_output: "bg-green-500/15 text-green-500",
  github_event: "bg-orange-500/15 text-orange-500",
};

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

export function TriggerList() {
  const wsId = useWorkspaceId();
  const { data, isLoading } = useQuery(eventTriggerListOptions(wsId));
  const triggers = data?.items ?? [];

  const deleteMut = useDeleteEventTrigger();
  const toggleMut = useToggleEventTrigger();

  const handleDelete = (id: string) => {
    deleteMut.mutate(id, {
      onSuccess: () => toast.success("Trigger deleted"),
      onError: (err) => toast.error(err.message),
    });
  };

  const handleToggle = (id: string) => {
    toggleMut.mutate(id);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (triggers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Zap className="h-12 w-12 mb-4 opacity-30" />
        <p className="text-lg">No event triggers</p>
        <p className="text-sm mt-1">
          Create triggers that fire agent tasks from webhooks, DB changes, or
          GitHub events
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border divide-y">
      {/* Table header */}
      <div className="grid grid-cols-[1fr_120px_120px_120px_60px_48px] gap-4 px-4 py-2 text-xs font-medium text-muted-foreground">
        <span>Name</span>
        <span>Type</span>
        <span>Last Fired</span>
        <span>Enabled</span>
        <span>Fires</span>
        <span />
      </div>
      {triggers.map((trigger) => {
        const Icon = triggerTypeIcons[trigger.trigger_type] ?? Zap;
        return (
          <div
            key={trigger.id}
            className="grid grid-cols-[1fr_120px_120px_120px_60px_48px] gap-4 items-center px-4 py-3"
          >
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">{trigger.name}</p>
              <p className="text-xs text-muted-foreground truncate">
                {trigger.prompt_template.slice(0, 60)}
                {trigger.prompt_template.length > 60 ? "..." : ""}
              </p>
            </div>
            <Badge
              className={cn(
                "text-xs px-1.5 py-0 w-fit",
                triggerTypeColors[trigger.trigger_type],
              )}
            >
              <Icon className="h-3 w-3 mr-1" />
              {triggerTypeLabels[trigger.trigger_type] ?? trigger.trigger_type}
            </Badge>
            <div className="flex items-center gap-1.5">
              {trigger.last_fired_at ? (
                <span className="text-xs text-muted-foreground">
                  {timeAgo(trigger.last_fired_at)}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">Never</span>
              )}
            </div>
            <div>
              <Switch
                checked={trigger.enabled}
                onCheckedChange={() => handleToggle(trigger.id)}
              />
            </div>
            <span className="text-sm text-muted-foreground">
              {trigger.fire_count}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    className="p-1 rounded hover:bg-muted"
                  />
                }
              >
                <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => handleDelete(trigger.id)}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      })}
    </div>
  );
}
