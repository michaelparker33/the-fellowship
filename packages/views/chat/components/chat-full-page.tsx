"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Plus,
  MessageSquare,
  ArchiveX,
  PanelLeftClose,
  PanelLeft,
  Wand2,
  Bot,
  Sparkles,
  Download,
  Check,
} from "lucide-react";
import { useWorkspaceId } from "@multica/core/hooks";
import { useAuthStore } from "@multica/core/auth";
import { agentListOptions, memberListOptions } from "@multica/core/workspace/queries";
import { canAssignAgent } from "@multica/views/issues/components";
import { useNavigation } from "../../navigation";
import {
  chatSessionsOptions,
  allChatSessionsOptions,
  chatMessagesOptions,
  pendingChatTaskOptions,
} from "@multica/core/chat/queries";
import { useArchiveChatSession } from "@multica/core/chat/mutations";
import { useChatStore } from "@multica/core/chat";
import { ChatMessageList } from "./chat-message-list";
import { ChatInput } from "./chat-input";
import { useChatStreaming } from "../hooks/use-chat-streaming";
import { useChatSend } from "../hooks/use-chat-send";
import type { ChatSession } from "@multica/core/types";

const SUGGESTED_PROMPTS = [
  { text: "What's in Helm's Deep right now?", icon: "🏰" },
  { text: "What's blocking any active projects?", icon: "🚧" },
  { text: "Generate a Cursor prompt for [describe what you need]", icon: "⚡" },
  { text: "What's my GG33 energy today?", icon: "🔮" },
];

export function ChatFullPage() {
  const wsId = useWorkspaceId();
  const user = useAuthStore((s) => s.user);
  const activeSessionId = useChatStore((s) => s.activeSessionId);
  const pendingTaskId = useChatStore((s) => s.pendingTaskId);
  const timelineItems = useChatStore((s) => s.timelineItems);
  const selectedAgentId = useChatStore((s) => s.selectedAgentId);
  const setActiveSession = useChatStore((s) => s.setActiveSession);
  const clearTimeline = useChatStore((s) => s.clearTimeline);
  const setPendingTask = useChatStore((s) => s.setPendingTask);
  const { push } = useNavigation();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebar, setMobileSidebar] = useState(false);

  const { data: agents = [] } = useQuery(agentListOptions(wsId));
  const { data: members = [] } = useQuery(memberListOptions(wsId));
  const { data: sessions = [] } = useQuery(chatSessionsOptions(wsId));
  const { data: allSessions = [] } = useQuery(allChatSessionsOptions(wsId));
  const { data: rawMessages } = useQuery(
    chatMessagesOptions(activeSessionId ?? ""),
  );
  const messages = activeSessionId ? rawMessages ?? [] : [];
  const archiveSession = useArchiveChatSession();

  // Query-cache source of truth for pending task — syncs Zustand if they diverge.
  // This handles: WS event dropped, race conditions, reconnect gaps.
  const { data: serverPending, dataUpdatedAt } = useQuery(
    pendingChatTaskOptions(activeSessionId ?? ""),
  );
  const serverTaskId = (serverPending as { task_id?: string })?.task_id ?? null;

  useEffect(() => {
    // Server says pending but Zustand doesn't know → adopt it
    if (serverTaskId && !pendingTaskId) {
      setPendingTask(serverTaskId);
    }
    // Server says done but Zustand still waiting → clear it.
    // IMPORTANT: delay the clear so stale query-cache data doesn't race with
    // handleSend and immediately kill the indicator. The safety-net poll in
    // useChatStreaming handles the real "task actually finished" case within 5s.
    if (!serverTaskId && pendingTaskId && dataUpdatedAt) {
      const age = Date.now() - dataUpdatedAt;
      if (age < 8_000) return; // query data is too stale, wait for a fresh fetch
      clearTimeline();
      setPendingTask(null);
    }
  }, [serverTaskId, pendingTaskId, dataUpdatedAt, setPendingTask, clearTimeline]);

  const currentMember = members.find((m) => m.user_id === user?.id);
  const memberRole = currentMember?.role;
  const availableAgents = agents.filter(
    (a) => !a.archived_at && canAssignAgent(a, user?.id, memberRole),
  );
  const activeAgent =
    availableAgents.find((a) => a.id === selectedAgentId) ??
    availableAgents[0] ??
    null;

  const currentSession = activeSessionId
    ? allSessions.find((s) => s.id === activeSessionId)
    : null;
  const isSessionArchived = currentSession?.status === "archived";

  // Auto-restore most recent active session on mount
  const didRestoreRef = useRef(false);
  useEffect(() => {
    if (didRestoreRef.current) return;
    didRestoreRef.current = true;
    if (activeSessionId || sessions.length === 0) return;
    const latest = sessions.find((s) => s.status === "active");
    if (latest) setActiveSession(latest.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions]);

  useChatStreaming();
  const { handleSend, handleStop, isSending } = useChatSend(activeAgent);

  const handleNewChat = useCallback(() => {
    setActiveSession(null);
    clearTimeline();
    setPendingTask(null);
  }, [setActiveSession, clearTimeline, setPendingTask]);

  const handleSelectSession = useCallback(
    (session: ChatSession) => {
      setActiveSession(session.id);
      clearTimeline();
      setPendingTask(null);
      setMobileSidebar(false);
    },
    [setActiveSession, clearTimeline, setPendingTask],
  );

  const handleArchive = useCallback(
    (e: React.MouseEvent, sessionId: string) => {
      e.stopPropagation();
      archiveSession.mutate(sessionId);
      if (activeSessionId === sessionId) setActiveSession(null);
    },
    [archiveSession, activeSessionId, setActiveSession],
  );

  const hasMessages = messages.length > 0 || timelineItems.length > 0 || isSending || !!pendingTaskId;
  const noAgents = availableAgents.length === 0;
  const isWorking = isSending || !!pendingTaskId;

  return (
    <div className="flex h-full overflow-hidden rounded-[inherit]">
      {/* Desktop sidebar */}
      {sidebarOpen && (
        <aside className="hidden md:flex w-64 shrink-0 border-r flex-col">
          <SidebarHeader
            onNewChat={handleNewChat}
            onCollapse={() => setSidebarOpen(false)}
                />
          <SidebarContent
            sessions={sessions}
            activeSessionId={activeSessionId}
            onSelect={handleSelectSession}
            onArchive={handleArchive}
          />
        </aside>
      )}

      {/* Mobile sidebar overlay */}
      {mobileSidebar && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={() => setMobileSidebar(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-72 flex flex-col bg-background border-r shadow-xl md:hidden">
            <SidebarHeader
              onNewChat={() => { handleNewChat(); setMobileSidebar(false); }}
              onCollapse={() => setMobileSidebar(false)}
                    />
            <SidebarContent
              sessions={sessions}
              activeSessionId={activeSessionId}
              onSelect={handleSelectSession}
              onArchive={handleArchive}
            />
          </aside>
        </>
      )}

      {/* Main chat area */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="flex items-center gap-2 border-b px-3 py-2 shrink-0">
          {/* Desktop: show sidebar toggle when collapsed */}
          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="hidden md:flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
              title="Show sidebar"
            >
              <PanelLeft className="size-4" />
            </button>
          )}
          {/* Mobile: sidebar toggle */}
          <button
            onClick={() => setMobileSidebar(true)}
            className="flex md:hidden size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
          >
            <PanelLeft className="size-4" />
          </button>
          <Wand2 className="size-3.5 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium truncate flex-1">
            {currentSession?.title || "New conversation"}
          </span>
          {/* Live status indicator */}
          {isWorking && (
            <span className="flex items-center gap-1.5 shrink-0 rounded-full bg-emerald-500/15 px-2.5 py-0.5 border border-emerald-500/25">
              <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-semibold text-emerald-400">
                {isSending ? "Sending…" : "Working…"}
              </span>
            </span>
          )}
          {activeAgent && (
            <span className="text-xs text-muted-foreground shrink-0 hidden sm:block">
              {activeAgent.name}
            </span>
          )}
          {messages.length > 0 && (
            <ExportChatButton messages={messages} agentName={activeAgent?.name} />
          )}
        </div>

        {/* Messages or empty state */}
        {noAgents ? (
          <NoAgentsState onNavigate={() => push("/agents")} />
        ) : hasMessages ? (
          <ChatMessageList
            messages={messages}
            pendingTaskId={pendingTaskId}
            isWaiting={isWorking}
            agent={activeAgent}
            onFollowUp={handleSend}
          />
        ) : (
          <EmptyState
            agentName={activeAgent?.name}
            onSelectPrompt={handleSend}
          />
        )}

        {/* Input */}
        <ChatInput
          onSend={handleSend}
          onStop={handleStop}
          isRunning={isWorking}
          disabled={isSessionArchived || noAgents}
          placeholder={
            noAgents
              ? "Create an agent first to start chatting"
              : isSessionArchived
                ? "This session is archived"
                : "Ask Gandalf..."
          }
        />
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sidebar components
// ---------------------------------------------------------------------------

function SidebarHeader({
  onNewChat,
  onCollapse,
}: {
  onNewChat: () => void;
  onCollapse: () => void;
}) {
  return (
    <div className="flex items-center justify-between border-b px-3 py-2 shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        <Wand2 className="size-4 text-muted-foreground shrink-0" />
        <span className="text-sm font-semibold truncate">Chats</span>
      </div>
      <div className="flex items-center gap-0.5">
        <button
          onClick={onNewChat}
          title="New chat"
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Plus className="size-4" />
        </button>
        <button
          onClick={onCollapse}
          title="Collapse sidebar"
          className="hidden md:flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <PanelLeftClose className="size-4" />
        </button>
      </div>
    </div>
  );
}

function ExportChatButton({ messages, agentName }: { messages: { role: string; content: string; created_at: string }[]; agentName?: string }) {
  const [downloaded, setDownloaded] = useState(false);
  const handleExport = useCallback(() => {
    const lines = messages.map((m) => {
      const role = m.role === "user" ? "You" : (agentName ?? "Agent");
      const time = new Date(m.created_at).toLocaleString();
      return `### ${role} (${time})\n\n${m.content}`;
    });
    const md = `# Chat with ${agentName ?? "Agent"}\n\n${lines.join("\n\n---\n\n")}`;
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chat-${(agentName ?? "agent").toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2000);
  }, [messages, agentName]);

  return (
    <button
      type="button"
      onClick={handleExport}
      className="flex items-center justify-center size-7 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors shrink-0 cursor-pointer"
      title={downloaded ? "Downloaded!" : "Download chat as Markdown"}
    >
      {downloaded ? <Check className="size-3.5 text-emerald-400" /> : <Download className="size-3.5" />}
    </button>
  );
}

function SidebarContent({
  sessions,
  activeSessionId,
  onSelect,
  onArchive,
}: {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelect: (session: ChatSession) => void;
  onArchive: (e: React.MouseEvent, sessionId: string) => void;
}) {
  if (sessions.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground px-4">
        <MessageSquare className="size-5 opacity-40" />
        <span className="text-xs">No conversations yet</span>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <SessionList
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelect={onSelect}
        onArchive={onArchive}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Session list — groups by date
// ---------------------------------------------------------------------------

function groupByDate(sessions: ChatSession[]) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 86400000);
  const weekStart = new Date(todayStart.getTime() - 7 * 86400000);

  const groups: { label: string; items: ChatSession[] }[] = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "This Week", items: [] },
    { label: "Older", items: [] },
  ];

  for (const s of sessions) {
    const d = new Date(s.updated_at);
    if (d >= todayStart) groups[0]!.items.push(s);
    else if (d >= yesterdayStart) groups[1]!.items.push(s);
    else if (d >= weekStart) groups[2]!.items.push(s);
    else groups[3]!.items.push(s);
  }

  return groups.filter((g) => g.items.length > 0);
}

function SessionList({
  sessions,
  activeSessionId,
  onSelect,
  onArchive,
}: {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelect: (session: ChatSession) => void;
  onArchive: (e: React.MouseEvent, sessionId: string) => void;
}) {
  const groups = groupByDate(sessions);

  return (
    <div className="py-1">
      {groups.map((group) => (
        <div key={group.label}>
          <div className="px-3 pt-3 pb-1">
            <span className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider">
              {group.label}
            </span>
          </div>
          {group.items.map((session) => {
            const isActive = session.id === activeSessionId;
            return (
              <div
                key={session.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelect(session)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onSelect(session); }}
                className={`group flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left transition-colors rounded-md mx-1 ${
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                }`}
                style={{ width: "calc(100% - 8px)" }}
              >
                <MessageSquare className="size-3.5 shrink-0 opacity-50" />
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-sm">
                    {session.title || "Untitled"}
                  </span>
                </div>
                <button
                  onClick={(e) => onArchive(e, session.id)}
                  title="Archive"
                  className="invisible group-hover:visible flex size-5 items-center justify-center rounded text-muted-foreground hover:text-destructive shrink-0"
                >
                  <ArchiveX className="size-3" />
                </button>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty states
// ---------------------------------------------------------------------------

function EmptyState({
  agentName,
  onSelectPrompt,
}: {
  agentName?: string;
  onSelectPrompt: (prompt: string) => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-end gap-4 px-4 pb-4">
      <div className="flex flex-col items-center gap-1 mb-2">
        <Sparkles className="size-5 text-muted-foreground/60" />
        <p className="text-sm text-muted-foreground">
          {agentName ? `Start a conversation with ${agentName}` : "How can Gandalf help you today?"}
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-xl">
        {SUGGESTED_PROMPTS.map((prompt) => (
          <button
            key={prompt.text}
            onClick={() => onSelectPrompt(prompt.text)}
            className="flex items-start gap-2.5 text-left rounded-lg border border-border/60 px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground hover:border-border"
          >
            <span className="shrink-0 text-base leading-5">{prompt.icon}</span>
            <span className="leading-5">{prompt.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function NoAgentsState({ onNavigate }: { onNavigate: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8">
      <Bot className="size-8 text-muted-foreground/30" />
      <p className="text-sm text-muted-foreground text-center">
        No agents available. Create an agent to start chatting.
      </p>
      <button
        onClick={onNavigate}
        className="text-sm text-primary hover:underline"
      >
        Go to Agents
      </button>
    </div>
  );
}

