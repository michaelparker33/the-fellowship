import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { debugKeys } from "./queries";
import { useWorkspaceId } from "../hooks";
import type { CreateForkRequest } from "../types";

export function useCreateFork() {
  const qc = useQueryClient();
  const wsId = useWorkspaceId();
  return useMutation({
    mutationFn: ({ issueId, data }: { issueId: string; data: CreateForkRequest }) =>
      api.createFork(issueId, data),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: debugKeys.all(wsId) });
    },
  });
}
