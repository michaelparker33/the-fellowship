"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Clock,
  Loader2,
  MessageSquare,
  SearchIcon,
  Inbox,
  CircleUser,
  ListTodo,
  FolderKanban,
  Bot,
  Monitor,
  BookOpenText,
  Settings,
  Target,
  Lightbulb,
  type LucideIcon,
} from "lucide-react";
import { Command as CommandPrimitive } from "cmdk";
import type { UnifiedSearchResponse, IssueStatus } from "@multica/core/types";
import { api } from "@multica/core/api";
import { useRecentIssuesStore } from "@multica/core/issues/stores";
import { StatusIcon } from "../issues/components";
import { STATUS_CONFIG } from "@multica/core/issues/config";
import { PROJECT_STATUS_CONFIG } from "@multica/core/projects/config";
import type { ProjectStatus } from "@multica/core/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@multica/ui/components/ui/dialog";
import { useNavigation } from "../navigation";
import { useSearchStore } from "./search-store";

function HighlightText({ text, query }: { text: string; query: string }) {
  const parts = useMemo(() => {
    if (!query.trim()) return [{ text, highlight: false }];
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${escaped})`, "gi");
    const result: { text: string; highlight: boolean }[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        result.push({ text: text.slice(lastIndex, match.index), highlight: false });
      }
      result.push({ text: match[0], highlight: true });
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < text.length) {
      result.push({ text: text.slice(lastIndex), highlight: false });
    }
    return result.length > 0 ? result : [{ text, highlight: false }];
  }, [text, query]);

  return (
    <>
      {parts.map((part, i) =>
        part.highlight ? (
          <mark key={i} className="bg-yellow-200 dark:bg-yellow-900/60 text-inherit rounded-sm">
            {part.text}
          </mark>
        ) : (
          part.text
        ),
      )}
    </>
  );
}

interface NavPage {
  href: string;
  label: string;
  icon: LucideIcon;
  keywords: string[];
}

const navPages: NavPage[] = [
  { href: "/inbox", label: "Inbox", icon: Inbox, keywords: ["inbox", "notifications"] },
  { href: "/my-issues", label: "My Issues", icon: CircleUser, keywords: ["my", "issues", "assigned"] },
  { href: "/issues", label: "Issues", icon: ListTodo, keywords: ["issues", "tasks", "bugs"] },
  { href: "/projects", label: "Projects", icon: FolderKanban, keywords: ["projects", "kanban"] },
  { href: "/agents", label: "Agents", icon: Bot, keywords: ["agents", "bots", "ai"] },
  { href: "/runtimes", label: "Runtimes", icon: Monitor, keywords: ["runtimes", "environments"] },
  { href: "/skills", label: "Skills", icon: BookOpenText, keywords: ["skills", "library"] },
  { href: "/settings", label: "Settings", icon: Settings, keywords: ["settings", "config", "preferences"] },
];

const groupHeadingClass =
  "p-2 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground";

const itemClass =
  "flex cursor-default select-none items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm outline-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 data-selected:bg-accent";

export function SearchCommand() {
  const { push } = useNavigation();
  const open = useSearchStore((s) => s.open);
  const setOpen = useSearchStore((s) => s.setOpen);
  const recentIssues = useRecentIssuesStore((s) => s.items);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UnifiedSearchResponse>({});
  const [isLoading, setIsLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const filteredPages = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return navPages.filter(
      (page) =>
        page.label.toLowerCase().includes(q) ||
        page.keywords.some((kw) => kw.includes(q)),
    );
  }, [query]);

  const hasResults =
    (results.issues?.length ?? 0) > 0 ||
    (results.projects?.length ?? 0) > 0 ||
    (results.goals?.length ?? 0) > 0 ||
    (results.brain_dumps?.length ?? 0) > 0 ||
    (results.agents?.length ?? 0) > 0 ||
    (results.chats?.length ?? 0) > 0;

  // Global Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        useSearchStore.getState().toggle();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Close on single ESC — capture phase fires before base-ui Dialog's handlers
  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("keydown", handleEsc, true);
    return () => document.removeEventListener("keydown", handleEsc, true);
  }, [open, setOpen]);

  // Cleanup debounce/abort on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults({});
      setIsLoading(false);
    }
  }, [open]);

  const search = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();

    if (!q.trim()) {
      setResults({});
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await api.unifiedSearch({
          q: q.trim(),
          limit: 5,
          signal: controller.signal,
        });
        if (!controller.signal.aborted) {
          setResults(res);
          setIsLoading(false);
        }
      } catch {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }, 300);
  }, []);

  const handleValueChange = useCallback(
    (value: string) => {
      setQuery(value);
      search(value);
    },
    [search],
  );

  const handleSelect = useCallback(
    (value: string) => {
      setOpen(false);
      if (value.startsWith("project:")) {
        push(`/projects/${value.slice(8)}`);
      } else if (value.startsWith("goal:")) {
        push("/issues");
      } else if (value.startsWith("braindump:")) {
        push("/brain-dump");
      } else if (value.startsWith("agent:")) {
        push(`/agents/${value.slice(6)}`);
      } else if (value.startsWith("chat:")) {
        push(`/chat?session=${value.slice(5)}`);
      } else {
        push(`/issues/${value}`);
      }
    },
    [push, setOpen],
  );

  const handlePageSelect = useCallback(
    (href: string) => {
      setOpen(false);
      push(href);
    },
    [push],
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="top-[20%] translate-y-0 overflow-hidden rounded-xl! p-0 sm:max-w-xl!"
        showCloseButton={false}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Search</DialogTitle>
          <DialogDescription>
            Search pages, issues, projects, goals, agents, and more
          </DialogDescription>
        </DialogHeader>
        <CommandPrimitive
          shouldFilter={false}
          className="flex size-full flex-col overflow-hidden rounded-xl bg-popover text-popover-foreground"
        >
          {/* Search input */}
          <div className="flex items-center gap-3 border-b px-4 py-3">
            <SearchIcon className="size-5 shrink-0 text-muted-foreground" />
            <CommandPrimitive.Input
              placeholder="Type a command or search..."
              value={query}
              onValueChange={handleValueChange}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <kbd className="hidden shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline">
              ESC
            </kbd>
          </div>

          {/* Results list */}
          <CommandPrimitive.List className="max-h-[min(400px,50vh)] overflow-y-auto overflow-x-hidden">
            {/* Pages section — only shown when query matches */}
            {filteredPages.length > 0 && (
              <CommandPrimitive.Group className="p-2">
                <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground">
                  Pages
                </div>
                {filteredPages.map((page) => (
                  <CommandPrimitive.Item
                    key={page.href}
                    value={`page:${page.href}`}
                    onSelect={() => handlePageSelect(page.href)}
                    className={itemClass}
                  >
                    <page.icon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">
                      <HighlightText text={page.label} query={query} />
                    </span>
                  </CommandPrimitive.Item>
                ))}
              </CommandPrimitive.Group>
            )}

            {isLoading && (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            )}

            {!isLoading && query.trim() && !hasResults && filteredPages.length === 0 && (
              <CommandPrimitive.Empty className="py-10 text-center text-sm text-muted-foreground">
                No results found.
              </CommandPrimitive.Empty>
            )}

            {/* Issues */}
            {!isLoading && (results.issues?.length ?? 0) > 0 && (
              <CommandPrimitive.Group heading="Issues" className={groupHeadingClass}>
                {results.issues!.map((issue) => (
                  <CommandPrimitive.Item
                    key={issue.id}
                    value={issue.id}
                    onSelect={handleSelect}
                    className={itemClass}
                  >
                    <StatusIcon
                      status={issue.status as IssueStatus}
                      className="size-4 shrink-0"
                    />
                    <span className="text-xs text-muted-foreground shrink-0">
                      {issue.identifier}
                    </span>
                    <span className="truncate">
                      <HighlightText text={issue.title} query={query} />
                    </span>
                    <span
                      className={`ml-auto text-xs shrink-0 ${STATUS_CONFIG[issue.status as IssueStatus]?.iconColor ?? "text-muted-foreground"}`}
                    >
                      {STATUS_CONFIG[issue.status as IssueStatus]?.label ?? issue.status}
                    </span>
                  </CommandPrimitive.Item>
                ))}
              </CommandPrimitive.Group>
            )}

            {/* Projects */}
            {!isLoading && (results.projects?.length ?? 0) > 0 && (
              <CommandPrimitive.Group heading="Projects" className={groupHeadingClass}>
                {results.projects!.map((project) => (
                  <CommandPrimitive.Item
                    key={`project:${project.id}`}
                    value={`project:${project.id}`}
                    onSelect={handleSelect}
                    className={itemClass}
                  >
                    <span className="size-4 shrink-0 text-center text-sm leading-4">
                      {project.icon || <FolderKanban className="size-4 text-muted-foreground" />}
                    </span>
                    <span className="truncate">
                      <HighlightText text={project.name} query={query} />
                    </span>
                    <span
                      className={`ml-auto text-xs shrink-0 ${PROJECT_STATUS_CONFIG[project.status as ProjectStatus]?.color ?? "text-muted-foreground"}`}
                    >
                      {PROJECT_STATUS_CONFIG[project.status as ProjectStatus]?.label ?? project.status}
                    </span>
                  </CommandPrimitive.Item>
                ))}
              </CommandPrimitive.Group>
            )}

            {/* Goals */}
            {!isLoading && (results.goals?.length ?? 0) > 0 && (
              <CommandPrimitive.Group heading="Goals" className={groupHeadingClass}>
                {results.goals!.map((goal) => (
                  <CommandPrimitive.Item
                    key={`goal:${goal.id}`}
                    value={`goal:${goal.id}`}
                    onSelect={handleSelect}
                    className={itemClass}
                  >
                    <Target className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">
                      <HighlightText text={goal.title} query={query} />
                    </span>
                  </CommandPrimitive.Item>
                ))}
              </CommandPrimitive.Group>
            )}

            {/* Brain Dumps */}
            {!isLoading && (results.brain_dumps?.length ?? 0) > 0 && (
              <CommandPrimitive.Group heading="Brain Dumps" className={groupHeadingClass}>
                {results.brain_dumps!.map((dump) => (
                  <CommandPrimitive.Item
                    key={`braindump:${dump.id}`}
                    value={`braindump:${dump.id}`}
                    onSelect={handleSelect}
                    className={itemClass}
                  >
                    <Lightbulb className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">
                      <HighlightText text={dump.content} query={query} />
                    </span>
                    {dump.processed && (
                      <span className="ml-auto text-xs shrink-0 text-muted-foreground">
                        processed
                      </span>
                    )}
                  </CommandPrimitive.Item>
                ))}
              </CommandPrimitive.Group>
            )}

            {/* Agents */}
            {!isLoading && (results.agents?.length ?? 0) > 0 && (
              <CommandPrimitive.Group heading="Agents" className={groupHeadingClass}>
                {results.agents!.map((agent) => (
                  <CommandPrimitive.Item
                    key={`agent:${agent.id}`}
                    value={`agent:${agent.id}`}
                    onSelect={handleSelect}
                    className={itemClass}
                  >
                    <Bot className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">
                      <HighlightText text={agent.name} query={query} />
                    </span>
                    <span className="ml-auto text-xs shrink-0 text-muted-foreground">
                      {agent.runtime_mode}
                    </span>
                  </CommandPrimitive.Item>
                ))}
              </CommandPrimitive.Group>
            )}

            {/* Chats */}
            {!isLoading && (results.chats?.length ?? 0) > 0 && (
              <CommandPrimitive.Group heading="Chats" className={groupHeadingClass}>
                {results.chats!.map((chat) => (
                  <CommandPrimitive.Item
                    key={`chat:${chat.id}`}
                    value={`chat:${chat.id}`}
                    onSelect={handleSelect}
                    className={itemClass}
                  >
                    <MessageSquare className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">
                      <HighlightText text={chat.title} query={query} />
                    </span>
                  </CommandPrimitive.Item>
                ))}
              </CommandPrimitive.Group>
            )}

            {/* Recent issues — shown when no query */}
            {!isLoading && !query.trim() && recentIssues.length > 0 && (
              <CommandPrimitive.Group className="p-2">
                <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                  <Clock className="size-3" />
                  <span>Recent</span>
                </div>
                {recentIssues.map((item) => (
                  <CommandPrimitive.Item
                    key={item.id}
                    value={item.id}
                    onSelect={handleSelect}
                    className={itemClass}
                  >
                    <StatusIcon
                      status={item.status}
                      className="size-4 shrink-0"
                    />
                    <span className="text-xs text-muted-foreground shrink-0">
                      {item.identifier}
                    </span>
                    <span className="truncate">{item.title}</span>
                    <span
                      className={`ml-auto text-xs shrink-0 ${STATUS_CONFIG[item.status]?.iconColor ?? ""}`}
                    >
                      {STATUS_CONFIG[item.status]?.label ?? ""}
                    </span>
                  </CommandPrimitive.Item>
                ))}
              </CommandPrimitive.Group>
            )}

            {!isLoading && !query.trim() && recentIssues.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-10 text-sm text-muted-foreground">
                <span>Type to search issues, projects, agents, and more...</span>
                <span className="text-xs">Press <kbd className="rounded bg-muted px-1.5 py-0.5 font-medium">&#8984;K</kbd> to open this anytime</span>
              </div>
            )}
          </CommandPrimitive.List>
        </CommandPrimitive>
      </DialogContent>
    </Dialog>
  );
}
