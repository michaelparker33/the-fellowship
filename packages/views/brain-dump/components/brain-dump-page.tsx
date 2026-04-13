"use client";

import { useState, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Lightbulb, Trash2, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@multica/ui/components/ui/button";
import { Badge } from "@multica/ui/components/ui/badge";
import { Textarea } from "@multica/ui/components/ui/textarea";
import { Card, CardContent } from "@multica/ui/components/ui/card";
import { useWorkspaceId } from "@multica/core/hooks";
import { brainDumpListOptions, brainDumpUnprocessedCountOptions } from "@multica/core/brain-dump/queries";
import { useCreateBrainDump, useDeleteBrainDump, useProcessBrainDump } from "@multica/core/brain-dump/mutations";
import { useCreateIssue } from "@multica/core/issues/mutations";
import type { BrainDump } from "@multica/core/types";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function BrainDumpCard({ dump }: { dump: BrainDump }) {
  const deleteDump = useDeleteBrainDump();
  const processDump = useProcessBrainDump();
  const createIssue = useCreateIssue();
  const [converting, setConverting] = useState(false);

  const handleConvert = useCallback(async () => {
    setConverting(true);
    try {
      const issue = await createIssue.mutateAsync({ title: dump.content });
      await processDump.mutateAsync({ id: dump.id, issueId: issue.id });
      toast.success("Converted to issue");
    } catch {
      toast.error("Failed to convert");
    } finally {
      setConverting(false);
    }
  }, [dump, createIssue, processDump]);

  return (
    <Card className="group">
      <CardContent className="flex gap-3 p-4">
        <div className="min-w-0 flex-1">
          <p className="whitespace-pre-wrap break-words text-sm">{dump.content}</p>
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <span>{timeAgo(dump.created_at)}</span>
            {dump.processed && (
              <Badge variant="secondary" className="text-[10px]">
                Processed
              </Badge>
            )}
            {dump.converted_issue_id && (
              <span className="text-primary">Linked to issue</span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-start gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {!dump.processed && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleConvert}
              disabled={converting}
              className="h-7 gap-1 text-xs"
            >
              {converting ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <ArrowRight className="size-3" />
              )}
              Convert to Issue
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground hover:text-destructive"
            onClick={() => deleteDump.mutate(dump.id)}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function BrainDumpPage() {
  const wsId = useWorkspaceId();
  const [content, setContent] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const createDump = useCreateBrainDump();

  const { data } = useQuery(brainDumpListOptions(wsId));
  const { data: countData } = useQuery(brainDumpUnprocessedCountOptions(wsId));

  const dumps = data?.brain_dumps ?? [];
  const unprocessedCount = countData?.count ?? 0;

  const handleSubmit = useCallback(() => {
    const trimmed = content.trim();
    if (!trimmed) return;
    createDump.mutate(trimmed);
    setContent("");
    textareaRef.current?.focus();
  }, [content, createDump]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 border-b px-6 py-4">
        <Lightbulb className="size-5 text-primary" />
        <h1 className="text-lg font-semibold">Brain Dump</h1>
        {unprocessedCount > 0 && (
          <Badge variant="secondary" className="text-xs">
            {unprocessedCount} unprocessed
          </Badge>
        )}
      </div>

      {/* Input area */}
      <div className="border-b px-6 py-4">
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="What's on your mind? Just dump it here..."
            className="min-h-[80px] resize-none"
            autoFocus
          />
          <Button
            onClick={handleSubmit}
            disabled={!content.trim() || createDump.isPending}
            className="shrink-0 self-end"
          >
            {createDump.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              "Capture"
            )}
          </Button>
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Press Enter to capture, Shift+Enter for newline
        </p>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {dumps.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Lightbulb className="mb-3 size-10 opacity-30" />
            <p className="text-sm">No brain dumps yet. Start typing above!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {dumps.map((dump) => (
              <BrainDumpCard key={dump.id} dump={dump} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
