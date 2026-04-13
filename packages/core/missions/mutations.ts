import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { missionKeys } from "./queries";
import { useWorkspaceId } from "../hooks";

export function useStartMission() {
  const qc = useQueryClient();
  const wsId = useWorkspaceId();
  return useMutation({
    mutationFn: (projectId: string) => api.startMission(projectId),
    onSettled: (_data, _err, projectId) => {
      qc.invalidateQueries({ queryKey: missionKeys.activeForProject(wsId, projectId) });
      qc.invalidateQueries({ queryKey: missionKeys.list(wsId, projectId) });
    },
  });
}

export function useStopMission() {
  const qc = useQueryClient();
  const wsId = useWorkspaceId();
  return useMutation({
    mutationFn: (id: string) => api.stopMission(id),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: missionKeys.all(wsId) });
    },
  });
}
