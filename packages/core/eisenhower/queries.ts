import { queryOptions } from "@tanstack/react-query";
import { api } from "../api";

export const eisenhowerKeys = {
  all: (wsId: string) => ["eisenhower", wsId] as const,
  matrix: (wsId: string) => [...eisenhowerKeys.all(wsId), "matrix"] as const,
  counts: (wsId: string) => [...eisenhowerKeys.all(wsId), "counts"] as const,
};

export function eisenhowerMatrixOptions(wsId: string) {
  return queryOptions({
    queryKey: eisenhowerKeys.matrix(wsId),
    queryFn: () => api.listEisenhowerMatrix(),
  });
}

export function eisenhowerCountsOptions(wsId: string) {
  return queryOptions({
    queryKey: eisenhowerKeys.counts(wsId),
    queryFn: () => api.countEisenhowerQuadrants(),
  });
}
