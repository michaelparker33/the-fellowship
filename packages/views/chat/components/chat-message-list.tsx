"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@multica/ui/lib/utils";
import {
  ChevronRight,
  ChevronDown,
  Brain,
  AlertCircle,
  Play,
  CircleCheck,
  CircleX,
  RotateCcw,
  ExternalLink,
  ListTodo,
  Bot,
  Activity,
  SquareCheckBig,
  Layers,
  Zap,
  GitMerge,
  Shield,
  Copy,
  Check,
  FileDown,
  type LucideIcon,
} from "lucide-react";
import { useScrollFade } from "@multica/ui/hooks/use-scroll-fade";
import { useAutoScroll } from "@multica/ui/hooks/use-auto-scroll";
import { taskMessagesOptions } from "@multica/core/chat/queries";
import { useModalStore } from "@multica/core/modals";
import { Markdown } from "@multica/views/common/markdown";
import type { ChatMessage, Agent, TaskMessagePayload } from "@multica/core/types";
import type { ChatTimelineItem } from "@multica/core/chat";

// ─── Public component ────────────────────────────────────────────────────

interface ChatMessageListProps {
  messages: ChatMessage[];
  pendingTaskId: string | null;
  isWaiting: boolean;
  agent?: Agent | null;
  onFollowUp?: (content: string) => void;
}

export function ChatMessageList({
  messages,
  pendingTaskId,
  isWaiting,
  agent,
  onFollowUp,
}: ChatMessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const fadeStyle = useScrollFade(scrollRef);
  useAutoScroll(scrollRef);

  const pendingAlreadyPersisted = !!pendingTaskId && messages.some(
    (m) => m.role === "assistant" && m.task_id === pendingTaskId,
  );

  const showLiveTimeline = !!pendingTaskId && !pendingAlreadyPersisted;
  const { data: liveTaskMessages } = useQuery({
    ...taskMessagesOptions(pendingTaskId ?? ""),
    enabled: showLiveTimeline,
  });
  const liveTimeline: ChatTimelineItem[] = (liveTaskMessages ?? []).map(toTimelineItem);
  const hasLive = showLiveTimeline && liveTimeline.length > 0;
  return (
    <div ref={scrollRef} style={fadeStyle} className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-4xl px-5 py-6 space-y-5">
        {messages.map((msg, idx) => {
          const isLastAssistant =
            msg.role === "assistant" && idx === messages.length - 1;
          const isEmptyStreamingMessage =
            isLastAssistant && isWaiting && !msg.content;
          if (isEmptyStreamingMessage) return null;

          if (msg.role === "user") {
            return (
              <UserMessage key={msg.id} message={msg} />
            );
          }

          return (
            <AssistantSection
              key={msg.id}
              message={msg}
              agent={agent}
              showActions={isLastAssistant && !isWaiting}
              onFollowUp={onFollowUp}
            />
          );
        })}

        {/* Live agent activity — active streaming section */}
        {isWaiting && (
          <LiveStreamingSection
            agent={agent}
            hasLive={hasLive}
            liveTimeline={liveTimeline}
          />
        )}
      </div>
    </div>
  );
}

export function ChatMessageSkeleton() {
  return (
    <div className="flex-1 overflow-hidden">
      <div className="mx-auto w-full max-w-4xl px-5 py-6 space-y-5">
        <div className="rounded-xl border border-border/40 bg-card/50 p-4 space-y-2">
          <div className="h-3.5 w-3/4 rounded bg-muted animate-pulse" />
          <div className="h-3.5 w-1/2 rounded bg-muted animate-pulse" />
        </div>
        <div className="flex justify-end">
          <div className="h-8 w-48 rounded-2xl bg-muted animate-pulse" />
        </div>
        <div className="rounded-xl border border-border/40 bg-card/50 p-4 space-y-2">
          <div className="h-3.5 w-2/3 rounded bg-muted animate-pulse" />
          <div className="h-3.5 w-5/6 rounded bg-muted animate-pulse" />
          <div className="h-3.5 w-1/3 rounded bg-muted animate-pulse" />
        </div>
      </div>
    </div>
  );
}

function toTimelineItem(m: TaskMessagePayload): ChatTimelineItem {
  return {
    seq: m.seq,
    type: m.type,
    tool: m.tool,
    content: m.content,
    input: m.input,
    output: m.output,
  };
}

// ─── Copy helper ────────────────────────────────────────────────────────

function useCopyAction() {
  const [copied, setCopied] = useState(false);
  const copy = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {
      // Fallback for non-secure contexts
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, []);
  return { copied, copy };
}

// ─── Hover action bar ───────────────────────────────────────────────────

function MessageActions({
  content,
  timestamp,
  role,
  agentName,
}: {
  content: string;
  timestamp?: string;
  role: "user" | "assistant";
  agentName?: string;
}) {
  const { copied, copy } = useCopyAction();
  const [exported, setExported] = useState(false);

  const handleExportMd = useCallback(() => {
    const prefix = role === "user" ? "**You:**" : `**${agentName ?? "Agent"}:**`;
    const time = timestamp ? new Date(timestamp).toLocaleString() : "";
    const md = `${prefix}${time ? ` _(${time})_` : ""}\n\n${content}`;
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `message-${timestamp ? new Date(timestamp).toISOString().slice(0, 19).replace(/:/g, "-") : "export"}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setExported(true);
    setTimeout(() => setExported(false), 1500);
  }, [content, timestamp, role, agentName]);

  const isRight = role === "user";

  return (
    <div className={cn(
      "absolute -top-3 flex items-center gap-0.5 rounded-lg border border-border/60 bg-card/95 shadow-sm px-0.5 py-0.5 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-10 backdrop-blur-sm",
      isRight ? "right-1" : "left-1",
    )}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); copy(content); }}
        className="flex items-center justify-center size-6 rounded-md hover:bg-muted transition-colors cursor-pointer"
        title={copied ? "Copied!" : "Copy text"}
      >
        {copied ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3 text-muted-foreground" />}
      </button>

      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); handleExportMd(); }}
        className="flex items-center justify-center size-6 rounded-md hover:bg-muted transition-colors cursor-pointer"
        title={exported ? "Downloaded!" : "Download as Markdown"}
      >
        {exported ? <Check className="size-3 text-emerald-400" /> : <FileDown className="size-3 text-muted-foreground" />}
      </button>

      {timestamp && (
        <span className="text-[9px] text-muted-foreground/60 px-1 tabular-nums select-none">
          {new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      )}
    </div>
  );
}

// ─── Typing cursor ──────────────────────────────────────────────────────

function TypingCursor() {
  return (
    <div className="flex items-center gap-1.5 py-1">
      <span className="text-xs text-muted-foreground italic">composing</span>
      <span className="flex gap-0.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-1 rounded-full bg-muted-foreground/50 animate-bounce"
            style={{ animationDelay: `${i * 150}ms`, animationDuration: "800ms" }}
          />
        ))}
      </span>
    </div>
  );
}

// ─── Live streaming section ─────────────────────────────────────────────

/**
 * Interleaved timeline row — preserves the exact order the agent produces steps.
 * Each row is either a tool action (tool_use + optional tool_result), a thinking
 * block, or an error. Text items are collected separately for the response area.
 */
interface TimelineRow {
  kind: "action" | "thinking" | "error";
  seq: number;
  /** For actions */
  tool?: string;
  description: string;
  detail?: string;
  status: "done" | "running";
  isError: boolean;
  /** For collapsible content */
  expandContent?: string;
}

/** Build a human-readable sentence describing what the tool is doing */
function describeToolAction(item: ChatTimelineItem): string {
  const tool = item.tool ?? "";
  const inp = (item.input ?? {}) as Record<string, string>;

  // File operations
  if (tool === "Read" || tool.includes("read_file")) {
    return inp.file_path ? `Read ${shortenPath(inp.file_path)}` : "Read file";
  }
  if (tool === "Write" || tool.includes("write_file") || tool.includes("create_file")) {
    return inp.file_path ? `Write to ${shortenPath(inp.file_path)}` : "Write file";
  }
  if (tool === "Edit" || tool.includes("edit_file")) {
    return inp.file_path ? `Edit ${shortenPath(inp.file_path)}` : "Edit file";
  }

  // Search / explore
  if (tool === "Grep" || tool.includes("grep") || tool.includes("search_code")) {
    const q = inp.pattern ?? inp.query ?? "";
    return q ? `Search codebase for "${q.length > 40 ? q.slice(0, 40) + "…" : q}"` : "Search codebase";
  }
  if (tool === "Glob" || tool.includes("glob") || tool.includes("find_files")) {
    return inp.pattern ? `Find files matching ${inp.pattern}` : "Find files";
  }
  if (tool.includes("ListDirectory") || tool.includes("list_dir")) {
    return inp.path ? `List ${shortenPath(inp.path)}` : "List directory";
  }

  // Shell
  if (tool === "Bash" || tool.includes("bash") || tool.includes("shell") || tool.includes("exec")) {
    const cmd = inp.command ?? inp.cmd ?? "";
    if (cmd) {
      const short = cmd.length > 60 ? cmd.slice(0, 57) + "…" : cmd;
      return `Run \`${short}\``;
    }
    return inp.description ? String(inp.description) : "Run command";
  }

  // Agent delegation
  if (tool === "Agent" || tool.includes("agent") || tool.includes("delegate")) {
    return inp.description ?? inp.prompt?.slice(0, 60) ?? "Delegate to sub-agent";
  }

  // Web
  if (tool.includes("WebSearch") || tool.includes("web_search")) {
    return inp.query ? `Search the web for "${inp.query}"` : "Search the web";
  }
  if (tool.includes("WebFetch") || tool.includes("web_fetch")) {
    return inp.url ? `Fetch ${inp.url.slice(0, 50)}` : "Fetch web page";
  }

  // Issue / task management
  if (tool.includes("create_issue") || tool.includes("create_task")) {
    return inp.title ? `Create issue "${inp.title}"` : "Create issue";
  }
  if (tool.includes("update_issue") || tool.includes("update_task")) {
    return inp.title ? `Update issue "${inp.title}"` : "Update issue";
  }
  if (tool.includes("add_comment")) {
    return "Add comment to issue";
  }
  if (tool.includes("list_issues") || tool.includes("search")) {
    return inp.query ? `Search for "${inp.query}"` : "List issues";
  }

  // Fallback — use the summary helper
  const summary = getToolSummary(item);
  if (summary) return `${tool} — ${summary.length > 50 ? summary.slice(0, 47) + "…" : summary}`;
  return tool;
}

function buildTimelineRows(items: ChatTimelineItem[]): TimelineRow[] {
  const rows: TimelineRow[] = [];
  const usedResults = new Set<number>();

  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;

    if (item.type === "tool_use") {
      // Find matching result
      const resultIdx = items.findIndex(
        (t, j) => j > i && t.type === "tool_result" && !usedResults.has(j),
      );
      const result = resultIdx >= 0 ? items[resultIdx] : undefined;
      if (result && resultIdx >= 0) usedResults.add(resultIdx);

      const isError = result
        ? (result.output ?? result.content ?? "").toLowerCase().includes("error") ||
          (result.output ?? result.content ?? "").toLowerCase().includes("failed")
        : false;

      rows.push({
        kind: "action",
        seq: item.seq,
        tool: item.tool,
        description: describeToolAction(item),
        detail: result ? (result.output ?? result.content ?? "").slice(0, 200) : undefined,
        status: result ? "done" : "running",
        isError,
        expandContent: item.input ? JSON.stringify(item.input, null, 2) : undefined,
      });
    } else if (item.type === "thinking") {
      const text = item.content ?? "";
      if (text.trim()) {
        rows.push({
          kind: "thinking",
          seq: item.seq,
          description: "Thinking",
          status: "done",
          isError: false,
          expandContent: text,
        });
      }
    } else if (item.type === "error") {
      rows.push({
        kind: "error",
        seq: item.seq,
        description: item.content ?? "Error occurred",
        status: "done",
        isError: true,
      });
    }
    // "text" and "tool_result" handled elsewhere
  }
  return rows;
}

function LiveStreamingSection({
  agent,
  hasLive,
  liveTimeline,
}: {
  agent?: Agent | null;
  hasLive: boolean;
  liveTimeline: ChatTimelineItem[];
}) {
  const liveCreatedTasks = useMemo(() => extractCreatedTasks(liveTimeline), [liveTimeline]);
  const rows = useMemo(() => buildTimelineRows(liveTimeline), [liveTimeline]);
  const liveText = useMemo(
    () => liveTimeline.filter((t) => t.type === "text").map((t) => t.content ?? "").join(""),
    [liveTimeline],
  );
  const [collapsed, setCollapsed] = useState(false);
  const stepsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest row
  useEffect(() => {
    if (!collapsed) {
      stepsEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [rows.length, collapsed]);

  const runningCount = rows.filter((r) => r.status === "running").length;
  const doneCount = rows.filter((r) => r.kind === "action" && r.status === "done").length;

  return (
    <div className="animate-[chat-slide-up_300ms_cubic-bezier(0.32,0.72,0,1)]">
      <div className="rounded-xl border border-brand/20 bg-card/50 overflow-hidden shadow-[0_0_15px_-3px] shadow-brand/5">
        {/* ── Header — collapsible ── */}
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="flex w-full items-center gap-2 px-4 py-2.5 border-b border-border/30 bg-gradient-to-r from-brand/5 to-transparent cursor-pointer hover:from-brand/8 transition-colors"
        >
          <div className="relative flex items-center justify-center size-5 rounded-full bg-brand/15 shrink-0">
            <Bot className="size-3 text-brand" />
            <span className="absolute -top-px -right-px size-2 rounded-full bg-emerald-400 border border-card animate-pulse" />
          </div>
          <span className="text-xs font-semibold text-foreground">
            {agent?.name ?? "Agent"}
          </span>

          {doneCount > 0 && (
            <span className="text-[10px] text-muted-foreground font-mono">
              {doneCount} {doneCount === 1 ? "step" : "steps"} done
            </span>
          )}

          <span className="ml-auto flex items-center gap-1.5">
            {runningCount > 0 && (
              <span className="flex items-center gap-1 text-[10px] text-brand font-medium">
                <span className="size-1.5 rounded-full bg-brand animate-pulse" />
                working
              </span>
            )}
            <ChevronDown className={cn(
              "size-3 text-muted-foreground transition-transform",
              collapsed && "-rotate-90",
            )} />
          </span>
        </button>

        {/* ── Expanded step-by-step feed ── */}
        {!collapsed && (
          <>
            {rows.length > 0 && (
              <div className="max-h-[320px] overflow-y-auto">
                <div className="px-2 py-1.5 space-y-0">
                  {rows.map((row) => (
                    <LiveStepRow key={row.seq} row={row} />
                  ))}
                  <div ref={stepsEndRef} />
                </div>
              </div>
            )}

            {/* Live text output (agent composing its response) */}
            {liveText.trim() ? (
              <div className="px-4 py-3 border-t border-border/20">
                <div className="text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none">
                  <Markdown>{liveText}</Markdown>
                  <span className="inline-block size-1.5 rounded-full bg-brand animate-pulse ml-1 align-middle" />
                </div>
              </div>
            ) : !hasLive || rows.length === 0 ? (
              <div className="px-4 py-3">
                <TypingCursor />
              </div>
            ) : null}

            {liveCreatedTasks.length > 0 && (
              <CreatedTasksList tasks={liveCreatedTasks} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** Individual row in the live step feed */
function LiveStepRow({ row }: { row: TimelineRow }) {
  const [expanded, setExpanded] = useState(false);

  if (row.kind === "thinking") {
    return (
      <div className="animate-[chat-slide-up_150ms_ease-out]">
        <button
          type="button"
          onClick={() => row.expandContent && setExpanded((v) => !v)}
          className={cn(
            "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors",
            row.expandContent ? "hover:bg-muted/40 cursor-pointer" : "cursor-default",
          )}
        >
          <Brain className="size-3.5 text-muted-foreground/50 shrink-0" />
          <span className="text-muted-foreground/60 italic">Thinking</span>
          {row.expandContent && (
            <ChevronRight className={cn("size-3 text-muted-foreground/40 transition-transform", expanded && "rotate-90")} />
          )}
        </button>
        {expanded && row.expandContent && (
          <div className="ml-7 mr-2 mb-1 rounded-md bg-muted/20 px-3 py-2 max-h-32 overflow-y-auto">
            <p className="text-[11px] text-muted-foreground/60 whitespace-pre-wrap leading-relaxed">
              {row.expandContent.length > 2000 ? row.expandContent.slice(0, 2000) + "\n…(truncated)" : row.expandContent}
            </p>
          </div>
        )}
      </div>
    );
  }

  if (row.kind === "error") {
    return (
      <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs animate-[chat-slide-up_150ms_ease-out]">
        <AlertCircle className="size-3.5 text-destructive shrink-0" />
        <span className="text-destructive">{row.description}</span>
      </div>
    );
  }

  // Action row
  return (
    <div className="animate-[chat-slide-up_150ms_ease-out]">
      <button
        type="button"
        onClick={() => row.expandContent && setExpanded((v) => !v)}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors group/row",
          row.expandContent ? "hover:bg-muted/40 cursor-pointer" : "cursor-default",
        )}
      >
        {/* Status indicator */}
        {row.status === "running" ? (
          <span className="relative flex items-center justify-center size-3.5 shrink-0">
            <span className="absolute inset-0 rounded-full border-2 border-brand/30 border-t-brand animate-spin" />
          </span>
        ) : row.isError ? (
          <CircleX className="size-3.5 text-destructive/60 shrink-0" />
        ) : (
          <CircleCheck className="size-3.5 text-emerald-500/60 shrink-0" />
        )}

        {/* Description */}
        <span className={cn(
          "text-left truncate",
          row.status === "running"
            ? "text-foreground font-medium"
            : "text-muted-foreground",
        )}>
          {row.description}
        </span>

        {/* Expand chevron */}
        {row.expandContent && (
          <ChevronRight className={cn(
            "size-3 text-muted-foreground/30 shrink-0 ml-auto transition-transform opacity-0 group-hover/row:opacity-100",
            expanded && "rotate-90 opacity-100",
          )} />
        )}
      </button>

      {expanded && row.expandContent && (
        <div className="ml-7 mr-2 mb-1 rounded-md bg-muted/20 overflow-hidden">
          <pre className="px-3 py-2 text-[11px] text-muted-foreground/50 whitespace-pre-wrap break-all max-h-32 overflow-y-auto font-mono">
            {row.expandContent.length > 3000 ? row.expandContent.slice(0, 3000) + "\n…(truncated)" : row.expandContent}
          </pre>
        </div>
      )}
    </div>
  );
}

// ─── User message ───────────────────────────────────────────────────────

function parseUserContent(content: string) {
  const imgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  const parts: { type: "text" | "image"; value: string; alt?: string }[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = imgRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", value: content.slice(lastIndex, match.index) });
    }
    parts.push({ type: "image", value: match[2] ?? "", alt: match[1] ?? "" });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) {
    parts.push({ type: "text", value: content.slice(lastIndex) });
  }
  return parts;
}

function UserMessage({ message }: { message: ChatMessage }) {
  const parts = parseUserContent(message.content);
  const hasImages = parts.some((p) => p.type === "image");

  return (
    <div className="group relative flex justify-end animate-[chat-slide-up_300ms_cubic-bezier(0.32,0.72,0,1)]">
      <MessageActions content={message.content} timestamp={message.created_at} role="user" />
      <div className="rounded-2xl bg-muted px-3.5 py-2 text-sm max-w-[75%] break-words">
        {hasImages ? (
          <div className="space-y-2">
            {parts.map((part, i) =>
              part.type === "image" ? (
                <img
                  key={i}
                  src={part.value}
                  alt={part.alt ?? ""}
                  className="max-w-full rounded-lg max-h-64 object-contain"
                />
              ) : part.value.trim() ? (
                <div key={i} className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                  <Markdown>{part.value}</Markdown>
                </div>
              ) : null,
            )}
          </div>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
            <Markdown>{message.content}</Markdown>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Assistant section (card with activity tree + actions) ──────────────

function AssistantSection({
  message,
  agent,
  showActions,
  onFollowUp,
}: {
  message: ChatMessage;
  agent?: Agent | null;
  showActions?: boolean;
  onFollowUp?: (content: string) => void;
}) {
  const taskId = message.task_id;
  const { data: taskMessages } = useQuery({
    ...taskMessagesOptions(taskId ?? ""),
    enabled: !!taskId,
  });
  const timeline: ChatTimelineItem[] = (taskMessages ?? []).map(toTimelineItem);
  const rows = useMemo(() => buildTimelineRows(timeline), [timeline]);
  const actionRows = rows.filter((r) => r.kind === "action");
  const hasActivity = actionRows.length > 0;
  const createdTasks = useMemo(() => extractCreatedTasks(timeline), [timeline]);
  const [activityExpanded, setActivityExpanded] = useState(false);

  return (
    <div className="group relative animate-[chat-slide-up_300ms_cubic-bezier(0.32,0.72,0,1)]">
      <MessageActions content={message.content} timestamp={message.created_at} role="assistant" agentName={agent?.name} />
      <div className="rounded-xl border border-border/40 bg-card/50 overflow-hidden">
        {/* Header — agent identity + collapsible activity toggle */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/30 bg-muted/20">
          <div className="flex items-center justify-center size-5 rounded-full bg-brand/10">
            <Bot className="size-3 text-brand" />
          </div>
          <span className="text-xs font-medium text-foreground">
            {agent?.name ?? "Agent"}
          </span>

          {/* Activity toggle — replaces the popover */}
          {hasActivity && (
            <button
              type="button"
              onClick={() => setActivityExpanded((v) => !v)}
              className="ml-auto flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-mono text-muted-foreground bg-muted/60 hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
            >
              <Activity className="size-3" />
              <span>{actionRows.length} {actionRows.length === 1 ? "action" : "actions"}</span>
              <ChevronDown className={cn("size-2.5 transition-transform", activityExpanded && "rotate-180")} />
            </button>
          )}

          {/* Created tasks badge */}
          {createdTasks.length > 0 && !hasActivity && (
            <span className="ml-auto flex items-center gap-1 text-[10px] font-mono text-brand bg-brand/10 px-1.5 py-0.5 rounded">
              <SquareCheckBig className="size-2.5" />
              {createdTasks.length} {createdTasks.length === 1 ? "task" : "tasks"}
            </span>
          )}
        </div>

        {/* Expanded step-by-step activity (same style as live section) */}
        {activityExpanded && hasActivity && (
          <div className="max-h-[280px] overflow-y-auto border-b border-border/20">
            <div className="px-2 py-1.5 space-y-0">
              {rows.map((row) => (
                <LiveStepRow key={row.seq} row={row} />
              ))}
            </div>
          </div>
        )}

        {/* Response content */}
        {message.content && (
          <div className="px-4 py-3 text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none">
            <ResponseContent timeline={timeline} fallback={message.content} />
          </div>
        )}

        {/* Created tasks list */}
        {createdTasks.length > 0 && (
          <CreatedTasksList tasks={createdTasks} />
        )}

        {/* Smart actions */}
        {showActions && message.content && (
          <div className="px-4 pb-3 pt-0">
            <SmartActions content={message.content} onFollowUp={onFollowUp} />
          </div>
        )}
      </div>
    </div>
  );
}

/** Extract text segments from timeline, or fall back to message.content */
function ResponseContent({ timeline, fallback }: { timeline: ChatTimelineItem[]; fallback: string }) {
  const textSegments = timeline.filter((t) => t.type === "text");
  if (textSegments.length > 0) {
    const text = textSegments.map((t) => t.content ?? "").join("");
    if (text.trim()) {
      return <Markdown>{text}</Markdown>;
    }
  }
  return <Markdown>{fallback}</Markdown>;
}

// ─── Created tasks extraction ──────────────────────────────────────────

interface CreatedTask {
  title: string;
  issueKey?: string;
  issueId?: string;
}

/** Extract tasks/issues the agent created during its tool calls */
function extractCreatedTasks(timeline: ChatTimelineItem[]): CreatedTask[] {
  const tasks: CreatedTask[] = [];
  const seen = new Set<string>();

  for (const item of timeline) {
    if (item.type !== "tool_use" && item.type !== "tool_result") continue;

    const toolName = (item.tool ?? "").toLowerCase();
    const isCreate = toolName.includes("create_issue") ||
      toolName.includes("create_task") ||
      toolName.includes("create_sub") ||
      toolName.includes("add_issue") ||
      toolName.includes("new_issue");

    if (!isCreate) continue;

    // Extract from tool_use input
    if (item.type === "tool_use" && item.input) {
      const inp = item.input as Record<string, unknown>;
      const title = (inp.title ?? inp.name ?? inp.summary ?? "") as string;
      if (title && !seen.has(title)) {
        seen.add(title);
        tasks.push({
          title,
          issueKey: (inp.key ?? inp.identifier) as string | undefined,
        });
      }
    }

    // Extract from tool_result output (may contain the created issue ID/key)
    if (item.type === "tool_result" && item.output) {
      try {
        const parsed = JSON.parse(item.output) as Record<string, unknown>;
        const title = (parsed.title ?? parsed.name ?? "") as string;
        const key = (parsed.key ?? parsed.identifier ?? parsed.issue_key) as string | undefined;
        const id = (parsed.id ?? parsed.issue_id) as string | undefined;
        if (title && !seen.has(title)) {
          seen.add(title);
          tasks.push({ title, issueKey: key, issueId: id });
        } else if (key || id) {
          // Update existing task with key/id from result
          const existing = tasks.find((t) => !t.issueKey && !t.issueId);
          if (existing) {
            existing.issueKey = key;
            existing.issueId = id;
          }
        }
      } catch {
        // output isn't JSON — try regex for issue key pattern
        const keyMatch = item.output.match(/\b([A-Z]{2,6}-\d+)\b/);
        if (keyMatch?.[1]) {
          const existing = tasks.find((t) => !t.issueKey);
          if (existing) existing.issueKey = keyMatch[1];
        }
      }
    }
  }

  return tasks;
}

/** Display created tasks as compact linked items */
function CreatedTasksList({ tasks }: { tasks: CreatedTask[] }) {
  const openModal = useModalStore.getState().open;

  return (
    <div className="px-4 py-2 border-t border-border/30 bg-muted/10">
      <div className="flex items-center gap-1.5 mb-1.5">
        <SquareCheckBig className="size-3 text-brand" />
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          Created tasks
        </span>
      </div>
      <div className="space-y-1">
        {tasks.map((task, i) => (
          <button
            key={task.issueId ?? task.title ?? i}
            type="button"
            onClick={() => {
              if (task.issueId) {
                openModal("issue-detail", { issueId: task.issueId });
              }
            }}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
              task.issueId
                ? "hover:bg-accent/50 cursor-pointer"
                : "cursor-default",
            )}
          >
            <CircleCheck className="size-3 text-brand shrink-0" />
            <span className="truncate text-foreground">{task.title}</span>
            {task.issueKey && (
              <span className="ml-auto shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                {task.issueKey}
              </span>
            )}
            {task.issueId && (
              <ExternalLink className="size-2.5 text-muted-foreground/50 shrink-0" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Smart contextual actions ───────────────────────────────────────────

interface SmartAction {
  label: string;
  icon: LucideIcon;
  variant?: "primary" | "default" | "workflow";
  /** Number of chained steps — shown as a badge on workflow actions */
  steps?: number;
  action:
    | { type: "follow-up"; prompt: string }
    | { type: "modal"; modal: "create-issue" | "issue-detail"; data?: Record<string, unknown> };
}

// ─── Content analysis helpers ─────────────────────────────────────────

/** Pull the specific thing the agent offered/proposed to do */
function extractOffer(content: string): { verb: string; subject: string } | null {
  const patterns = [
    /(?:want me to|shall i|should i|would you like me to|do you want me to)\s+(.+?)(?:\?|$)/im,
    /(?:i could|i can)\s+(.+?)(?:\s+if you(?:'d like)?|[.?]|$)/im,
    /(?:i'll go ahead and|ready to|let me)\s+(.+?)(?:[.?]|$)/im,
    /(?:let me know if (?:you'd like|you want) (?:me to\s*)?)\s*(.+?)(?:[.?]|$)/im,
  ];
  for (const p of patterns) {
    const m = content.match(p);
    if (m?.[1]) {
      let raw = m[1].replace(/[.!?,;]+$/, "").trim();
      const verbMatch = raw.match(/^(\w+)\s+(.+)/);
      if (verbMatch) {
        return { verb: capitalize(verbMatch[1]!), subject: verbMatch[2]! };
      }
      return { verb: capitalize(raw), subject: "" };
    }
  }
  return null;
}

/** Pull numbered/bulleted list items — the real text, cleaned */
function extractListItems(content: string): string[] {
  const matches = content.match(/^\s*(?:\d+[.)]\s+|\*\s+|-\s+)\*?\*?(.+?)\*?\*?\s*$/gm);
  if (!matches || matches.length < 2) return [];
  return matches.map((m) => {
    return m.replace(/^\s*(?:\d+[.)]\s+|\*\s+|-\s+)/, "").replace(/\*\*/g, "").trim();
  }).filter((s) => s.length > 3 && s.length < 120);
}

/** Find a specific error or failure name from the content */
function extractErrorContext(content: string): string | null {
  const tickErr = content.match(/`([^`]{5,60}(?:error|exception|fail|timeout|refused|denied|crash)[^`]*)`/i);
  if (tickErr?.[1]) return tickErr[1];
  const colonErr = content.match(/(?:error|failed|failure|exception):\s*(.{5,60}?)(?:\.|$)/im);
  if (colonErr?.[1]) return colonErr[1].trim();
  const codeRef = content.match(/`([^`]{3,40})`\s*(?:is|was|has|threw|caused|returned)\s/i);
  if (codeRef?.[1]) return codeRef[1];
  return null;
}

/** Extract what the agent completed */
function extractCompletionSubject(content: string): string | null {
  const patterns = [
    /(?:i(?:'ve| have)\s+(?:completed|finished|done|deployed|fixed|updated|created|merged|pushed|shipped|resolved|implemented))\s+(.+?)(?:[.!]|$)/im,
    /(?:successfully\s+(?:completed|deployed|fixed|updated|created|merged|pushed|shipped|resolved|implemented))\s+(.+?)(?:[.!]|$)/im,
    /(?:all done|that's done|finished)(?:\s*[-—:]\s*|\.\s*)(.+?)(?:[.!]|$)/im,
  ];
  for (const p of patterns) {
    const m = content.match(p);
    if (m?.[1]) {
      let s = m[1].replace(/[.!?,;]+$/, "").replace(/\*\*/g, "").trim();
      if (s.length > 60) s = s.slice(0, 57) + "...";
      return s;
    }
  }
  return null;
}

/** Extract what's being blocked and by what */
function extractBlockerContext(content: string): { what: string } | null {
  const patterns = [
    /(?:blocked|stuck)\s+(?:on|by)\s+(.+?)(?:[.!]|$)/im,
    /(?:waiting (?:on|for))\s+(.+?)(?:[.!]|$)/im,
    /(?:can't proceed|cannot proceed|unable to proceed)\s+(?:because|until|without)\s+(.+?)(?:[.!]|$)/im,
  ];
  for (const p of patterns) {
    const m = content.match(p);
    if (m?.[1]) return { what: m[1].replace(/[.!?,;]+$/, "").trim() };
  }
  return null;
}

/** Detect if the message contains a multi-step plan the agent laid out */
function extractPlanSteps(content: string): string[] {
  // Look for sequential step patterns: "Step 1:", "1.", "First,", "Then,"
  const stepPatterns = [
    /(?:step\s*\d+[:.]\s*)(.+?)(?:\n|$)/gim,
    /(?:first|then|next|after that|finally)[,:]?\s+(?:i(?:'ll| will|'d| would)\s+)?(.+?)(?:\.|$)/gim,
  ];
  const steps: string[] = [];
  for (const p of stepPatterns) {
    let m: RegExpExecArray | null;
    while ((m = p.exec(content)) !== null) {
      const step = m[1]!.replace(/\*\*/g, "").replace(/[.!?,;]+$/, "").trim();
      if (step.length > 5 && step.length < 100 && !steps.includes(step)) steps.push(step);
    }
    if (steps.length >= 2) break;
  }
  return steps;
}

/** Detect deploy/ship/release context */
function extractDeployTarget(content: string): string | null {
  const m = content.match(/(?:deploy(?:ed|ing)?|ship(?:ped|ping)?|release(?:d|ing)?|push(?:ed|ing)?)\s+(?:to\s+)?(.+?)(?:[.!?,;]|\s+(?:and|with|on))/im);
  if (m?.[1]) {
    const target = m[1].replace(/\*\*/g, "").trim();
    if (target.length > 3 && target.length < 40) return target;
  }
  // Common targets mentioned
  const targets = ["staging", "production", "prod", "dev", "main", "master"];
  const lower = content.toLowerCase();
  for (const t of targets) {
    if (lower.includes(t)) return t;
  }
  return null;
}

/** Extract file/component/module names from backticks */
function extractCodeEntities(content: string): string[] {
  const entities: string[] = [];
  const matches = content.match(/`([^`]{3,50})`/g);
  if (!matches) return [];
  for (const m of matches) {
    const clean = m.replace(/`/g, "");
    // Skip things that look like commands or errors
    if (clean.includes(" ") && !clean.includes("/") && !clean.includes(".")) continue;
    if (clean.match(/\.(ts|tsx|js|jsx|go|py|rs|css|sql|json|yaml|yml|toml|md)$/)) {
      entities.push(clean);
    } else if (clean.match(/^[A-Z][a-zA-Z]+(?:Component|Page|Hook|Store|Provider|Service|Handler|Controller|Router|Model|Schema)$/)) {
      entities.push(clean);
    } else if (clean.includes("/")) {
      entities.push(clean);
    }
  }
  return [...new Set(entities)].slice(0, 5);
}

/** Get the first sentence or meaningful chunk as a topic summary */
function extractTopic(content: string): string {
  const cleaned = content.replace(/^#+\s+/gm, "").replace(/\*\*/g, "");
  const sentences = cleaned.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 15);
  const first = sentences[0] ?? cleaned.slice(0, 80);
  let topic = first.replace(/[.!?]+$/, "").trim();
  if (topic.length > 70) topic = topic.slice(0, 67) + "...";
  return topic;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function shorten(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 3) + "..." : s;
}

/** Build a multi-step chained prompt with numbered instructions */
function chain(...steps: string[]): string {
  return steps.map((s, i) => `${i + 1}. ${s}`).join("\n");
}

// ─── Smart action derivation ──────────────────────────────────────────

function deriveSmartActions(content: string): SmartAction[] {
  const lower = content.toLowerCase();
  const actions: SmartAction[] = [];
  const seen = new Set<string>();
  const add = (a: SmartAction) => {
    if (seen.has(a.label)) return;
    seen.add(a.label);
    actions.push(a);
  };

  const topic = extractTopic(content);
  const listItems = extractListItems(content);
  const planSteps = extractPlanSteps(content);
  const codeEntities = extractCodeEntities(content);
  const hasCode = lower.includes("```");
  const errCtx = extractErrorContext(content);
  const hasError = lower.includes("failed") || lower.includes("error") || lower.includes("couldn't") || lower.includes("unable to") || lower.includes("exception") || lower.includes("crashed");
  const hasCompletion = lower.includes("completed") || lower.includes("finished") || lower.includes("all done") || lower.includes("successfully");
  const completedThing = hasCompletion ? extractCompletionSubject(content) : null;
  const prMatch = content.match(/(?:PR|pull request|merge request)\s*#?(\d+)/i);
  const issueRefs = [...new Set(content.match(/\b([A-Z]{2,6}-\d+)\b/g) ?? [])];
  const deployTarget = extractDeployTarget(content);
  const offer = extractOffer(content);

  // ═══════════════════════════════════════════════════════════════════════
  // MULTI-STEP WORKFLOWS — the smart compound actions
  // ═══════════════════════════════════════════════════════════════════════

  // ── Agent laid out a plan → "Execute full plan" ──
  if (planSteps.length >= 2) {
    const stepsSummary = planSteps.map((s) => shorten(s, 60));
    add({
      label: `Run full plan`,
      icon: Layers,
      variant: "workflow",
      steps: planSteps.length,
      action: {
        type: "follow-up",
        prompt: `Execute the plan you described, step by step. Work through each one sequentially and report progress after each step:\n${chain(...stepsSummary)}\n\nDon't stop between steps — keep going until the full plan is complete or you hit a blocker.`,
      },
    });
  }

  // ── List of items → "Fix all sequentially" with verification ──
  if (listItems.length >= 2) {
    const items = listItems.slice(0, 8);
    add({
      label: `All ${items.length} → verify`,
      icon: Layers,
      variant: "workflow",
      steps: items.length + 1,
      action: {
        type: "follow-up",
        prompt: `Work through every item you listed, sequentially:\n${chain(
          ...items.map((item) => `Fix/complete "${item}"`),
          "After all items are done, run a verification pass — confirm each one is actually resolved and nothing was missed",
        )}\n\nReport a brief status after each item so I can track progress. Don't wait for approval between items.`,
      },
    });
  }

  // ── Error + code entities → "Fix → test → verify" pipeline ──
  if (hasError && errCtx && codeEntities.length > 0) {
    const files = codeEntities.slice(0, 3).join(", ");
    add({
      label: "Fix → test → verify",
      icon: Zap,
      variant: "workflow",
      steps: 3,
      action: {
        type: "follow-up",
        prompt: chain(
          `Fix the "${errCtx}" error in ${files}. Use a different approach than what failed.`,
          `Write or update tests to cover the fix — make sure this specific failure case is tested.`,
          `Run the tests and verify the fix works. Report the results.`,
        ),
      },
    });
  }

  // ── Code shown + deploy context → "Apply → test → deploy" pipeline ──
  if (hasCode && deployTarget) {
    add({
      label: `Ship to ${shorten(deployTarget, 12)}`,
      icon: Zap,
      variant: "workflow",
      steps: 3,
      action: {
        type: "follow-up",
        prompt: chain(
          `Apply the code changes you showed.`,
          `Run the full test suite to make sure nothing is broken.`,
          `If tests pass, deploy to ${deployTarget}. If tests fail, fix the issues first then deploy.`,
        ),
      },
    });
  }

  // ── PR mentioned → "Review → approve → merge" pipeline ──
  if (prMatch) {
    add({
      label: `Review → merge #${prMatch[1]}`,
      icon: GitMerge,
      variant: "workflow",
      steps: 3,
      action: {
        type: "follow-up",
        prompt: chain(
          `Review PR #${prMatch[1]} thoroughly — check the diff, look for bugs, security issues, and style problems.`,
          `If the code looks good, approve it. If not, list the specific changes needed.`,
          `Once approved, merge the PR and confirm it merged cleanly.`,
        ),
      },
    });
  }

  // ── Completion + list of remaining → "Continue → finish all → report" ──
  if (hasCompletion && listItems.length >= 1) {
    const remaining = listItems.slice(0, 5);
    add({
      label: "Finish remaining",
      icon: Layers,
      variant: "workflow",
      steps: remaining.length + 1,
      action: {
        type: "follow-up",
        prompt: `Good progress${completedThing ? ` on "${completedThing}"` : ""}. Now continue with the remaining items:\n${chain(
          ...remaining.map((item) => `Complete "${item}"`),
          "Give me a final summary of everything that was done and anything still outstanding.",
        )}`,
      },
    });
  }

  // ── Blocker → "Investigate → workaround → resume" pipeline ──
  const isBlocked = lower.includes("blocked") || lower.includes("stuck") || lower.includes("waiting on") || lower.includes("can't proceed");
  if (isBlocked) {
    const blocker = extractBlockerContext(content);
    const blockerDesc = blocker?.what ?? topic;
    add({
      label: "Unblock → resume",
      icon: Zap,
      variant: "workflow",
      steps: 3,
      action: {
        type: "follow-up",
        prompt: chain(
          `Investigate the blocker: "${shorten(blockerDesc, 60)}". Find the root cause.`,
          `Either resolve it directly or find a workaround that lets us keep moving.`,
          `Once unblocked, resume the original task and continue where you left off.`,
        ),
      },
    });
  }

  // ── Multiple issue refs → "Update all" workflow ──
  if (issueRefs.length >= 2) {
    add({
      label: `Update all ${issueRefs.length} issues`,
      icon: Layers,
      variant: "workflow",
      steps: issueRefs.length,
      action: {
        type: "follow-up",
        prompt: `For each of these issues, check the current status and apply any relevant updates:\n${chain(
          ...issueRefs.slice(0, 6).map((ref) => `Check and update ${ref} with the latest progress`),
        )}`,
      },
    });
  }

  // ── Error + offer (agent wants to fix something) → "Fix → verify → continue" ──
  if (hasError && offer && !actions.some((a) => a.steps)) {
    const full = offer.subject ? `${offer.verb.toLowerCase()} ${offer.subject}` : offer.verb.toLowerCase();
    add({
      label: "Fix → verify → go",
      icon: Zap,
      variant: "workflow",
      steps: 3,
      action: {
        type: "follow-up",
        prompt: chain(
          `Yes, go ahead and ${full}.`,
          `After fixing, verify it actually works — run relevant tests or checks.`,
          `If the fix is confirmed, continue with the next task. Don't wait for me.`,
        ),
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // SINGLE-STEP ACTIONS — contextual but not chained
  // ═══════════════════════════════════════════════════════════════════════

  // ── Agent is offering/proposing something ──
  if (offer) {
    const full = offer.subject ? `${offer.verb} ${offer.subject}` : offer.verb;
    add({
      label: shorten(full, 32),
      icon: Play,
      variant: "primary",
      action: { type: "follow-up", prompt: `Yes, go ahead and ${full.toLowerCase()}` },
    });
    add({
      label: "Skip this",
      icon: CircleX,
      action: { type: "follow-up", prompt: `Let's skip ${offer.subject ? `"${shorten(offer.subject, 40)}"` : "this"} for now and move on to other work` },
    });
  } else if (["want me to", "shall i", "should i", "let me know"].some((p) => lower.includes(p))) {
    add({
      label: "Go ahead",
      icon: Play,
      variant: "primary",
      action: { type: "follow-up", prompt: `Yes, proceed with what you described: "${shorten(topic, 60)}"` },
    });
  }

  // ── Approval requests ──
  if ((lower.includes("approval") || lower.includes("approve") || lower.includes("needs review") || lower.includes("permission")) && !actions.some((a) => a.variant === "primary")) {
    // Multi-step: approve + continue
    add({
      label: "Approve & continue",
      icon: Shield,
      variant: "workflow",
      steps: 2,
      action: {
        type: "follow-up",
        prompt: chain(
          `Approved. Proceed with: "${shorten(topic, 60)}"`,
          `After completing this, move on to the next pending item without waiting for me.`,
        ),
      },
    });
    add({
      label: "Request changes",
      icon: CircleX,
      action: { type: "follow-up", prompt: `Not approved yet. Before proceeding with "${shorten(topic, 40)}", I need you to make these changes:` },
    });
  }

  // ── Options / choices presented ──
  if ((lower.includes("what do you think") || lower.includes("which approach") || lower.includes("how should") || lower.includes("preference") || lower.includes("option")) && actions.length < 2) {
    const optionMatches = content.match(/(?:option|approach|choice|plan)\s*(?:\d|[a-c])\s*[:.]\s*\*?\*?(.+?)\*?\*?\s*(?:\n|$)/gi);
    if (optionMatches && optionMatches.length >= 2) {
      // Multi-step: pick option + implement it
      const firstOpt = optionMatches[0]!.replace(/^(?:option|approach|choice|plan)\s*(?:\d|[a-c])\s*[:.]\s*/i, "").replace(/\*\*/g, "").trim();
      add({
        label: `${shorten(firstOpt, 20)} → implement`,
        icon: Zap,
        variant: "workflow",
        steps: 2,
        action: {
          type: "follow-up",
          prompt: chain(
            `Go with "${firstOpt}".`,
            `Implement it fully — don't just plan, actually build it and report back when it's done.`,
          ),
        },
      });
      // Individual options
      optionMatches.slice(0, 2).forEach((opt) => {
        const label = opt.replace(/^(?:option|approach|choice|plan)\s*(?:\d|[a-c])\s*[:.]\s*/i, "").replace(/\*\*/g, "").trim();
        add({
          label: shorten(label, 28),
          icon: CircleCheck,
          action: { type: "follow-up", prompt: `Go with "${label}" — implement that approach` },
        });
      });
    }
  }

  // ── Single-item list actions (when not enough for a workflow) ──
  if (listItems.length >= 2 && !actions.some((a) => a.steps)) {
    add({
      label: `Start: ${shorten(listItems[0]!, 24)}`,
      icon: Play,
      variant: "primary",
      action: { type: "follow-up", prompt: `Start with "${listItems[0]!}" from the list you identified. Work through it and report back.` },
    });
  }

  // ── Error without a workflow already covering it ──
  if (hasError && !actions.some((a) => a.steps && a.label.includes("Fix"))) {
    if (errCtx) {
      add({
        label: `Fix: ${shorten(errCtx, 22)}`,
        icon: RotateCcw,
        variant: actions.length === 0 ? "primary" : undefined,
        action: { type: "follow-up", prompt: `Fix the "${errCtx}" error. Try a different approach if the previous one didn't work.` },
      });
    }
    add({ label: "Log as bug", icon: ListTodo, action: { type: "modal", modal: "create-issue" } });
  }

  // ── Completion ──
  if (hasCompletion && !actions.some((a) => a.label.includes("remaining"))) {
    // Multi-step: next task + create follow-up
    add({
      label: "Next → create issue",
      icon: Zap,
      variant: "workflow",
      steps: 2,
      action: {
        type: "follow-up",
        prompt: chain(
          `${completedThing ? `"${completedThing}" is done. ` : ""}Identify the next highest-priority task to work on.`,
          `Create an issue for it with a clear title, description, and acceptance criteria, then start working on it.`,
        ),
      },
    });
  }

  // ── Issue references ──
  if (issueRefs.length === 1) {
    add({ label: `Open ${issueRefs[0]}`, icon: ExternalLink, action: { type: "follow-up", prompt: `Show me the current status and details of ${issueRefs[0]}` } });
  }

  // ── Status update / progress report ──
  if ((lower.includes("status update") || lower.includes("progress report") || lower.includes("here's what") || lower.includes("here is what")) && actions.length < 2) {
    add({
      label: "Continue → report",
      icon: Layers,
      variant: "workflow",
      steps: 2,
      action: {
        type: "follow-up",
        prompt: chain(
          `Continue working on the remaining items. Don't stop between them.`,
          `When everything is done (or you hit a blocker), give me a final summary with what's done, what's left, and any decisions needed.`,
        ),
      },
    });
  }

  // ── Code blocks — ship pipeline ──
  if (hasCode && actions.length < 2) {
    add({
      label: "Apply → test",
      icon: Zap,
      variant: "workflow",
      steps: 2,
      action: {
        type: "follow-up",
        prompt: chain(
          `Apply the code changes you showed.`,
          `Run the relevant tests. If anything fails, fix it and re-run until green.`,
        ),
      },
    });
  }

  // ── Fallback — always offer at least something intelligent ──
  if (actions.length === 0 && content.length >= 40) {
    add({
      label: "Deep dive → act",
      icon: Zap,
      variant: "workflow",
      steps: 2,
      action: {
        type: "follow-up",
        prompt: chain(
          `Analyze "${shorten(topic, 60)}" in depth — identify the key risks, edge cases, and the most impactful thing to do.`,
          `Then take action on your top recommendation. Don't just report back — actually do it.`,
        ),
      },
    });
    add({
      label: "Create issue",
      icon: ListTodo,
      action: { type: "modal", modal: "create-issue" },
    });
    add({
      label: "Act on this",
      icon: Play,
      action: { type: "follow-up", prompt: `Based on your analysis of "${shorten(topic, 50)}", go ahead and take action. Do what makes sense and report back.` },
    });
  }

  // Sort: workflows first, then primary, then default — up to 5
  actions.sort((a, b) => {
    const rank = (v: SmartAction) => v.variant === "workflow" ? 0 : v.variant === "primary" ? 1 : 2;
    return rank(a) - rank(b);
  });

  return actions.slice(0, 5);
}

function SmartActions({ content, onFollowUp }: { content: string; onFollowUp?: (content: string) => void }) {
  const actions = useMemo(() => deriveSmartActions(content), [content]);
  if (actions.length === 0 || !onFollowUp) return null;

  const handleAction = useCallback(
    (action: SmartAction["action"]) => {
      if (action.type === "follow-up") onFollowUp(action.prompt);
      else if (action.type === "modal") useModalStore.getState().open(action.modal, action.data ?? null);
    },
    [onFollowUp],
  );

  return (
    <div className="flex flex-wrap gap-1.5 animate-[chat-action-fade_400ms_cubic-bezier(0.32,0.72,0,1)]">
      {actions.map((action) => {
        const Icon = action.icon;
        const isWorkflow = action.variant === "workflow";
        const isPrimary = action.variant === "primary";
        return (
          <button
            key={action.label}
            type="button"
            onClick={() => handleAction(action.action)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all active:scale-[0.96]",
              isWorkflow
                ? "bg-gradient-to-r from-brand/10 to-brand/5 text-brand ring-1 ring-brand/20 hover:ring-brand/40 hover:from-brand/15 hover:to-brand/10"
                : isPrimary
                  ? "bg-brand/10 text-brand hover:bg-brand/20"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-3" />
            {action.label}
            {isWorkflow && action.steps && (
              <span className="ml-0.5 flex items-center justify-center rounded bg-brand/15 px-1 py-px text-[9px] font-bold tabular-nums leading-none text-brand/80">
                {action.steps}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────

function shortenPath(p: string): string {
  const parts = p.split("/");
  if (parts.length <= 3) return p;
  return ".../" + parts.slice(-2).join("/");
}

function getToolSummary(item: ChatTimelineItem): string {
  if (!item.input) return "";
  const inp = item.input as Record<string, string>;
  if (inp.query) return inp.query;
  if (inp.file_path) return shortenPath(inp.file_path);
  if (inp.path) return shortenPath(inp.path);
  if (inp.pattern) return inp.pattern;
  if (inp.description) return String(inp.description);
  if (inp.command) { const cmd = String(inp.command); return cmd.length > 100 ? cmd.slice(0, 100) + "..." : cmd; }
  if (inp.prompt) { const p = String(inp.prompt); return p.length > 100 ? p.slice(0, 100) + "..." : p; }
  if (inp.skill) return String(inp.skill);
  for (const v of Object.values(inp)) { if (typeof v === "string" && v.length > 0 && v.length < 120) return v; }
  return "";
}

