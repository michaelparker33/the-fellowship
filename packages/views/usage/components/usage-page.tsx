"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWorkspaceId } from "@multica/core/hooks";
import {
  usageDailyOptions,
  usageSummaryOptions,
  usageByAgentOptions,
} from "@multica/core/usage/queries";
import { api } from "@multica/core/api";
import { BarChart3, DollarSign, Zap, Bot } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@multica/ui/components/ui/card";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@multica/ui/components/ui/select";
import { Skeleton } from "@multica/ui/components/ui/skeleton";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// Model pricing (client-side mirror for display, same as backend)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "claude-opus-4-5": { input: 15, output: 75 },
  "claude-opus-4-6": { input: 15, output: 75 },
  "claude-sonnet-4-5": { input: 3, output: 15 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-haiku-4-5": { input: 0.8, output: 4 },
  "glm-5.1": { input: 0.1, output: 0.3 },
  "grok-4-fast": { input: 0.5, output: 1.5 },
};

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return 0;
  return (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;
}

function formatCost(usd: number): string {
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  if (usd < 1) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function UsagePage() {
  const wsId = useWorkspaceId();
  const [days, setDays] = useState(30);

  const { data: dailyData, isLoading: dailyLoading } = useQuery(usageDailyOptions(wsId, days));
  const { data: summaryData } = useQuery(usageSummaryOptions(wsId, days));
  const { data: agentData, isLoading: agentLoading } = useQuery(usageByAgentOptions(wsId, days));
  const { data: dailySpendData } = useQuery({
    queryKey: ["usage", wsId, "daily-spend"],
    queryFn: () => api.getDailySpend(),
  });

  const dailySpend = dailySpendData?.cost_usd ?? 0;

  // Aggregate summary totals
  const totals = useMemo(() => {
    if (!summaryData || !Array.isArray(summaryData)) return { cost: 0, tokens: 0, tasks: 0 };
    let cost = 0;
    let tokens = 0;
    let tasks = 0;
    for (const row of summaryData) {
      cost += estimateCost(row.model, row.total_input_tokens, row.total_output_tokens);
      tokens += row.total_input_tokens + row.total_output_tokens;
      tasks += row.task_count;
    }
    return { cost, tokens, tasks };
  }, [summaryData]);

  // Daily chart data — aggregate by date
  const chartData = useMemo(() => {
    if (!dailyData || !Array.isArray(dailyData)) return [];
    const byDate = new Map<string, { date: string; cost: number; tokens: number }>();
    for (const row of dailyData) {
      const existing = byDate.get(row.date) ?? { date: row.date, cost: 0, tokens: 0 };
      existing.cost += estimateCost(row.model, row.total_input_tokens, row.total_output_tokens);
      existing.tokens += row.total_input_tokens + row.total_output_tokens;
      byDate.set(row.date, existing);
    }
    return Array.from(byDate.values()).reverse();
  }, [dailyData]);

  // Agent breakdown
  const agentBreakdown = useMemo(() => {
    if (!agentData || !Array.isArray(agentData)) return [];
    const byAgent = new Map<string, { agent_id: string; agent_name: string; cost: number; tokens: number; tasks: number }>();
    for (const row of agentData) {
      const key = row.agent_id;
      const existing = byAgent.get(key) ?? { agent_id: key, agent_name: row.agent_name, cost: 0, tokens: 0, tasks: 0 };
      existing.cost += row.total_cost_usd ?? estimateCost(row.model, row.total_input_tokens, row.total_output_tokens);
      existing.tokens += row.total_input_tokens + row.total_output_tokens;
      existing.tasks += row.task_count;
      byAgent.set(key, existing);
    }
    return Array.from(byAgent.values()).sort((a, b) => b.cost - a.cost);
  }, [agentData]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b px-5">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <h1 className="text-sm font-medium">Cost & Usage</h1>
        </div>
        <Select value={String(days)} onValueChange={(v) => setDays(Number(v) || 30)}>
          <SelectTrigger className="w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Today</SelectItem>
            <SelectItem value="7">7 days</SelectItem>
            <SelectItem value="30">30 days</SelectItem>
            <SelectItem value="90">90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Today</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCost(dailySpend)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{days}d Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCost(totals.cost)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Tokens</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatTokens(totals.tokens)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tasks</CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.tasks}</div>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      {dailyLoading ? (
        <Skeleton className="h-64 w-full rounded-lg" />
      ) : chartData.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Daily Spend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  stroke="hsl(var(--muted-foreground))"
                  tickFormatter={(v) => `$${v.toFixed(2)}`}
                />
                <Tooltip
                  formatter={(value) => [`$${Number(value).toFixed(4)}`, "Cost"]}
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="cost"
                  stroke="#FF6600"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      ) : null}

      {/* Per-agent breakdown */}
      {agentLoading ? (
        <Skeleton className="h-48 w-full rounded-lg" />
      ) : agentBreakdown.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Per-Agent Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded border divide-y">
              <div className="grid grid-cols-[1fr_100px_100px_80px] gap-4 px-4 py-2 text-xs font-medium text-muted-foreground">
                <span>Agent</span>
                <span>Cost</span>
                <span>Tokens</span>
                <span>Tasks</span>
              </div>
              {agentBreakdown.map((row) => (
                <div key={row.agent_id} className="grid grid-cols-[1fr_100px_100px_80px] gap-4 items-center px-4 py-2.5 text-sm">
                  <span className="font-medium truncate">{row.agent_name}</span>
                  <span>{formatCost(row.cost)}</span>
                  <span className="text-muted-foreground">{formatTokens(row.tokens)}</span>
                  <span className="text-muted-foreground">{row.tasks}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
      </div>
    </div>
  );
}
