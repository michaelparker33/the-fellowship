import { queryOptions } from "@tanstack/react-query";
import { api } from "../api";

export const watchKeys = {
  all: (wsId: string) => ["watch", wsId] as const,
  list: (wsId: string) => [...watchKeys.all(wsId), "list"] as const,
  runs: (wsId: string, taskId: string) =>
    [...watchKeys.all(wsId), "runs", taskId] as const,
  enabledCount: (wsId: string) =>
    [...watchKeys.all(wsId), "enabled-count"] as const,
  triggers: (wsId: string) => [...watchKeys.all(wsId), "triggers"] as const,
};

export function scheduledTaskListOptions(wsId: string) {
  return queryOptions({
    queryKey: watchKeys.list(wsId),
    queryFn: () => api.listScheduledTasks(),
  });
}

export function scheduledTaskRunsOptions(wsId: string, taskId: string) {
  return queryOptions({
    queryKey: watchKeys.runs(wsId, taskId),
    queryFn: () => api.listScheduledTaskRuns(taskId),
  });
}

export function eventTriggerListOptions(wsId: string) {
  return queryOptions({
    queryKey: watchKeys.triggers(wsId),
    queryFn: () => api.listEventTriggers(),
  });
}
