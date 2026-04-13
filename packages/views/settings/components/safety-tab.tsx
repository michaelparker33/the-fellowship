"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWorkspaceId } from "@multica/core/hooks";
import { safetyConfigOptions } from "@multica/core/safety/queries";
import {
  useUpdateSafetyConfig,
  useActivateEmergencyStop,
  useDeactivateEmergencyStop,
} from "@multica/core/safety/mutations";
import { toast } from "sonner";
import { AlertTriangle, ShieldOff, ShieldCheck } from "lucide-react";
import { Button } from "@multica/ui/components/ui/button";
import { Input } from "@multica/ui/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@multica/ui/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@multica/ui/components/ui/dialog";
import { Skeleton } from "@multica/ui/components/ui/skeleton";

export function SafetyTab() {
  const wsId = useWorkspaceId();
  const { data: config, isLoading } = useQuery(safetyConfigOptions(wsId));
  const updateConfig = useUpdateSafetyConfig();
  const activateStop = useActivateEmergencyStop();
  const deactivateStop = useDeactivateEmergencyStop();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmPhrase, setConfirmPhrase] = useState("");

  const [dailyLimit, setDailyLimit] = useState<number | null>(null);
  const [monthlyLimit, setMonthlyLimit] = useState<number | null>(null);
  const [maxConcurrent, setMaxConcurrent] = useState<number | null>(null);

  // Use config defaults when local state is null
  const effectiveDaily = dailyLimit ?? config?.daily_spend_limit_cents ?? 5000;
  const effectiveMonthly = monthlyLimit ?? config?.monthly_spend_limit_cents ?? 50000;
  const effectiveConcurrent = maxConcurrent ?? config?.max_concurrent_tasks ?? 5;

  const handleSaveLimits = () => {
    updateConfig.mutate(
      {
        daily_spend_limit_cents: effectiveDaily,
        monthly_spend_limit_cents: effectiveMonthly,
        max_concurrent_tasks: effectiveConcurrent,
      },
      {
        onSuccess: () => toast.success("Safety limits updated"),
        onError: (err) => toast.error(err.message),
      },
    );
  };

  const handleEmergencyStop = () => {
    if (confirmPhrase !== "YOU SHALL NOT PASS") return;
    activateStop.mutate(undefined, {
      onSuccess: () => {
        toast.error("Emergency stop activated — all operations halted");
        setConfirmOpen(false);
        setConfirmPhrase("");
      },
      onError: (err) => toast.error(err.message),
    });
  };

  const handleResume = () => {
    deactivateStop.mutate(undefined, {
      onSuccess: () => toast.success("Operations resumed"),
      onError: (err) => toast.error(err.message),
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Spend Limits */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Spend Limits</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">
              Daily limit (cents)
            </label>
            <Input
              type="number"
              value={effectiveDaily}
              onChange={(e) => setDailyLimit(Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground mt-1">
              ${(effectiveDaily / 100).toFixed(2)} per day
            </p>
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">
              Monthly limit (cents)
            </label>
            <Input
              type="number"
              value={effectiveMonthly}
              onChange={(e) => setMonthlyLimit(Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground mt-1">
              ${(effectiveMonthly / 100).toFixed(2)} per month
            </p>
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">
              Max concurrent tasks
            </label>
            <Input
              type="number"
              min={1}
              max={20}
              value={effectiveConcurrent}
              onChange={(e) => setMaxConcurrent(Number(e.target.value))}
            />
          </div>
          <Button onClick={handleSaveLimits} className="self-end">
            Save Limits
          </Button>
        </CardContent>
      </Card>

      {/* Emergency Stop */}
      <Card className={config?.emergency_stop ? "border-red-500/50" : ""}>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Emergency Stop
          </CardTitle>
        </CardHeader>
        <CardContent>
          {config?.emergency_stop ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-red-500">
                <ShieldOff className="h-5 w-5" />
                <span className="font-medium">Emergency stop is ACTIVE</span>
              </div>
              {config.emergency_stop_at && (
                <p className="text-sm text-muted-foreground">
                  Activated: {new Date(config.emergency_stop_at).toLocaleString()}
                </p>
              )}
              <Button
                variant="outline"
                className="text-green-500 hover:bg-green-500/10 self-start"
                onClick={handleResume}
              >
                <ShieldCheck className="h-4 w-4 mr-2" />
                Resume Operations
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                Emergency stop will immediately halt ALL agent operations across
                this workspace. Use only when necessary.
              </p>
              <Button
                variant="destructive"
                className="self-start"
                onClick={() => setConfirmOpen(true)}
              >
                <ShieldOff className="h-4 w-4 mr-2" />
                EMERGENCY STOP — YOU SHALL NOT PASS
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-500">Confirm Emergency Stop</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <p className="text-sm">
              This will immediately halt ALL agent operations across this
              workspace. Type <strong>YOU SHALL NOT PASS</strong> to confirm.
            </p>
            <Input
              value={confirmPhrase}
              onChange={(e) => setConfirmPhrase(e.target.value)}
              placeholder="Type: YOU SHALL NOT PASS"
              className="font-mono"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setConfirmOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={confirmPhrase !== "YOU SHALL NOT PASS"}
                onClick={handleEmergencyStop}
              >
                Activate Emergency Stop
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
