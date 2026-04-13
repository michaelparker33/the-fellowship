import { queryOptions } from "@tanstack/react-query";
import { api } from "../api";

export const shadowKeys = {
  all: (wsId: string) => ["shadow", wsId] as const,
  runs: (wsId: string) => [...shadowKeys.all(wsId), "runs"] as const,
  stats: (wsId: string) => [...shadowKeys.all(wsId), "stats"] as const,
  configs: (wsId: string) => [...shadowKeys.all(wsId), "configs"] as const,
};

export function shadowRunsOptions(wsId: string) {
  return queryOptions({
    queryKey: shadowKeys.runs(wsId),
    queryFn: () => api.listShadowRuns(),
  });
}

export function shadowStatsOptions(wsId: string) {
  return queryOptions({
    queryKey: shadowKeys.stats(wsId),
    queryFn: () => api.getShadowStats(),
  });
}

export function shadowConfigsOptions(wsId: string) {
  return queryOptions({
    queryKey: shadowKeys.configs(wsId),
    queryFn: () => api.listShadowConfigs(),
  });
}
