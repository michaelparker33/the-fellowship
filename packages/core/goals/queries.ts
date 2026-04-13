import { queryOptions } from "@tanstack/react-query";
import { api } from "../api";

export const goalKeys = {
  all: (wsId: string) => ["goals", wsId] as const,
  list: (wsId: string) => [...goalKeys.all(wsId), "list"] as const,
  chain: (goalId: string) => ["goals", "chain", goalId] as const,
};

export function goalsOptions(wsId: string) {
  return queryOptions({
    queryKey: goalKeys.list(wsId),
    queryFn: async () => {
      const res = await api.listGoals();
      return res.items;
    },
  });
}

export function goalChainOptions(goalId: string | undefined | null) {
  return queryOptions({
    queryKey: goalKeys.chain(goalId ?? ""),
    queryFn: async () => {
      const res = await api.getGoalChain(goalId!);
      return res.chain;
    },
    enabled: !!goalId,
  });
}
