import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { shadowKeys } from "./queries";
import { useWorkspaceId } from "../hooks";
import type { CreateShadowConfigRequest } from "../types";

export function useRateShadowRun() {
  const qc = useQueryClient();
  const wsId = useWorkspaceId();
  return useMutation({
    mutationFn: ({ id, score }: { id: string; score: number }) =>
      api.rateShadowRun(id, score),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: shadowKeys.all(wsId) });
    },
  });
}

export function useUpsertShadowConfig() {
  const qc = useQueryClient();
  const wsId = useWorkspaceId();
  return useMutation({
    mutationFn: (data: CreateShadowConfigRequest) =>
      api.upsertShadowConfig(data),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: shadowKeys.configs(wsId) });
    },
  });
}

export function useDeleteShadowConfig() {
  const qc = useQueryClient();
  const wsId = useWorkspaceId();
  return useMutation({
    mutationFn: (id: string) => api.deleteShadowConfig(id),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: shadowKeys.configs(wsId) });
    },
  });
}
