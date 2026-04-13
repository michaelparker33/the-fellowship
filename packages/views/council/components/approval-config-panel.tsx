"use client";

import { useQuery } from "@tanstack/react-query";
import { useWorkspaceId } from "@multica/core/hooks";
import { approvalConfigsOptions, trustScoresOptions, promotionSuggestionsOptions } from "@multica/core/council/queries";
import { useUpdateApprovalConfig, useDismissPromotion, useAcceptPromotion, useUpdateApprovalConfigDryRun } from "@multica/core/council/mutations";
import type { AutonomyLevel } from "@multica/core/types";
import { toast } from "sonner";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@multica/ui/components/ui/select";
import { Skeleton } from "@multica/ui/components/ui/skeleton";
import { Button } from "@multica/ui/components/ui/button";
import { Switch } from "@multica/ui/components/ui/switch";
import { TrendingUp } from "lucide-react";

const autonomyLabels: Record<AutonomyLevel, string> = {
  full: "Full Autonomy",
  supervised: "Supervised",
  manual: "Manual Approval",
};

export function ApprovalConfigPanel() {
  const wsId = useWorkspaceId();
  const { data, isLoading } = useQuery(approvalConfigsOptions(wsId));
  const configs = data?.items ?? [];
  const updateConfig = useUpdateApprovalConfig();
  const updateDryRun = useUpdateApprovalConfigDryRun();

  const handleChange = (actionType: string, level: AutonomyLevel) => {
    updateConfig.mutate(
      { actionType, autonomyLevel: level },
      {
        onSuccess: () => toast.success(`Updated ${actionType}`),
        onError: (err) => toast.error(err.message),
      },
    );
  };

  const handleDryRunToggle = (actionType: string, requireDryRun: boolean) => {
    updateDryRun.mutate(
      { actionType, requireDryRun },
      {
        onSuccess: () => toast.success(`Dry run ${requireDryRun ? "enabled" : "disabled"} for ${actionType}`),
        onError: (err) => toast.error(err.message),
      },
    );
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (configs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No approval configs yet. They'll be created when agents start requesting actions.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Autonomy Config */}
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Set the autonomy level for each action type. Manual requires explicit
          approval. Supervised logs for review. Full runs without intervention.
        </p>
        <div className="divide-y">
          {configs.map((config) => (
            <div
              key={config.id}
              className="flex items-center justify-between py-3 gap-3"
            >
              <div className="min-w-0">
                <span className="font-mono text-sm">{config.action_type}</span>
                {config.auto_approve && (
                  <span className="ml-2 text-xs text-green-500">
                    (auto-approve on)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <Switch
                    checked={config.require_dry_run}
                    onCheckedChange={(checked) =>
                      handleDryRunToggle(config.action_type, checked)
                    }
                  />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    Dry run
                  </span>
                </label>
                <Select
                  value={config.autonomy_level}
                  onValueChange={(v) =>
                    handleChange(config.action_type, v as AutonomyLevel)
                  }
                >
                  <SelectTrigger className="w-[170px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">
                      {autonomyLabels.full}
                    </SelectItem>
                    <SelectItem value="supervised">
                      {autonomyLabels.supervised}
                    </SelectItem>
                    <SelectItem value="manual">
                      {autonomyLabels.manual}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Trust Scores */}
      <TrustScoresSection />
    </div>
  );
}

function TrustScoresSection() {
  const wsId = useWorkspaceId();
  const { data: trustData } = useQuery(trustScoresOptions(wsId));
  const { data: promoData } = useQuery(promotionSuggestionsOptions(wsId));
  const dismissPromotion = useDismissPromotion();
  const acceptPromotion = useAcceptPromotion();

  const trustScores = trustData?.items ?? [];
  const promotions = promoData?.items ?? [];

  if (trustScores.length === 0 && promotions.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">Trust Scores</h3>
      </div>

      {/* Promotion suggestions */}
      {promotions.length > 0 && (
        <div className="flex flex-col gap-2">
          {promotions.map((p) => (
            <div
              key={p.id}
              className="rounded-lg border border-green-500/30 bg-green-500/5 p-3"
            >
              <p className="text-sm">
                <span className="font-medium">{p.agent_name}</span> has{" "}
                <span className="font-mono text-green-500">
                  {Math.round(p.approval_rate * 100)}%
                </span>{" "}
                approval rate on{" "}
                <span className="font-mono">{p.action_type}</span>{" "}
                ({p.total_approvals}/{p.total_approvals + p.total_rejections + p.total_edits}{" "}
                approved, {p.total_edits} edited). Promote to next tier?
              </p>
              <div className="flex gap-2 mt-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-green-500 hover:bg-green-500/10"
                  onClick={() =>
                    acceptPromotion.mutate(p.id, {
                      onSuccess: () => toast.success(`Promoted ${p.action_type}`),
                    })
                  }
                >
                  Promote
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    dismissPromotion.mutate(p.id, {
                      onSuccess: () => toast.info("Dismissed"),
                    })
                  }
                >
                  Dismiss
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Trust score table */}
      {trustScores.length > 0 && (
        <div className="divide-y text-sm">
          <div className="grid grid-cols-5 gap-2 py-2 text-xs text-muted-foreground font-medium">
            <span>Agent</span>
            <span>Action</span>
            <span className="text-right">Rate</span>
            <span className="text-right">Streak</span>
            <span className="text-right">Total</span>
          </div>
          {trustScores.map((ts) => (
            <div key={ts.id} className="grid grid-cols-5 gap-2 py-2 items-center">
              <span className="truncate">{ts.agent_name}</span>
              <span className="font-mono text-xs truncate">{ts.action_type}</span>
              <span className="text-right font-mono">
                {Math.round(ts.approval_rate * 100)}%
              </span>
              <span className="text-right font-mono">
                {ts.consecutive_clean_approvals}
              </span>
              <span className="text-right text-muted-foreground">
                {ts.total_approvals + ts.total_rejections + ts.total_edits}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
