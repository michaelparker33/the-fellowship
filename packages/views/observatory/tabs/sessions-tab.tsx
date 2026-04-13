"use client";

import { useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { SessionEntry, DailySessionStat } from "@multica/core/types";

interface SessionsData {
  sessions: SessionEntry[];
  daily_stats: DailySessionStat[];
}

interface SessionsTabProps {
  data: SessionsData | null;
  isLoading: boolean;
}

function DailySparkline({ stats }: { stats: DailySessionStat[] }) {
  if (stats.length === 0) return null;

  const chartData = stats.map((s) => ({
    day: new Date(s.day).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    tokens: s.total_tokens,
    cost: s.total_cost_usd,
    tasks: s.task_count,
  }));

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs text-muted-foreground mb-1">Daily tokens (last 30 days)</p>
        <ResponsiveContainer width="100%" height={80}>
          <AreaChart data={chartData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
            <defs>
              <linearGradient id="tokenGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="day" hide />
            <YAxis hide />
            <Tooltip
              contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: "6px", fontSize: "11px" }}
              labelStyle={{ color: "hsl(var(--foreground))" }}
              formatter={(v) => [(v as number).toLocaleString(), "tokens"]}
            />
            <Area type="monotone" dataKey="tokens" stroke="#f59e0b" strokeWidth={1.5} fill="url(#tokenGrad)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div>
        <p className="text-xs text-muted-foreground mb-1">Daily cost USD</p>
        <ResponsiveContainer width="100%" height={60}>
          <AreaChart data={chartData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
            <defs>
              <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="day" hide />
            <YAxis hide />
            <Tooltip
              contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: "6px", fontSize: "11px" }}
              labelStyle={{ color: "hsl(var(--foreground))" }}
              formatter={(v) => [`$${(v as number).toFixed(4)}`, "cost"]}
            />
            <Area type="monotone" dataKey="cost" stroke="#22c55e" strokeWidth={1.5} fill="url(#costGrad)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

const STATUS_COLOR: Record<string, string> = {
  completed: "text-green-400",
  failed: "text-red-400",
  running: "text-amber-400",
  queued: "text-muted-foreground",
};

function SessionRow({ session }: { session: SessionEntry }) {
  const [expanded, setExpanded] = useState(false);
  const statusColor = STATUS_COLOR[session.status] ?? "text-muted-foreground";
  const duration =
    session.started_at && session.completed_at
      ? Math.round((new Date(session.completed_at).getTime() - new Date(session.started_at).getTime()) / 1000)
      : null;

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className={`text-xs font-medium mt-0.5 shrink-0 ${statusColor}`}>●</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium truncate">{session.issue_title || session.task_id}</p>
            <span className="text-xs text-muted-foreground shrink-0">${session.cost_usd.toFixed(4)}</span>
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
            <span>{session.agent_name}</span>
            {session.model && <span className="font-mono">{session.model}</span>}
            <span>{session.total_tokens.toLocaleString()} tok</span>
            {duration !== null && <span>{duration}s</span>}
            <span>{new Date(session.created_at).toLocaleDateString()}</span>
          </div>
        </div>
        <span className="text-muted-foreground text-xs mt-0.5">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-3 pt-1 border-t border-border bg-muted/10">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <div className="text-muted-foreground mb-0.5">Input tokens</div>
              <div className="font-mono">{session.input_tokens.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-muted-foreground mb-0.5">Output tokens</div>
              <div className="font-mono">{session.output_tokens.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-muted-foreground mb-0.5">Cache read</div>
              <div className="font-mono">{session.cache_read_tokens.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-muted-foreground mb-0.5">Cache write</div>
              <div className="font-mono">{session.cache_write_tokens.toLocaleString()}</div>
            </div>
          </div>
          {session.started_at && (
            <p className="text-xs text-muted-foreground mt-2">
              Started {new Date(session.started_at).toLocaleString()}
              {session.completed_at && ` · ended ${new Date(session.completed_at).toLocaleString()}`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function SessionsTab({ data, isLoading }: SessionsTabProps) {
  if (isLoading) {
    return (
      <div className="p-6 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="border border-border rounded-lg h-16 animate-pulse bg-muted/20" />
        ))}
      </div>
    );
  }

  if (!data || data.sessions.length === 0) {
    return (
      <div className="p-6 text-center text-muted-foreground text-sm">
        No session history yet.
      </div>
    );
  }

  const totalCost = data.sessions.reduce((sum, s) => sum + s.cost_usd, 0);
  const totalTokens = data.sessions.reduce((sum, s) => sum + s.total_tokens, 0);

  return (
    <div className="p-6 space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="border border-border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold">{data.sessions.length}</div>
          <div className="text-xs text-muted-foreground mt-1">Total sessions</div>
        </div>
        <div className="border border-border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold">{totalTokens.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground mt-1">Total tokens</div>
        </div>
        <div className="border border-border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-400">${totalCost.toFixed(2)}</div>
          <div className="text-xs text-muted-foreground mt-1">Total cost</div>
        </div>
      </div>

      {/* Sparkline */}
      {data.daily_stats.length > 0 && (
        <div className="border border-border rounded-lg p-4">
          <DailySparkline stats={data.daily_stats} />
        </div>
      )}

      {/* Session list */}
      <div className="space-y-2">
        {data.sessions.map((s) => (
          <SessionRow key={s.task_id} session={s} />
        ))}
      </div>
    </div>
  );
}
