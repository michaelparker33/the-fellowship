import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { goalKeys } from "./queries";
import { issueKeys } from "../issues/queries";

export function useCreateGoal(wsId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { title: string; description?: string; parent_goal_id?: string }) =>
      api.createGoal(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: goalKeys.all(wsId) });
    },
  });
}

export function useSetIssueGoal(wsId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ issueId, goalId }: { issueId: string; goalId: string | null }) =>
      api.setIssueGoal(issueId, goalId),
    onSuccess: (_data, { issueId }) => {
      qc.invalidateQueries({ queryKey: goalKeys.all(wsId) });
      qc.invalidateQueries({ queryKey: issueKeys.detail(wsId, issueId) });
    },
  });
}
