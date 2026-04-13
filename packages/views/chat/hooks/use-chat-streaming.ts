"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useWS } from "@multica/core/realtime";
import { useChatStore } from "@multica/core/chat";
import { chatKeys } from "@multica/core/chat/queries";
import type { TaskMessagePayload, ChatDonePayload } from "@multica/core/types";

/**
 * Subscribes to WS events for the currently-pending chat task.
 * Accumulates timeline items in the chat store and finalizes
 * when the task completes or fails.
 */
export function useChatStreaming() {
  const pendingTaskId = useChatStore((s) => s.pendingTaskId);
  const addTimelineItem = useChatStore((s) => s.addTimelineItem);
  const clearTimeline = useChatStore((s) => s.clearTimeline);
  const setPendingTask = useChatStore((s) => s.setPendingTask);
  const qc = useQueryClient();

  const pendingTaskRef = useRef<string | null>(pendingTaskId);
  pendingTaskRef.current = pendingTaskId;

  const { subscribe } = useWS();

  useEffect(() => {
    const matchesPending = (taskId: string) =>
      !!pendingTaskRef.current && taskId === pendingTaskRef.current;

    const finalizePending = (invalidateCache: boolean) => {
      if (invalidateCache) {
        const sid = useChatStore.getState().activeSessionId;
        if (sid) {
          qc.invalidateQueries({ queryKey: chatKeys.messages(sid) });
        }
      }
      clearTimeline();
      setPendingTask(null);
    };

    const unsubMessage = subscribe("task:message", (payload) => {
      const p = payload as TaskMessagePayload;
      if (!matchesPending(p.task_id)) return;
      addTimelineItem({
        seq: p.seq,
        type: p.type,
        tool: p.tool,
        content: p.content,
        input: p.input,
        output: p.output,
      });
    });

    const unsubDone = subscribe("chat:done", (payload) => {
      const p = payload as ChatDonePayload;
      if (!matchesPending(p.task_id)) return;
      finalizePending(true);
    });

    const unsubCompleted = subscribe("task:completed", (payload) => {
      const p = payload as { task_id: string };
      if (!matchesPending(p.task_id)) return;
      finalizePending(true);
    });

    const unsubFailed = subscribe("task:failed", (payload) => {
      const p = payload as { task_id: string };
      if (!matchesPending(p.task_id)) return;
      finalizePending(false);
    });

    return () => {
      unsubMessage();
      unsubDone();
      unsubCompleted();
      unsubFailed();
    };
  }, [subscribe, addTimelineItem, clearTimeline, setPendingTask, qc]);
}
