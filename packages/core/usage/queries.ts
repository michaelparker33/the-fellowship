import { queryOptions } from "@tanstack/react-query";
import { api } from "../api";

export const usageKeys = {
  all: (wsId: string) => ["usage", wsId] as const,
  daily: (wsId: string, days: number) =>
    [...usageKeys.all(wsId), "daily", days] as const,
  summary: (wsId: string, days: number) =>
    [...usageKeys.all(wsId), "summary", days] as const,
  byAgent: (wsId: string, days: number) =>
    [...usageKeys.all(wsId), "by-agent", days] as const,
  dailySpend: (wsId: string) =>
    [...usageKeys.all(wsId), "daily-spend"] as const,
};

export function usageDailyOptions(wsId: string, days = 30) {
  return queryOptions({
    queryKey: usageKeys.daily(wsId, days),
    queryFn: () => api.getUsageByDay(days),
  });
}

export function usageSummaryOptions(wsId: string, days = 30) {
  return queryOptions({
    queryKey: usageKeys.summary(wsId, days),
    queryFn: () => api.getUsageSummary(days),
  });
}

export function usageByAgentOptions(wsId: string, days = 30) {
  return queryOptions({
    queryKey: usageKeys.byAgent(wsId, days),
    queryFn: () => api.getUsageByAgent(days),
  });
}
