import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { escalationKeys } from "./queries";
import { useWorkspaceId } from "../hooks";
import type { EscalationDecision } from "../types";

export function useResolveEscalation() {
  const qc = useQueryClient();
  const wsId = useWorkspaceId();
  return useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: EscalationDecision }) =>
      api.resolveEscalation(id, decision),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: escalationKeys.all(wsId) });
    },
  });
}
