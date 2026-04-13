"use client";

import { useState, useRef, useCallback } from "react";
import { Plus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@multica/ui/components/ui/button";
import { Textarea } from "@multica/ui/components/ui/textarea";
import { useCreateBrainDump } from "@multica/core/brain-dump/mutations";

export function BrainDumpFab() {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const createDump = useCreateBrainDump();

  const handleSubmit = useCallback(() => {
    const trimmed = content.trim();
    if (!trimmed) return;
    createDump.mutate(trimmed, {
      onSuccess: () => {
        toast.success("Captured!");
        setContent("");
        setOpen(false);
      },
      onError: () => {
        toast.error("Failed to capture");
      },
    });
  }, [content, createDump]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    },
    [handleSubmit],
  );

  if (open) {
    return (
      <div className="fixed bottom-6 right-6 z-50 w-80 rounded-lg border bg-background p-3 shadow-lg">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium">Quick Capture</span>
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            onClick={() => setOpen(false)}
          >
            <X className="size-3.5" />
          </Button>
        </div>
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="What's on your mind?"
          className="min-h-[80px] resize-none text-sm"
          autoFocus
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">Enter to capture</span>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!content.trim() || createDump.isPending}
          >
            {createDump.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              "Capture"
            )}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setOpen(true)}
      className="fixed bottom-6 right-6 z-50 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95"
    >
      <Plus className="size-5" />
    </button>
  );
}
