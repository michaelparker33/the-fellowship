import { queryOptions } from "@tanstack/react-query";
import { api } from "../api";

export const escalationKeys = {
  all: (wsId: string) => ["escalations", wsId] as const,
  list: (wsId: string) => [...escalationKeys.all(wsId), "list"] as const,
  count: (wsId: string) => [...escalationKeys.all(wsId), "count"] as const,
};

export function escalationListOptions(wsId: string) {
  return queryOptions({
    queryKey: escalationKeys.list(wsId),
    queryFn: () => api.listEscalations(),
    refetchInterval: 30_000,
  });
}

export function escalationCountOptions(wsId: string) {
  return queryOptions({
    queryKey: escalationKeys.count(wsId),
    queryFn: () => api.countEscalations(),
    refetchInterval: 30_000,
  });
}
