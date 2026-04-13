import { queryOptions } from "@tanstack/react-query";
import { api } from "../api";

export const observatoryKeys = {
  all: () => ["observatory"] as const,
  memory: () => [...observatoryKeys.all(), "memory"] as const,
  corrections: (wsId: string) => [...observatoryKeys.all(), "corrections", wsId] as const,
  patterns: (wsId: string) => [...observatoryKeys.all(), "patterns", wsId] as const,
  health: () => [...observatoryKeys.all(), "health"] as const,
  profiles: (wsId: string) => [...observatoryKeys.all(), "profiles", wsId] as const,
  sessions: (wsId: string) => [...observatoryKeys.all(), "sessions", wsId] as const,
};

export function observatoryMemoryOptions() {
  return queryOptions({
    queryKey: observatoryKeys.memory(),
    queryFn: () => api.getObservatoryMemory(),
    refetchInterval: 60_000,
  });
}

export function observatoryCorrectionsOptions(wsId: string) {
  return queryOptions({
    queryKey: observatoryKeys.corrections(wsId),
    queryFn: () => api.getObservatoryCorrections(),
    staleTime: 30_000,
  });
}

export function observatoryPatternsOptions(wsId: string) {
  return queryOptions({
    queryKey: observatoryKeys.patterns(wsId),
    queryFn: () => api.getObservatoryPatterns(),
    staleTime: 60_000,
  });
}

export function observatoryHealthOptions() {
  return queryOptions({
    queryKey: observatoryKeys.health(),
    queryFn: () => api.getObservatoryHealth(),
    refetchInterval: 30_000,
  });
}

export function observatoryProfilesOptions(wsId: string) {
  return queryOptions({
    queryKey: observatoryKeys.profiles(wsId),
    queryFn: () => api.getObservatoryProfiles(),
    staleTime: 30_000,
  });
}

export function observatorySessionsOptions(wsId: string) {
  return queryOptions({
    queryKey: observatoryKeys.sessions(wsId),
    queryFn: () => api.getObservatorySessions(),
    staleTime: 30_000,
  });
}
