import { queryOptions } from "@tanstack/react-query";
import { api } from "../api";

export const missionKeys = {
  all: (wsId: string) => ["missions", wsId] as const,
  list: (wsId: string, projectId?: string) =>
    [...missionKeys.all(wsId), "list", projectId ?? "all"] as const,
  detail: (wsId: string, id: string) =>
    [...missionKeys.all(wsId), "detail", id] as const,
  activeForProject: (wsId: string, projectId: string) =>
    [...missionKeys.all(wsId), "active", projectId] as const,
};

export function missionListOptions(wsId: string, projectId?: string) {
  return queryOptions({
    queryKey: missionKeys.list(wsId, projectId),
    queryFn: () => api.listMissions({ project_id: projectId }),
  });
}

export function missionDetailOptions(wsId: string, id: string) {
  return queryOptions({
    queryKey: missionKeys.detail(wsId, id),
    queryFn: () => api.getMission(id),
  });
}

export function activeMissionOptions(wsId: string, projectId: string) {
  return queryOptions({
    queryKey: missionKeys.activeForProject(wsId, projectId),
    queryFn: () => api.listMissions({ project_id: projectId, limit: 1 }),
    select: (data) => {
      const active = data.missions.find(
        (m) => m.status === "pending" || m.status === "running",
      );
      return active ?? null;
    },
    refetchInterval: (query) => {
      // query.state.data is the post-select value: Mission | null | undefined
      const mission = query.state.data as { status?: string } | null | undefined;
      if (mission?.status === "pending" || mission?.status === "running") {
        return 5000;
      }
      return false;
    },
  });
}
