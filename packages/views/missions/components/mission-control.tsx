"use client";

import { useQuery } from "@tanstack/react-query";
import { Play, Square, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@multica/ui/lib/utils";
import { Button } from "@multica/ui/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@multica/ui/components/ui/tooltip";
import { useWorkspaceId } from "@multica/core/hooks";
import { activeMissionOptions } from "@multica/core/missions/queries";
import { useStartMission, useStopMission } from "@multica/core/missions/mutations";
import { issueListOptions } from "@multica/core/issues/queries";
import type { Mission, Issue } from "@multica/core/types";

// ---------------------------------------------------------------------------
// MissionProgressBar — shows live progress when a mission is active
// ---------------------------------------------------------------------------

function MissionProgressBar({
  mission,
  currentIssueName,
  onStop,
  isStopping,
}: {
  mission: Mission;
  currentIssueName: string | null;
  onStop: () => void;
  isStopping: boolean;
}) {
  const pct = Math.round(mission.progress * 100);
  const isActive = mission.status === "running" || mission.status === "pending";

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2">
      {/* Status icon */}
      {mission.status === "running" && (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-500" />
      )}
      {mission.status === "completed" && (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
      )}
      {mission.status === "failed" && (
        <XCircle className="h-4 w-4 shrink-0 text-destructive" />
      )}
      {mission.status === "stopped" && (
        <Square className="h-4 w-4 shrink-0 text-muted-foreground" />
      )}
      {mission.status === "pending" && (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
      )}

      {/* Progress info */}
      <div className="flex flex-1 min-w-0 flex-col gap-1">
        <div className="flex items-center justify-between text-xs">
          <span className="truncate text-muted-foreground">
            {isActive && currentIssueName
              ? `Running: ${currentIssueName}`
              : mission.status === "completed"
                ? "Mission completed"
                : mission.status === "stopped"
                  ? "Mission stopped"
                  : mission.status === "failed"
                    ? "Mission failed"
                    : "Starting mission..."}
          </span>
          <span className="shrink-0 tabular-nums text-muted-foreground">
            {mission.completed_tasks}/{mission.total_tasks}
          </span>
        </div>
        <div className="relative h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              "absolute inset-y-0 left-0 rounded-full transition-all duration-500",
              mission.status === "completed"
                ? "bg-emerald-500"
                : mission.status === "failed"
                  ? "bg-destructive"
                  : "bg-blue-500",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Stop button */}
      {isActive && (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-xs"
                className="shrink-0 text-destructive hover:text-destructive"
                onClick={onStop}
                disabled={isStopping}
              >
                <Square className="h-3.5 w-3.5" />
              </Button>
            }
          />
          <TooltipContent>Stop mission</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MissionControl — the button + progress bar combo for project detail
// ---------------------------------------------------------------------------

export function MissionControl({ projectId }: { projectId: string }) {
  const wsId = useWorkspaceId();
  const { data: activeMission, isLoading } = useQuery(activeMissionOptions(wsId, projectId));
  const { data: allIssues = [] } = useQuery(issueListOptions(wsId));
  const startMission = useStartMission();
  const stopMission = useStopMission();

  // Resolve current issue name.
  const currentIssueName = activeMission?.current_task_id
    ? (allIssues as Issue[]).find((i) => i.id === activeMission.current_task_id)?.title ?? null
    : null;

  const handleStart = () => {
    startMission.mutate(projectId, {
      onError: (err) => {
        toast.error(err.message || "Failed to start mission");
      },
    });
  };

  const handleStop = () => {
    if (!activeMission) return;
    stopMission.mutate(activeMission.id, {
      onError: (err) => {
        toast.error(err.message || "Failed to stop mission");
      },
    });
  };

  if (isLoading) return null;

  // Show progress bar when there is an active or recently completed mission.
  if (activeMission) {
    return (
      <MissionProgressBar
        mission={activeMission}
        currentIssueName={currentIssueName}
        onStop={handleStop}
        isStopping={stopMission.isPending}
      />
    );
  }

  // Show start button.
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="secondary"
            size="sm"
            className="gap-1.5"
            onClick={handleStart}
            disabled={startMission.isPending}
          >
            {startMission.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            Run All Tasks
          </Button>
        }
      />
      <TooltipContent>Start a continuous mission to run all agent-assigned tasks in order</TooltipContent>
    </Tooltip>
  );
}
