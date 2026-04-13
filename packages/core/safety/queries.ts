import { queryOptions } from "@tanstack/react-query";
import { api } from "../api";

export const safetyKeys = {
  all: (wsId: string) => ["safety", wsId] as const,
  config: (wsId: string) => [...safetyKeys.all(wsId), "config"] as const,
};

export function safetyConfigOptions(wsId: string) {
  return queryOptions({
    queryKey: safetyKeys.config(wsId),
    queryFn: () => api.getSafetyConfig(),
  });
}
