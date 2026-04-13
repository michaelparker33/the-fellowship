import { queryOptions } from "@tanstack/react-query";
import { api } from "../api";

export const achievementKeys = {
  all: (wsId: string) => ["achievements", wsId] as const,
  list: (wsId: string) => [...achievementKeys.all(wsId), "list"] as const,
};

export function achievementsOptions(wsId: string) {
  return queryOptions({
    queryKey: achievementKeys.list(wsId),
    queryFn: () => api.listAchievements(),
  });
}
