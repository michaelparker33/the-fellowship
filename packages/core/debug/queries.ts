import { queryOptions } from "@tanstack/react-query";
import { api } from "../api";

export const debugKeys = {
  all: (wsId: string) => ["debug", wsId] as const,
  timeline: (wsId: string, issueId: string) =>
    [...debugKeys.all(wsId), "timeline", issueId] as const,
  forks: (wsId: string) => [...debugKeys.all(wsId), "forks"] as const,
};

export function debugTimelineOptions(wsId: string, issueId: string) {
  return queryOptions({
    queryKey: debugKeys.timeline(wsId, issueId),
    queryFn: () => api.getDebugTimeline(issueId),
  });
}

export function debugForksOptions(wsId: string) {
  return queryOptions({
    queryKey: debugKeys.forks(wsId),
    queryFn: () => api.listForks(),
  });
}
