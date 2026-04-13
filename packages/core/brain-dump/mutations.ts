import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { brainDumpKeys } from "./queries";
import { useWorkspaceId } from "../hooks";
import type { BrainDump } from "../types";

export function useCreateBrainDump() {
  const qc = useQueryClient();
  const wsId = useWorkspaceId();
  return useMutation({
    mutationFn: (content: string) => api.createBrainDump(content),
    onMutate: async (content) => {
      await qc.cancelQueries({ queryKey: brainDumpKeys.list(wsId) });
      const prev = qc.getQueryData<{ brain_dumps: BrainDump[]; total: number }>(brainDumpKeys.list(wsId));
      const optimistic: BrainDump = {
        id: `temp-${Date.now()}`,
        workspace_id: wsId,
        content,
        processed: false,
        converted_issue_id: null,
        created_by: "",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      qc.setQueryData<{ brain_dumps: BrainDump[]; total: number }>(brainDumpKeys.list(wsId), (old) => ({
        brain_dumps: [optimistic, ...(old?.brain_dumps ?? [])],
        total: (old?.total ?? 0) + 1,
      }));
      return { prev };
    },
    onError: (_err, _content, ctx) => {
      if (ctx?.prev) qc.setQueryData(brainDumpKeys.list(wsId), ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: brainDumpKeys.list(wsId) });
      qc.invalidateQueries({ queryKey: brainDumpKeys.unprocessedCount(wsId) });
    },
  });
}

export function useProcessBrainDump() {
  const qc = useQueryClient();
  const wsId = useWorkspaceId();
  return useMutation({
    mutationFn: ({ id, issueId }: { id: string; issueId?: string }) =>
      api.processBrainDump(id, issueId),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: brainDumpKeys.list(wsId) });
      qc.invalidateQueries({ queryKey: brainDumpKeys.unprocessedCount(wsId) });
    },
  });
}

export function useDeleteBrainDump() {
  const qc = useQueryClient();
  const wsId = useWorkspaceId();
  return useMutation({
    mutationFn: (id: string) => api.deleteBrainDump(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: brainDumpKeys.list(wsId) });
      const prev = qc.getQueryData<{ brain_dumps: BrainDump[]; total: number }>(brainDumpKeys.list(wsId));
      qc.setQueryData<{ brain_dumps: BrainDump[]; total: number }>(brainDumpKeys.list(wsId), (old) => ({
        brain_dumps: (old?.brain_dumps ?? []).filter((d) => d.id !== id),
        total: Math.max(0, (old?.total ?? 0) - 1),
      }));
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(brainDumpKeys.list(wsId), ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: brainDumpKeys.list(wsId) });
      qc.invalidateQueries({ queryKey: brainDumpKeys.unprocessedCount(wsId) });
    },
  });
}
