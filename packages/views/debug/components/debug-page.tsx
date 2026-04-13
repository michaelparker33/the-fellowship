"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWorkspaceId } from "@multica/core/hooks";
import { debugTimelineOptions } from "@multica/core/debug/queries";
import { useCreateFork } from "@multica/core/debug/mutations";
import type { TimelineStep } from "@multica/core/types";
import { toast } from "sonner";
import {
  GitFork,
  ChevronDown,
  ChevronUp,
  Bot,
  User,
  Wrench,
} from "lucide-react";
import { Button } from "@multica/ui/components/ui/button";
import { Textarea } from "@multica/ui/components/ui/textarea";
import { Badge } from "@multica/ui/components/ui/badge";
import { Skeleton } from "@multica/ui/components/ui/skeleton";
import { cn } from "@multica/ui/lib/utils";

const roleIcons: Record<string, typeof Bot> = {
  assistant: Bot,
  user: User,
  tool: Wrench,
  system: Bot,
};

const roleColors: Record<string, string> = {
  assistant: "border-purple-500/30 bg-purple-500/5",
  user: "border-blue-500/30 bg-blue-500/5",
  tool: "border-green-500/30 bg-green-500/5",
  system: "border-muted",
};

interface DebugPageProps {
  issueId: string;
}

export function DebugPage({ issueId }: DebugPageProps) {
  const wsId = useWorkspaceId();
  const { data, isLoading } = useQuery(debugTimelineOptions(wsId, issueId));
  const forkMut = useCreateFork();

  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [forkStep, setForkStep] = useState<number | null>(null);
  const [forkOutput, setForkOutput] = useState("");

  const steps = data?.steps ?? [];
  const forks = data?.forks ?? [];

  const handleFork = (step: number) => {
    forkMut.mutate(
      {
        issueId,
        data: {
          fork_at_step: step,
          modified_output: forkOutput || undefined,
        },
      },
      {
        onSuccess: () => {
          toast.success("Fork created");
          setForkStep(null);
          setForkOutput("");
        },
        onError: (err: Error) => toast.error(err.message),
      },
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b px-5">
        <div className="flex items-center gap-2">
          <GitFork className="h-4 w-4 text-muted-foreground" />
          <h1 className="text-sm font-medium">Fork & Replay Debugger</h1>
        </div>
        {forks.length > 0 && (
          <Badge variant="outline" className="text-xs">
            {forks.length} fork{forks.length !== 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {isLoading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : steps.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <GitFork className="h-12 w-12 mb-4 opacity-30" />
            <p className="text-lg">No task execution data</p>
            <p className="text-sm mt-1">
              Run an agent task on this issue to see the execution timeline
            </p>
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />

            <div className="space-y-3">
              {steps.map((step: TimelineStep) => {
                const Icon = roleIcons[step.role] ?? Bot;
                const hasFork = forks.some(
                  (f) => f.fork_at_step === step.step,
                );

                return (
                  <div key={step.step} className="relative pl-12">
                    {/* Timeline dot */}
                    <div
                      className={cn(
                        "absolute left-3 top-3 h-5 w-5 rounded-full border-2 flex items-center justify-center bg-background",
                        hasFork
                          ? "border-amber-500"
                          : "border-muted-foreground/30",
                      )}
                    >
                      <Icon className="h-3 w-3 text-muted-foreground" />
                    </div>

                    <div
                      className={cn(
                        "rounded-lg border p-3",
                        roleColors[step.role] ?? "border-muted",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className="text-xs font-mono"
                        >
                          #{step.step}
                        </Badge>
                        <span className="text-xs font-medium capitalize">
                          {step.role}
                        </span>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {new Date(step.time).toLocaleTimeString()}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedStep(
                              expandedStep === step.step
                                ? null
                                : step.step,
                            )
                          }
                          className="p-1 hover:bg-muted rounded"
                        >
                          {expandedStep === step.step ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )}
                        </button>
                      </div>

                      {/* Preview */}
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {step.content.slice(0, 120)}
                        {step.content.length > 120 ? "..." : ""}
                      </p>

                      {/* Expanded content */}
                      {expandedStep === step.step && (
                        <pre className="mt-2 rounded-md bg-muted p-3 text-xs overflow-x-auto max-h-64 whitespace-pre-wrap">
                          {step.content}
                        </pre>
                      )}

                      {/* Fork button */}
                      {forkStep === step.step ? (
                        <div className="mt-3 space-y-2">
                          <Textarea
                            placeholder="Modified output for replay (optional)..."
                            value={forkOutput}
                            onChange={(e) =>
                              setForkOutput(e.target.value)
                            }
                            rows={3}
                            className="text-xs"
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleFork(step.step)}
                              disabled={forkMut.isPending}
                            >
                              <GitFork className="h-3 w-3 mr-1" />
                              Create Fork
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setForkStep(null);
                                setForkOutput("");
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="mt-2 text-xs"
                          onClick={() => setForkStep(step.step)}
                        >
                          <GitFork className="h-3 w-3 mr-1" />
                          Fork from here
                        </Button>
                      )}

                      {/* Fork indicator */}
                      {hasFork && (
                        <Badge className="mt-2 bg-amber-500/15 text-amber-500 text-xs">
                          <GitFork className="h-3 w-3 mr-1" />
                          Forked
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
