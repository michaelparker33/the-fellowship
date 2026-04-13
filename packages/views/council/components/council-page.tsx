"use client";

import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWorkspaceId } from "@multica/core/hooks";
import {
  approvalListOptions,
} from "@multica/core/council/queries";
import {
  useApproveApproval,
  useRejectApproval,
  useExecuteDryRun,
  useBatchApproveApprovals,
  useBatchRejectApprovals,
} from "@multica/core/council/mutations";
import type {
  ApprovalStatus,
  ApprovalRiskLevel,
  DryRunResult,
} from "@multica/core/types";
import { toast } from "sonner";
import { Shield, Settings2, CheckCheck, Check, X } from "lucide-react";
import { Button } from "@multica/ui/components/ui/button";
import { Checkbox } from "@multica/ui/components/ui/checkbox";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@multica/ui/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@multica/ui/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@multica/ui/components/ui/alert-dialog";
import { Skeleton } from "@multica/ui/components/ui/skeleton";
import { ApprovalCard } from "./approval-card";
import { ApprovalConfigPanel } from "./approval-config-panel";

type StatusFilter = ApprovalStatus | "all";
type RiskFilter = ApprovalRiskLevel | "all";

export function CouncilPage() {
  const wsId = useWorkspaceId();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [configOpen, setConfigOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [approveAllOpen, setApproveAllOpen] = useState(false);

  const params = {
    status: statusFilter === "all" ? undefined : statusFilter,
    risk_level: riskFilter === "all" ? undefined : riskFilter,
    action_type: actionFilter === "all" ? undefined : actionFilter,
    limit: 50,
  };

  const { data, isLoading } = useQuery(approvalListOptions(wsId, params));
  const approvals = data?.items ?? [];
  const total = data?.total ?? 0;

  const pendingApprovals = useMemo(
    () => approvals.filter((a) => a.status === "pending"),
    [approvals],
  );

  const pendingStandardCount = useMemo(
    () => pendingApprovals.filter((a) => a.risk_score <= 3).length,
    [pendingApprovals],
  );

  const approveMut = useApproveApproval();
  const rejectMut = useRejectApproval();
  const dryRunMut = useExecuteDryRun();
  const batchApproveMut = useBatchApproveApprovals();
  const batchRejectMut = useBatchRejectApprovals();
  const [dryRunResults, setDryRunResults] = useState<Record<string, DryRunResult>>({});

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(pendingApprovals.map((a) => a.id)));
  }, [pendingApprovals]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const allPendingSelected =
    pendingApprovals.length > 0 &&
    pendingApprovals.every((a) => selectedIds.has(a.id));

  const handleBatchApprove = () => {
    const ids = Array.from(selectedIds);
    batchApproveMut.mutate(
      { approval_ids: ids },
      {
        onSuccess: (res) => {
          toast.success(`Approved ${res.approved} item${res.approved !== 1 ? "s" : ""}`);
          clearSelection();
        },
        onError: () => toast.error("Failed to batch approve"),
      },
    );
  };

  const handleBatchReject = () => {
    const ids = Array.from(selectedIds);
    batchRejectMut.mutate(
      { approval_ids: ids },
      {
        onSuccess: (res) => {
          toast.success(`Rejected ${res.rejected} item${res.rejected !== 1 ? "s" : ""}`);
          clearSelection();
        },
        onError: () => toast.error("Failed to batch reject"),
      },
    );
  };

  const handleApproveAllStandard = () => {
    batchApproveMut.mutate(
      { max_risk_score: 3 },
      {
        onSuccess: (res) => {
          toast.success(`Approved ${res.approved} standard item${res.approved !== 1 ? "s" : ""}`);
          setApproveAllOpen(false);
          clearSelection();
        },
        onError: () => {
          toast.error("Failed to approve standard items");
          setApproveAllOpen(false);
        },
      },
    );
  };

  const handleApprove = (id: string, note?: string) => {
    approveMut.mutate(
      { id, note },
      {
        onSuccess: (res) => {
          toast.success("Approval granted");
          if (res.auto_approve_suggested) {
            toast.info(
              "You've approved this action type 5 times in a row. Consider enabling auto-approve in settings.",
              { duration: 8000 },
            );
          }
        },
        onError: (err) => toast.error(err.message),
      },
    );
  };

  const handleReject = (id: string, note?: string) => {
    rejectMut.mutate(
      { id, note },
      {
        onSuccess: () => toast.success("Approval rejected"),
        onError: (err) => toast.error(err.message),
      },
    );
  };

  const handleDryRun = (id: string) => {
    dryRunMut.mutate(id, {
      onSuccess: (result) => {
        setDryRunResults((prev) => ({ ...prev, [id]: result }));
        if (result.valid) {
          toast.success("Dry run passed");
        } else {
          toast.warning("Dry run found issues");
        }
      },
      onError: (err) => toast.error(err.message),
    });
  };

  const actionTypes = useMemo(() => {
    const types: string[] = [];
    for (const a of approvals) {
      if (!types.includes(a.action_type)) types.push(a.action_type);
    }
    return types;
  }, [approvals]);

  const selectionCount = selectedIds.size;
  const batchLoading = batchApproveMut.isPending || batchRejectMut.isPending;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b px-5">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <h1 className="text-sm font-medium">The Council</h1>
        </div>
        <div className="flex items-center gap-2">
          {pendingStandardCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setApproveAllOpen(true)}
              className="text-green-500 hover:bg-green-500/10 hover:text-green-400"
            >
              <CheckCheck className="h-4 w-4 mr-2" />
              Approve All Standard ({pendingStandardCount})
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setConfigOpen(true)}>
            <Settings2 className="h-4 w-4 mr-2" />
            Configure
          </Button>
        </div>
        <Dialog open={configOpen} onOpenChange={setConfigOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Approval Configuration</DialogTitle>
            </DialogHeader>
            <ApprovalConfigPanel />
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as StatusFilter)}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={riskFilter}
          onValueChange={(v) => setRiskFilter(v as RiskFilter)}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Risks</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>

        {actionTypes.length > 0 && (
          <Select
            value={actionFilter}
            onValueChange={(v) => setActionFilter(v ?? "all")}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              {actionTypes.map((at) => (
                <SelectItem key={at} value={at}>
                  {at}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <span className="text-sm text-muted-foreground self-center ml-auto">
          {total} total
        </span>
      </div>

      {/* Approval List */}
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-lg" />
          ))}
        </div>
      ) : approvals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Shield className="h-12 w-12 mb-4 opacity-30" />
          <p className="text-lg">No approval requests</p>
          <p className="text-sm mt-1">
            Agent actions requiring review will appear here
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {approvals.map((approval) => (
            <div key={approval.id} className="flex items-start gap-3">
              {approval.status === "pending" && (
                <div className="pt-5">
                  <Checkbox
                    checked={selectedIds.has(approval.id)}
                    onCheckedChange={() => toggleSelect(approval.id)}
                  />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <ApprovalCard
                  approval={approval}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  onDryRun={handleDryRun}
                  dryRunLoading={dryRunMut.isPending && dryRunMut.variables === approval.id}
                  dryRunResult={dryRunResults[approval.id]}
                />
              </div>
            </div>
          ))}
        </div>
      )}
      </div>

      {/* Batch Action Toolbar */}
      {selectionCount > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 rounded-lg border bg-background px-2 py-1.5 shadow-lg">
          <div className="flex items-center gap-1.5 pl-1 pr-2 border-r mr-1">
            <span className="text-sm font-medium">{selectionCount} selected</span>
            <button
              type="button"
              onClick={clearSelection}
              className="rounded p-0.5 hover:bg-accent transition-colors"
            >
              <X className="size-3.5 text-muted-foreground" />
            </button>
          </div>

          <Button
            variant="ghost"
            size="sm"
            disabled={batchLoading}
            onClick={allPendingSelected ? clearSelection : selectAll}
          >
            {allPendingSelected ? "Deselect All" : "Select All"}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            disabled={batchLoading}
            onClick={handleBatchApprove}
            className="text-green-500 hover:text-green-400"
          >
            <Check className="size-3.5 mr-1" />
            Approve ({selectionCount})
          </Button>

          <Button
            variant="ghost"
            size="sm"
            disabled={batchLoading}
            onClick={handleBatchReject}
            className="text-red-500 hover:text-red-400"
          >
            <X className="size-3.5 mr-1" />
            Reject ({selectionCount})
          </Button>
        </div>
      )}

      {/* Approve All Standard Dialog */}
      <AlertDialog open={approveAllOpen} onOpenChange={setApproveAllOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Approve all standard items?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will approve {pendingStandardCount} pending item{pendingStandardCount !== 1 ? "s" : ""} with
              risk score 3 or below. These are low-risk actions that are typically safe to auto-approve.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleApproveAllStandard}
              disabled={batchLoading}
              className="bg-green-600 text-white hover:bg-green-700"
            >
              Approve {pendingStandardCount} item{pendingStandardCount !== 1 ? "s" : ""}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
