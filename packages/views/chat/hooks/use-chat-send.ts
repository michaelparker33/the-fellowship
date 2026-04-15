"use client";

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@multica/core/api";
import { useChatStore } from "@multica/core/chat";
import { chatKeys } from "@multica/core/chat/queries";
import { useCreateChatSession } from "@multica/core/chat/mutations";
import { createLogger } from "@multica/core/logger";
import type { Agent, ChatMessage } from "@multica/core/types";

const logger = createLogger("chat.send");

/**
 * Provides handleSend, handleStop, and isSending for chat interactions.
 * `isSending` is true from the instant the user hits send until the
 * server returns a task_id — gives immediate UI feedback before WS
 * events start flowing.
 */
export function useChatSend(activeAgent: Agent | null) {
  const activeSessionId = useChatStore((s) => s.activeSessionId);
  const pendingTaskId = useChatStore((s) => s.pendingTaskId);
  const setActiveSession = useChatStore((s) => s.setActiveSession);
  const setPendingTask = useChatStore((s) => s.setPendingTask);
  const clearTimeline = useChatStore((s) => s.clearTimeline);
  const qc = useQueryClient();
  const createSession = useCreateChatSession();
  const [isSending, setIsSending] = useState(false);

  const handleSend = useCallback(
    async (content: string) => {
      if (!activeAgent) return;

      setIsSending(true);
      logger.info("send.start", { contentLength: content.length });

      try {
        let sessionId = activeSessionId;

        if (!sessionId) {
          const session = await createSession.mutateAsync({
            agent_id: activeAgent.id,
            title: content.slice(0, 50),
          });
          sessionId = session.id;
          setActiveSession(sessionId);
        }

        // Optimistic: show user message immediately.
        const optimistic: ChatMessage = {
          id: `optimistic-${Date.now()}`,
          chat_session_id: sessionId,
          role: "user",
          content,
          task_id: null,
          created_at: new Date().toISOString(),
        };
        qc.setQueryData<ChatMessage[]>(
          chatKeys.messages(sessionId),
          (old) => (old ? [...old, optimistic] : [optimistic]),
        );

        const result = await api.sendChatMessage(sessionId, content);
        logger.info("send.taskCreated", { taskId: result.task_id });
        setPendingTask(result.task_id);
        qc.invalidateQueries({ queryKey: chatKeys.messages(sessionId) });
      } catch (err) {
        logger.error("send.failed", err);
      } finally {
        setIsSending(false);
      }
    },
    [activeSessionId, activeAgent, createSession, setActiveSession, setPendingTask, qc],
  );

  const handleStop = useCallback(async () => {
    if (!pendingTaskId) return;
    try {
      await api.cancelTaskById(pendingTaskId);
    } catch {
      // Task may already be completed
    }
    if (activeSessionId) {
      qc.invalidateQueries({ queryKey: chatKeys.messages(activeSessionId) });
    }
    clearTimeline();
    setPendingTask(null);
  }, [pendingTaskId, activeSessionId, clearTimeline, setPendingTask, qc]);

  return { handleSend, handleStop, isSending };
}
