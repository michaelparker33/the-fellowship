import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { safetyKeys } from "./queries";
import { useWorkspaceId } from "../hooks";

export function useUpdateSafetyConfig() {
  const qc = useQueryClient();
  const wsId = useWorkspaceId();
  return useMutation({
    mutationFn: (data: {
      daily_spend_limit_cents: number;
      monthly_spend_limit_cents: number;
      max_concurrent_tasks: number;
    }) => api.updateSafetyConfig(data),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: safetyKeys.all(wsId) });
    },
  });
}

export function useActivateEmergencyStop() {
  const qc = useQueryClient();
  const wsId = useWorkspaceId();
  return useMutation({
    mutationFn: () => api.activateEmergencyStop(),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: safetyKeys.all(wsId) });
    },
  });
}

export function useDeactivateEmergencyStop() {
  const qc = useQueryClient();
  const wsId = useWorkspaceId();
  return useMutation({
    mutationFn: () => api.deactivateEmergencyStop(),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: safetyKeys.all(wsId) });
    },
  });
}
