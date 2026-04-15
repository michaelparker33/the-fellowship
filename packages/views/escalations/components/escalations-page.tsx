"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWorkspaceId } from "@multica/core/hooks";
import {
  escalationListOptions,
  escalationCountOptions,
} from "@multica/core/escalations/queries";
import { useResolveEscalation } from "@multica/core/escalations/mutations";
import type { LoopDetection, EscalationDecision } from "@multica/core/types";
import { toast } from "sonner";
import { AlertTriangle, ChevronDown, ChevronRight, RefreshCw, SkipForward, StopCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@multica/ui/components/ui/button";
import { Badge } from "@multica/ui/components/ui/badge";
import { Skeleton } from "@multica/ui/components/ui/skeleton";
import { cn } from "@multica/ui/lib/utils";

function EscalationCard({
  escalation,
  onResolve,
  isResolving,
}: {
  escalation: LoopDetection;
  onResolve: (id: string, decision: EscalationDecision) => void;
  isResolving: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const isResolved = escalation.escalation_status === "resolved";

  const decisionLabels: Record<string, string> = {
    retry_different: "Retry with different approach",
    skip: "Skip task",
    stop: "Stop",
  };

  return (
    <div
      className={cn(
        "rounded-lg border p-4 space-y-3",
        isResolved ? "border-border bg-secondary" : "border-destructive/30 bg-destructive/10",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <AlertTriangle className={cn("size-4 shrink-0", isResolved ? "text-muted-foreground" : "text-destructive")} />
            <span className="text-sm font-medium truncate">
              Issue: {escalation.issue_id.slice(0, 8)}...
            </span>
            <Badge variant={isResolved ? "secondary" : "destructive"} className="shrink-0">
              {isResolved ? "Resolved" : `${escalation.consecutive_failures} failures`}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Agent: {escalation.agent_id.slice(0, 8)}...
          </p>
          {isResolved && escalation.escalation_decision && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <CheckCircle2 className="size-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {decisionLabels[escalation.escalation_decision] ?? escalation.escalation_decision}
              </span>
            </div>
          )}
        </div>

        {!isResolved && (
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              size="sm"
              variant="default"
              disabled={isResolving}
              onClick={() => onResolve(escalation.id, "retry_different")}
            >
              <RefreshCw className="size-3.5 mr-1" />
              Retry Different
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={isResolving}
              onClick={() => onResolve(escalation.id, "skip")}
            >
              <SkipForward className="size-3.5 mr-1" />
              Skip
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={isResolving}
              onClick={() => onResolve(escalation.id, "stop")}
            >
              <StopCircle className="size-3.5 mr-1" />
              Stop
            </Button>
          </div>
        )}
      </div>

      {/* Failure history toggle */}
      {escalation.failure_history.length > 0 && (
        <div>
          <button
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
            {escalation.failure_history.length} failure{escalation.failure_history.length !== 1 ? "s" : ""} recorded
          </button>
          {expanded && (
            <div className="mt-2 space-y-1.5 pl-4 border-l-2 border-border">
              {escalation.failure_history.map((entry, i) => (
                <div key={i} className="text-xs">
                  <span className="text-muted-foreground">
                    {new Date(entry.timestamp).toLocaleString()}
                  </span>
                  <span className="text-foreground ml-2">{entry.reason}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function EscalationsPage() {
  const wsId = useWorkspaceId();

  const { data, isLoading } = useQuery(escalationListOptions(wsId));
  const escalations: LoopDetection[] = data?.items ?? [];

  const { data: countData } = useQuery(escalationCountOptions(wsId));
  const count = countData?.count ?? 0;

  const resolveMut = useResolveEscalation();

  const handleResolve = (id: string, decision: EscalationDecision) => {
    resolveMut.mutate(
      { id, decision },
      {
        onSuccess: () => {
          const labels: Record<string, string> = {
            retry_different: "Retrying with different approach",
            skip: "Task skipped",
            stop: "Stopped",
          };
          toast.success(labels[decision] ?? "Resolved");
        },
        onError: () => {
          toast.error("Failed to resolve escalation");
        },
      },
    );
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <AlertTriangle className="size-5 text-destructive" />
          <h1 className="text-xl font-semibold">Escalations</h1>
          {count > 0 && (
            <Badge variant="destructive">{count}</Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          Tasks that have failed 3 or more consecutive times and need human intervention.
        </p>

        {/* Content */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
        ) : escalations.length === 0 ? (
          <div className="text-center py-16">
            <AlertTriangle className="size-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">No escalations</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Escalations appear when an agent fails the same task 3+ times in a row.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {escalations.map((esc) => (
              <EscalationCard
                key={esc.id}
                escalation={esc}
                onResolve={handleResolve}
                isResolving={resolveMut.isPending}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
