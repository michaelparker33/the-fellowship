"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWorkspaceId } from "@multica/core/hooks";
import {
  useCreateScheduledTask,
  useUpdateScheduledTask,
} from "@multica/core/watch/mutations";
import { workspaceKeys } from "@multica/core/workspace/queries";
import { api } from "@multica/core/api";
import type { ScheduledTask, Agent } from "@multica/core/types";
import { toast } from "sonner";
import { Button } from "@multica/ui/components/ui/button";
import { Input } from "@multica/ui/components/ui/input";
import { Textarea } from "@multica/ui/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@multica/ui/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@multica/ui/components/ui/dialog";

const PRESETS = [
  { label: "Every 5 min", cron: "*/5 * * * *" },
  { label: "Every 15 min", cron: "*/15 * * * *" },
  { label: "Every hour", cron: "0 * * * *" },
  { label: "Daily 9am", cron: "0 9 * * *" },
  { label: "Daily midnight", cron: "0 0 * * *" },
  { label: "Weekdays 9am", cron: "0 9 * * 1-5" },
  { label: "Monday 9am", cron: "0 9 * * 1" },
];

interface TaskFormModalProps {
  task?: ScheduledTask;
  onClose: () => void;
}

export function TaskFormModal({ task, onClose }: TaskFormModalProps) {
  const wsId = useWorkspaceId();
  const isEdit = !!task;

  const [name, setName] = useState(task?.name ?? "");
  const [cronExpr, setCronExpr] = useState(task?.cron_expression ?? "*/15 * * * *");
  const [timezone, setTimezone] = useState(task?.timezone ?? "America/Los_Angeles");
  const [agentId, setAgentId] = useState(task?.agent_id ?? "");
  const [prompt, setPrompt] = useState(task?.prompt ?? "");
  const [usePreset, setUsePreset] = useState(true);

  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: workspaceKeys.agents(wsId),
    queryFn: () => api.listAgents(),
  });

  const createMut = useCreateScheduledTask();
  const updateMut = useUpdateScheduledTask();

  const handleSubmit = () => {
    if (!name || !cronExpr || !agentId || !prompt) {
      toast.error("All fields are required");
      return;
    }

    if (isEdit && task) {
      updateMut.mutate(
        {
          id: task.id,
          data: { name, cron_expression: cronExpr, timezone, agent_id: agentId, prompt },
        },
        {
          onSuccess: () => {
            toast.success("Task updated");
            onClose();
          },
          onError: (err) => toast.error(err.message),
        },
      );
    } else {
      createMut.mutate(
        { name, cron_expression: cronExpr, timezone, agent_id: agentId, prompt },
        {
          onSuccess: () => {
            toast.success("Task created");
            onClose();
          },
          onError: (err) => toast.error(err.message),
        },
      );
    }
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit" : "New"} Scheduled Task</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 mt-2">
          <div>
            <label className="text-sm font-medium mb-1 block">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Daily standup" />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Agent</label>
            <Select value={agentId} onValueChange={(v) => setAgentId(v ?? "")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium">Schedule</label>
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setUsePreset(!usePreset)}
              >
                {usePreset ? "Custom cron" : "Presets"}
              </button>
            </div>
            {usePreset ? (
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.cron}
                    type="button"
                    onClick={() => setCronExpr(p.cron)}
                    className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                      cronExpr === p.cron
                        ? "border-foreground bg-foreground/10"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            ) : (
              <Input
                value={cronExpr}
                onChange={(e) => setCronExpr(e.target.value)}
                placeholder="*/15 * * * *"
                className="font-mono"
              />
            )}
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Timezone</label>
            <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Prompt</label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              placeholder="What should the agent do when this fires?"
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>
              {isEdit ? "Update" : "Create"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
