"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useWS } from "@multica/core/realtime";
import { useChatStore } from "@multica/core/chat";
import { chatKeys } from "@multica/core/chat/queries";
import { useWorkspaceId } from "@multica/core/hooks";
import { createLogger } from "@multica/core/logger";
import type { TaskMessagePayload, ChatDonePayload } from "@multica/core/types";

const logger = createLogger("chat.streaming");

/**
 * Subscribes to WS events for the currently-pending chat task.
 * Accumulates timeline items in the chat store and finalizes
 * when the task completes or fails.
 *
 * Also runs a safety-net poll: if `pendingTaskId` has been set for more
 * than 5 s without any WS event, we poll the server to confirm the task
 * is still running. This recovers from dropped WS events, reconnect
 * gaps, and the race where `chat:done` arrives before the HTTP response
 * that sets `pendingTaskId`.
 */
export function useChatStreaming() {
  const wsId = useWorkspaceId();
  const pendingTaskId = useChatStore((s) => s.pendingTaskId);
  const addTimelineItem = useChatStore((s) => s.addTimelineItem);
  const clearTimeline = useChatStore((s) => s.clearTimeline);
  const setPendingTask = useChatStore((s) => s.setPendingTask);
  const qc = useQueryClient();

  const pendingTaskRef = useRef<string | null>(pendingTaskId);
  pendingTaskRef.current = pendingTaskId;

  const { subscribe } = useWS();

  // ── WS event handlers ─────────────────────────────────────────────────
  useEffect(() => {
    const matchesPending = (taskId: string) =>
      !!pendingTaskRef.current && taskId === pendingTaskRef.current;

    const finalizePending = () => {
      const sid = useChatStore.getState().activeSessionId;
      if (sid) {
        qc.invalidateQueries({ queryKey: chatKeys.messages(sid) });
        qc.invalidateQueries({ queryKey: chatKeys.pendingTask(sid) });
      }
      const currentWsId = wsId;
      if (currentWsId) {
        qc.invalidateQueries({ queryKey: chatKeys.pendingTasks(currentWsId) });
        qc.invalidateQueries({ queryKey: chatKeys.sessions(currentWsId) });
      }
      clearTimeline();
      setPendingTask(null);
      logger.info("finalized pending task");
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
      logger.info("chat:done received", { task_id: p.task_id });
      finalizePending();
    });

    const unsubCompleted = subscribe("task:completed", (payload) => {
      const p = payload as { task_id: string };
      if (!matchesPending(p.task_id)) return;
      logger.info("task:completed received", { task_id: p.task_id });
      finalizePending();
    });

    const unsubFailed = subscribe("task:failed", (payload) => {
      const p = payload as { task_id: string };
      if (!matchesPending(p.task_id)) return;
      logger.warn("task:failed received", { task_id: p.task_id });
      finalizePending();
    });

    return () => {
      unsubMessage();
      unsubDone();
      unsubCompleted();
      unsubFailed();
    };
  }, [subscribe, addTimelineItem, clearTimeline, setPendingTask, qc, wsId]);

  // ── Safety-net poll ───────────────────────────────────────────────────
  // If a WS event is dropped (disconnect, race, etc.), the UI would stay
  // stuck in "working" forever. This interval checks the server every 5s
  // while a task is pending. If the server says nothing is running, we
  // finalize immediately.
  useEffect(() => {
    if (!pendingTaskId) return;
    const sessionId = useChatStore.getState().activeSessionId;
    if (!sessionId) return;

    const interval = setInterval(async () => {
      // Still pending?
      if (!useChatStore.getState().pendingTaskId) {
        clearInterval(interval);
        return;
      }
      try {
        const result = await qc.fetchQuery({
          queryKey: chatKeys.pendingTask(sessionId),
          queryFn: () =>
            import("@multica/core/api").then((m) =>
              m.api.getPendingChatTask(sessionId),
            ),
          staleTime: 0, // force fresh fetch
        });
        const taskId = (result as { task_id?: string })?.task_id;
        if (!taskId) {
          // Server says no pending task — WS event was lost
          logger.warn("safety-net: server reports no pending task, finalizing", { sessionId });
          qc.invalidateQueries({ queryKey: chatKeys.messages(sessionId) });
          qc.invalidateQueries({ queryKey: chatKeys.pendingTask(sessionId) });
          if (wsId) {
            qc.invalidateQueries({ queryKey: chatKeys.pendingTasks(wsId) });
            qc.invalidateQueries({ queryKey: chatKeys.sessions(wsId) });
          }
          clearTimeline();
          setPendingTask(null);
        }
      } catch {
        // Network error — don't clear, just wait for next tick
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [pendingTaskId, clearTimeline, setPendingTask, qc, wsId]);
}
