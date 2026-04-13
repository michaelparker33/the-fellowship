import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { watchKeys } from "./queries";
import { useWorkspaceId } from "../hooks";
import type { CreateScheduledTaskRequest, UpdateScheduledTaskRequest, CreateEventTriggerRequest, UpdateEventTriggerRequest } from "../types";

export function useCreateScheduledTask() {
  const qc = useQueryClient();
  const wsId = useWorkspaceId();
  return useMutation({
    mutationFn: (data: CreateScheduledTaskRequest) =>
      api.createScheduledTask(data),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: watchKeys.all(wsId) });
    },
  });
}

export function useUpdateScheduledTask() {
  const qc = useQueryClient();
  const wsId = useWorkspaceId();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateScheduledTaskRequest }) =>
      api.updateScheduledTask(id, data),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: watchKeys.all(wsId) });
    },
  });
}

export function useDeleteScheduledTask() {
  const qc = useQueryClient();
  const wsId = useWorkspaceId();
  return useMutation({
    mutationFn: (id: string) => api.deleteScheduledTask(id),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: watchKeys.all(wsId) });
    },
  });
}

export function useToggleScheduledTask() {
  const qc = useQueryClient();
  const wsId = useWorkspaceId();
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      api.toggleScheduledTask(id, enabled),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: watchKeys.all(wsId) });
    },
  });
}

export function useTriggerScheduledTask() {
  const qc = useQueryClient();
  const wsId = useWorkspaceId();
  return useMutation({
    mutationFn: (id: string) => api.triggerScheduledTask(id),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: watchKeys.all(wsId) });
    },
  });
}

// --- Event Triggers ---

export function useCreateEventTrigger() {
  const qc = useQueryClient();
  const wsId = useWorkspaceId();
  return useMutation({
    mutationFn: (data: CreateEventTriggerRequest) =>
      api.createEventTrigger(data),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: watchKeys.triggers(wsId) });
    },
  });
}

export function useUpdateEventTrigger() {
  const qc = useQueryClient();
  const wsId = useWorkspaceId();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateEventTriggerRequest }) =>
      api.updateEventTrigger(id, data),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: watchKeys.triggers(wsId) });
    },
  });
}

export function useDeleteEventTrigger() {
  const qc = useQueryClient();
  const wsId = useWorkspaceId();
  return useMutation({
    mutationFn: (id: string) => api.deleteEventTrigger(id),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: watchKeys.triggers(wsId) });
    },
  });
}

export function useToggleEventTrigger() {
  const qc = useQueryClient();
  const wsId = useWorkspaceId();
  return useMutation({
    mutationFn: (id: string) => api.toggleEventTrigger(id),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: watchKeys.triggers(wsId) });
    },
  });
}
