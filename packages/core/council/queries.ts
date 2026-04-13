import { queryOptions } from "@tanstack/react-query";
import { api } from "../api";
import type { ListApprovalsParams } from "../types";

export const councilKeys = {
  all: (wsId: string) => ["council", wsId] as const,
  list: (wsId: string, params?: ListApprovalsParams) =>
    [...councilKeys.all(wsId), "list", params ?? {}] as const,
  pendingCount: (wsId: string) =>
    [...councilKeys.all(wsId), "pending-count"] as const,
  configs: (wsId: string) => [...councilKeys.all(wsId), "configs"] as const,
  trustScores: (wsId: string) => [...councilKeys.all(wsId), "trust-scores"] as const,
  promotions: (wsId: string) => [...councilKeys.all(wsId), "promotions"] as const,
  contested: (wsId: string) => [...councilKeys.all(wsId), "contested"] as const,
  dryRuns: (wsId: string) => [...councilKeys.all(wsId), "dry-runs"] as const,
};

export function approvalListOptions(
  wsId: string,
  params?: ListApprovalsParams,
) {
  return queryOptions({
    queryKey: councilKeys.list(wsId, params),
    queryFn: () => api.listApprovals(params),
  });
}

export function pendingApprovalCountOptions(wsId: string) {
  return queryOptions({
    queryKey: councilKeys.pendingCount(wsId),
    queryFn: () => api.countPendingApprovals(),
    refetchInterval: 30_000,
  });
}

export function approvalConfigsOptions(wsId: string) {
  return queryOptions({
    queryKey: councilKeys.configs(wsId),
    queryFn: () => api.listApprovalConfigs(),
  });
}

export function trustScoresOptions(wsId: string) {
  return queryOptions({
    queryKey: councilKeys.trustScores(wsId),
    queryFn: () => api.listTrustScores(),
  });
}

export function promotionSuggestionsOptions(wsId: string) {
  return queryOptions({
    queryKey: councilKeys.promotions(wsId),
    queryFn: () => api.listPromotionSuggestions(),
    refetchInterval: 30_000,
  });
}

export function contestedApprovalsOptions(wsId: string) {
  return queryOptions({
    queryKey: councilKeys.contested(wsId),
    queryFn: () => api.listContestedApprovals(),
    refetchInterval: 30_000,
  });
}

export function dryRunApprovalsOptions(wsId: string) {
  return queryOptions({
    queryKey: councilKeys.dryRuns(wsId),
    queryFn: () => api.listDryRunResults(),
  });
}
