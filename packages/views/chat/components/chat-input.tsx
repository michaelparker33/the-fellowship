"use client";

import type { ReactNode } from "react";
import { useRef, useState, useCallback } from "react";
import { ContentEditor, type ContentEditorRef } from "../../editor";
import { SubmitButton } from "@multica/ui/components/common/submit-button";
import { FileUploadButton } from "@multica/ui/components/common/file-upload-button";
import { useFileUpload } from "@multica/core/hooks/use-file-upload";
import { api } from "@multica/core/api";
import { useChatStore, DRAFT_NEW_SESSION } from "@multica/core/chat";
import { createLogger } from "@multica/core/logger";

const logger = createLogger("chat.ui");

export interface ChatSuggestion {
  label: string;
  prompt: string;
}

export interface ChatInputProps {
  onSend: (content: string) => void;
  onStop?: () => void;
  isRunning?: boolean;
  disabled?: boolean;
  /** Custom placeholder text. Overrides the default agent-derived placeholder. */
  placeholder?: string;
  /** Name of the currently selected agent, used in the placeholder. */
  agentName?: string;
  /** Rendered at the bottom-left of the input bar — typically the agent picker. */
  leftAdornment?: ReactNode;
  /** Context-aware follow-up suggestions shown above the input. */
  suggestions?: ChatSuggestion[];
}

export function ChatInput({
  onSend,
  onStop,
  isRunning,
  disabled,
  placeholder,
  agentName,
  leftAdornment,
  suggestions,
}: ChatInputProps) {
  const editorRef = useRef<ContentEditorRef>(null);
  const activeSessionId = useChatStore((s) => s.activeSessionId);
  const selectedAgentId = useChatStore((s) => s.selectedAgentId);
  // Scope the new-chat draft by agent:
  //   1. Switching agents while composing a brand-new chat gives each
  //      agent its own draft (no cross-agent leakage).
  //   2. Tiptap's Placeholder extension is only applied at mount; this
  //      key changes on agent switch so the editor remounts and the
  //      `Tell {agent} what to do…` placeholder refreshes.
  const draftKey =
    activeSessionId ?? `${DRAFT_NEW_SESSION}:${selectedAgentId ?? ""}`;
  // Select a primitive — empty-string fallback keeps referential stability.
  const inputDraft = useChatStore((s) => s.inputDrafts[draftKey] ?? "");
  const setInputDraft = useChatStore((s) => s.setInputDraft);
  const clearInputDraft = useChatStore((s) => s.clearInputDraft);
  const [isEmpty, setIsEmpty] = useState(!inputDraft.trim());
  const { uploadWithToast } = useFileUpload(api);

  const handleUpload = useCallback(async (file: File) => {
    const result = await uploadWithToast(file);
    return result;
  }, [uploadWithToast]);

  const handleSend = () => {
    const content = editorRef.current?.getMarkdown()?.replace(/(\n\s*)+$/, "").trim();
    if (!content || isRunning || disabled) {
      logger.debug("input.send skipped", {
        emptyContent: !content,
        isRunning,
        disabled,
      });
      return;
    }
    // Capture draft key BEFORE onSend — creating a new session mutates
    // activeSessionId synchronously, so reading it after onSend would point
    // at the new session and leave the old draft orphaned.
    const keyAtSend = draftKey;
    logger.info("input.send", { contentLength: content.length, draftKey: keyAtSend });
    onSend(content);
    editorRef.current?.clearContent();
    clearInputDraft(keyAtSend);
    setIsEmpty(true);
  };

  const resolvedPlaceholder = placeholder ?? (disabled
    ? "This session is archived"
    : agentName
      ? `Tell ${agentName} what to do…`
      : "Tell me what to do…");

  const handleSuggestion = (prompt: string) => {
    onSend(prompt);
  };

  return (
    <div className="px-5 pb-3 pt-0">
      {suggestions && suggestions.length > 0 && (
        <div className="mx-auto flex w-full max-w-4xl flex-wrap gap-1.5 pb-2">
          {suggestions.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => handleSuggestion(s.prompt)}
              className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-card px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground hover:border-border active:scale-[0.96]"
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
      <div className="relative mx-auto flex min-h-16 max-h-40 w-full max-w-4xl flex-col rounded-lg bg-card pb-9 border-1 border-border transition-colors focus-within:border-brand">
        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2">
          <ContentEditor
            // Remount the editor when the active session changes so its
            // uncontrolled defaultValue picks up the new session's draft.
            key={draftKey}
            ref={editorRef}
            defaultValue={inputDraft}
            placeholder={resolvedPlaceholder}
            onUpdate={(md) => {
              setIsEmpty(!md.trim());
              setInputDraft(draftKey, md);
            }}
            onSubmit={handleSend}
            onUploadFile={handleUpload}
            debounceMs={100}
            // Chat is short-form — the floating formatting toolbar is
            // more distraction than feature here.
            showBubbleMenu={false}
            // Enter sends; Shift-Enter inserts a hard break.
            submitOnEnter
          />
        </div>
        {leftAdornment && (
          <div className="absolute bottom-1.5 left-2 flex items-center">
            {leftAdornment}
          </div>
        )}
        <div className="absolute bottom-1 right-1.5 flex items-center gap-1">
          <FileUploadButton
            disabled={!!disabled}
            onSelect={(file) => editorRef.current?.uploadFile(file)}
          />
          <SubmitButton
            onClick={handleSend}
            disabled={isEmpty || !!disabled}
            running={isRunning}
            onStop={onStop}
          />
        </div>
      </div>
    </div>
  );
}
