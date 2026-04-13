import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { councilKeys } from "./queries";
import { useWorkspaceId } from "../hooks";
import type { AutonomyLevel, DryRunResult, BatchApproveParams, BatchRejectParams } from "../types";

export function useApproveApproval() {
  const qc = useQueryClient();
  const wsId = useWorkspaceId();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      api.approveApproval(id, note),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: councilKeys.all(wsId) });
    },
  });
}

export function useRejectApproval() {
  const qc = useQueryClient();
  const wsId = useWorkspaceId();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      api.rejectApproval(id, note),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: councilKeys.all(wsId) });
    },
  });
}

export function useUpdateApprovalConfig() {
  const qc = useQueryClient();
  const wsId = useWorkspaceId();
  return useMutation({
    mutationFn: ({
      actionType,
      autonomyLevel,
    }: {
      actionType: string;
      autonomyLevel: AutonomyLevel;
    }) => api.updateApprovalConfig(actionType, autonomyLevel),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: councilKeys.configs(wsId) });
    },
  });
}

export function useSetAutoApprove() {
  const qc = useQueryClient();
  const wsId = useWorkspaceId();
  return useMutation({
    mutationFn: ({
      actionType,
      autoApprove,
    }: {
      actionType: string;
      autoApprove: boolean;
    }) => api.setAutoApprove(actionType, autoApprove),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: councilKeys.configs(wsId) });
    },
  });
}

export function useDismissPromotion() {
  const qc = useQueryClient();
  const wsId = useWorkspaceId();
  return useMutation({
    mutationFn: (id: string) => api.dismissPromotion(id),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: councilKeys.all(wsId) });
    },
  });
}

export function useAcceptPromotion() {
  const qc = useQueryClient();
  const wsId = useWorkspaceId();
  return useMutation({
    mutationFn: (id: string) => api.acceptPromotion(id),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: councilKeys.all(wsId) });
    },
  });
}

export function useExecuteDryRun() {
  const qc = useQueryClient();
  const wsId = useWorkspaceId();
  return useMutation<DryRunResult, Error, string>({
    mutationFn: (approvalId: string) => api.executeDryRun(approvalId),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: councilKeys.all(wsId) });
    },
  });
}

export function useUpdateApprovalConfigDryRun() {
  const qc = useQueryClient();
  const wsId = useWorkspaceId();
  return useMutation({
    mutationFn: ({
      actionType,
      requireDryRun,
    }: {
      actionType: string;
      requireDryRun: boolean;
    }) => api.updateApprovalConfigDryRun(actionType, requireDryRun),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: councilKeys.configs(wsId) });
    },
  });
}

export function useBatchApproveApprovals() {
  const qc = useQueryClient();
  const wsId = useWorkspaceId();
  return useMutation({
    mutationFn: (params: BatchApproveParams) =>
      api.batchApproveApprovals(params),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: councilKeys.all(wsId) });
    },
  });
}

export function useBatchRejectApprovals() {
  const qc = useQueryClient();
  const wsId = useWorkspaceId();
  return useMutation({
    mutationFn: (params: BatchRejectParams) =>
      api.batchRejectApprovals(params),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: councilKeys.all(wsId) });
    },
  });
}
