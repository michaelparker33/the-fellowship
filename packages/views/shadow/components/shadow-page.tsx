"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWorkspaceId } from "@multica/core/hooks";
import {
  shadowRunsOptions,
  shadowStatsOptions,
  shadowConfigsOptions,
} from "@multica/core/shadow/queries";
import {
  useUpsertShadowConfig,
  useDeleteShadowConfig,
  useRateShadowRun,
} from "@multica/core/shadow/mutations";
import type { ShadowRun } from "@multica/core/types";
import { toast } from "sonner";
import {
  FlaskConical,
  Star,
  Trash2,
  Plus,
  BarChart3,
} from "lucide-react";
import { Button } from "@multica/ui/components/ui/button";
import { Input } from "@multica/ui/components/ui/input";
import { Switch } from "@multica/ui/components/ui/switch";
import { Badge } from "@multica/ui/components/ui/badge";
import { Skeleton } from "@multica/ui/components/ui/skeleton";
import { cn } from "@multica/ui/lib/utils";

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

export function ShadowPage() {
  const [tab, setTab] = useState<"runs" | "settings">("runs");

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b px-5">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-muted-foreground" />
            <h1 className="text-sm font-medium">Shadow Mode</h1>
          </div>
          <div className="flex items-center gap-1 border-l pl-4">
            <button
              type="button"
              onClick={() => setTab("runs")}
              className={cn(
                "px-2.5 py-1 text-xs font-medium rounded-md transition-colors",
                tab === "runs"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <BarChart3 className="h-3 w-3 inline mr-1" />
              Runs
            </button>
            <button
              type="button"
              onClick={() => setTab("settings")}
              className={cn(
                "px-2.5 py-1 text-xs font-medium rounded-md transition-colors",
                tab === "settings"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Settings
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {tab === "runs" ? (
          <ShadowRunsList />
        ) : (
          <ShadowSettings />
        )}
      </div>
    </div>
  );
}

function ShadowRunsList() {
  const wsId = useWorkspaceId();
  const { data: runsData, isLoading } = useQuery(shadowRunsOptions(wsId));
  const { data: statsData } = useQuery(shadowStatsOptions(wsId));
  const runs: ShadowRun[] = runsData?.items ?? [];
  const rateMut = useRateShadowRun();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats summary */}
      {statsData && statsData.total_runs > 0 && (
        <div className="grid grid-cols-4 gap-4">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Total Runs</p>
            <p className="text-lg font-medium">{statsData.total_runs}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Avg Quality</p>
            <p className="text-lg font-medium">
              {statsData.avg_quality > 0
                ? `${statsData.avg_quality.toFixed(1)}/5`
                : "N/A"}
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Avg Shadow Cost</p>
            <p className="text-lg font-medium">
              ${statsData.avg_shadow_cost.toFixed(4)}
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Avg Primary Cost</p>
            <p className="text-lg font-medium">
              ${statsData.avg_primary_cost.toFixed(4)}
            </p>
          </div>
        </div>
      )}

      {runs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <FlaskConical className="h-12 w-12 mb-4 opacity-30" />
          <p className="text-lg">No shadow runs yet</p>
          <p className="text-sm mt-1">
            Configure shadow models in Settings to start comparing outputs
          </p>
        </div>
      ) : (
        <div className="rounded-lg border divide-y">
          {runs.map((run) => (
            <div key={run.id} className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs font-mono">
                  {run.primary_model}
                </Badge>
                <span className="text-xs text-muted-foreground">vs</span>
                <Badge className="bg-purple-500/15 text-purple-500 text-xs font-mono">
                  {run.shadow_model}
                </Badge>
                <span className="text-xs text-muted-foreground ml-auto">
                  {timeAgo(run.created_at)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="text-muted-foreground mb-1">Primary Output</p>
                  <pre className="bg-muted rounded p-2 max-h-24 overflow-y-auto text-xs">
                    {run.primary_output?.slice(0, 300) ?? "Pending..."}
                  </pre>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Shadow Output</p>
                  <pre className="bg-muted rounded p-2 max-h-24 overflow-y-auto text-xs">
                    {run.shadow_output?.slice(0, 300) ?? "Pending..."}
                  </pre>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                {run.primary_duration_ms != null && (
                  <span>Primary: {run.primary_duration_ms}ms</span>
                )}
                {run.shadow_duration_ms != null && (
                  <span>Shadow: {run.shadow_duration_ms}ms</span>
                )}
                <div className="flex items-center gap-1 ml-auto">
                  {[1, 2, 3, 4, 5].map((score) => (
                    <button
                      key={score}
                      type="button"
                      onClick={() => rateMut.mutate({ id: run.id, score })}
                      className="hover:scale-110 transition-transform"
                    >
                      <Star
                        className={cn(
                          "h-4 w-4",
                          run.quality_score != null && score <= run.quality_score
                            ? "fill-yellow-500 text-yellow-500"
                            : "text-muted-foreground",
                        )}
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ShadowSettings() {
  const wsId = useWorkspaceId();
  const { data, isLoading } = useQuery(shadowConfigsOptions(wsId));
  const configs = data?.items ?? [];
  const upsertMut = useUpsertShadowConfig();
  const deleteMut = useDeleteShadowConfig();

  const [newModel, setNewModel] = useState("");
  const [newRate, setNewRate] = useState("0.1");

  const handleAdd = () => {
    if (!newModel) return;
    upsertMut.mutate(
      {
        shadow_model: newModel,
        enabled: true,
        sample_rate: parseFloat(newRate) || 0.1,
      },
      {
        onSuccess: () => {
          toast.success("Shadow config saved");
          setNewModel("");
          setNewRate("0.1");
        },
        onError: (err: Error) => toast.error(err.message),
      },
    );
  };

  const handleToggle = (config: { shadow_model: string; enabled: boolean; sample_rate: number }) => {
    upsertMut.mutate({
      shadow_model: config.shadow_model,
      enabled: !config.enabled,
      sample_rate: config.sample_rate,
    });
  };

  if (isLoading) {
    return <Skeleton className="h-32 w-full rounded-lg" />;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-4 space-y-3">
        <h3 className="text-sm font-medium">Add Shadow Model</h3>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Model name (e.g. gpt-4o-mini)"
            value={newModel}
            onChange={(e) => setNewModel(e.target.value)}
            className="flex-1"
          />
          <Input
            placeholder="Sample rate"
            value={newRate}
            onChange={(e) => setNewRate(e.target.value)}
            className="w-24"
            type="number"
            min="0"
            max="1"
            step="0.05"
          />
          <Button size="sm" onClick={handleAdd}>
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>
      </div>

      {configs.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          No shadow models configured yet
        </div>
      ) : (
        <div className="rounded-lg border divide-y">
          {configs.map((config) => (
            <div
              key={config.id}
              className="flex items-center justify-between px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium font-mono">
                  {config.shadow_model}
                </p>
                <p className="text-xs text-muted-foreground">
                  Sample rate: {(config.sample_rate * 100).toFixed(0)}%
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={config.enabled}
                  onCheckedChange={() => handleToggle(config)}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    deleteMut.mutate(config.id, {
                      onSuccess: () => toast.success("Config deleted"),
                    });
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
