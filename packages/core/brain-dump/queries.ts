import { queryOptions } from "@tanstack/react-query";
import { api } from "../api";

export const brainDumpKeys = {
  all: (wsId: string) => ["brain-dumps", wsId] as const,
  list: (wsId: string) => [...brainDumpKeys.all(wsId), "list"] as const,
  unprocessedCount: (wsId: string) => [...brainDumpKeys.all(wsId), "unprocessed-count"] as const,
};

export function brainDumpListOptions(wsId: string) {
  return queryOptions({
    queryKey: brainDumpKeys.list(wsId),
    queryFn: () => api.listBrainDumps(),
  });
}

export function brainDumpUnprocessedCountOptions(wsId: string) {
  return queryOptions({
    queryKey: brainDumpKeys.unprocessedCount(wsId),
    queryFn: () => api.countUnprocessedBrainDumps(),
  });
}
