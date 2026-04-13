"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Maximize2,
  Minimize2,
  Shield,
  Wand2,
  Swords,
  Activity,
  DollarSign,
  Clock,
  ShieldAlert,
  Sparkles,
  Tv,
  Grid2x2,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@multica/ui/components/ui/card";
import { useWorkspaceId } from "@multica/core/hooks";
import { approvalListOptions } from "@multica/core/council/queries";
import { observatoryPatternsOptions } from "@multica/core/observatory/queries";
import { api } from "@multica/core/api";
import { eisenhowerCountsOptions } from "@multica/core/eisenhower";
import type { HeatmapCell } from "@multica/core/types";

// ---------------------------------------------------------------------------
// Gandalf-only quotes
// ---------------------------------------------------------------------------

const GANDALF_QUOTES = [
  "All we have to decide is what to do with the time that is given us.",
  "Even the wisest cannot see all ends.",
  "A wizard is never late, nor is he early, he arrives precisely when he means to.",
  "Many that live deserve death. And some that die deserve life.",
  "Do not be too eager to deal out death in judgment.",
  "The treacherous are ever distrustful.",
  "I will not say: do not weep; for not all tears are an evil.",
  "It is not the strength of the body, but the strength of the spirit.",
  "There is some good in this world, and it is worth fighting for.",
  "Courage is found in unlikely places.",
];

// ---------------------------------------------------------------------------
// GG33 numerology
// ---------------------------------------------------------------------------

/** Reduce a number to a single digit, preserving master numbers (11, 22, 33). */
function reduceDigits(n: number): number {
  while (n > 9 && n !== 11 && n !== 22 && n !== 33) {
    let next = 0;
    for (const d of String(n)) next += Number(d);
    n = next;
  }
  return n;
}

/** Sum all individual digits of a number (e.g. 2026 → 2+0+2+6 = 10). */
function digitSum(n: number): number {
  let sum = 0;
  for (const d of String(n)) sum += Number(d);
  return sum;
}

/** Get today's date parts in America/Los_Angeles timezone. */
function localDateParts(): { month: number; day: number; year: number } {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
  const parts = formatter.formatToParts(new Date());
  return {
    month: Number(parts.find((p) => p.type === "month")?.value ?? 1),
    day: Number(parts.find((p) => p.type === "day")?.value ?? 1),
    year: Number(parts.find((p) => p.type === "year")?.value ?? 2026),
  };
}

/**
 * GG33 Universal Day Number.
 * Sum all digits of the full date (month + day + year) and reduce.
 * e.g. April 13 2026 → 4+1+3+2+0+2+6 = 18 → 1+8 = 9
 */
function universalDayNumber(month: number, day: number, year: number): number {
  const sum = digitSum(month) + digitSum(day) + digitSum(year);
  return reduceDigits(sum);
}

/**
 * GG33 Personal Day Number.
 * Personal Day = Personal Year + current month + current day, then reduce.
 * Personal Year = birth month + birth day + current year, then reduce.
 *
 * Using Michael Parker's birthday: November 18 (11/18).
 * This is hardcoded for the primary user; a setting could be added later.
 */
function personalDayNumber(month: number, day: number, year: number): number {
  const birthMonth = 11;
  const birthDay = 18;

  // Personal Year = reduce(birth month + birth day + current year digits)
  const personalYear = reduceDigits(digitSum(birthMonth) + digitSum(birthDay) + digitSum(year));

  // Personal Day = reduce(personal year + current month + current day)
  const personalDay = reduceDigits(personalYear + month + day);
  return personalDay;
}

function getQuoteOfDay() {
  const idx = Math.floor(Date.now() / 86400000) % GANDALF_QUOTES.length;
  return GANDALF_QUOTES[idx] ?? "";
}

// ---------------------------------------------------------------------------
// Strider personas
// ---------------------------------------------------------------------------

const PERSONAS: { name: string; status: string }[] = [
  { name: "Watcher", status: "idle" },
  { name: "Spy", status: "idle" },
  { name: "Scout", status: "idle" },
  { name: "Seeker", status: "idle" },
  { name: "Scribe", status: "idle" },
];

const STATUS_DOT: Record<string, string> = {
  active: "bg-green-500",
  idle: "bg-muted-foreground/40",
  error: "bg-red-500",
};

// ---------------------------------------------------------------------------
// Compact heatmap
// ---------------------------------------------------------------------------

const DAYS_SHORT = ["S", "M", "T", "W", "T", "F", "S"];

function buildHeatmapGrid(cells: HeatmapCell[]): number[][] {
  const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const cell of cells) {
    if (cell.day_of_week >= 0 && cell.day_of_week < 7 && cell.hour_of_day >= 0 && cell.hour_of_day < 24) {
      grid[cell.day_of_week]![cell.hour_of_day] = cell.task_count;
    }
  }
  return grid;
}

function CompactHeatmap({ cells }: { cells: HeatmapCell[] }) {
  const grid = buildHeatmapGrid(cells);
  const maxVal = Math.max(...cells.map((c) => c.task_count), 1);

  if (cells.length === 0) {
    return <p className="text-sm text-muted-foreground">No activity data yet.</p>;
  }

  return (
    <div className="flex gap-1">
      <div className="flex flex-col gap-px shrink-0 pt-3">
        {DAYS_SHORT.map((d, i) => (
          <div key={i} className="h-[14px] w-4 text-[9px] text-muted-foreground/60 flex items-center justify-end pr-0.5">
            {i % 2 === 0 ? d : ""}
          </div>
        ))}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex gap-px mb-0.5">
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="flex-1 text-center text-[8px] text-muted-foreground/40 leading-3">
              {h % 6 === 0 ? h : ""}
            </div>
          ))}
        </div>
        {grid.map((row, day) => (
          <div key={day} className="flex gap-px mb-px">
            {row.map((count, hour) => {
              const intensity = count / maxVal;
              const opacity = count === 0 ? 0.06 : 0.2 + intensity * 0.8;
              return (
                <div
                  key={hour}
                  title={`${DAYS_SHORT[day]} ${hour}:00 — ${count} tasks`}
                  className="flex-1 aspect-square rounded-[2px] min-w-0"
                  style={{ background: `rgba(255, 255, 255, ${opacity})` }}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fullscreen OLED overlay
// ---------------------------------------------------------------------------

function usePixelShift() {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const interval = setInterval(() => {
      setOffset({
        x: Math.round((Math.random() - 0.5) * 6),
        y: Math.round((Math.random() - 0.5) * 6),
      });
    }, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);
  return offset;
}

function useIdleTimer(timeoutMs: number): boolean {
  const [idle, setIdle] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    const reset = () => {
      setIdle(false);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setIdle(true), timeoutMs);
    };
    reset();
    const events = ["mousemove", "keydown", "touchstart", "scroll"];
    for (const ev of events) window.addEventListener(ev, reset, { passive: true });
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      for (const ev of events) window.removeEventListener(ev, reset);
    };
  }, [timeoutMs]);
  return idle;
}

function FullscreenOverlay({
  onExit,
  pendingApprovals,
  dailySpend,
  activeCrons,
  emergencyStop,
  quote,
  heatmapCells,
}: {
  onExit: () => void;
  pendingApprovals: any[];
  dailySpend: number;
  activeCrons: number;
  emergencyStop: boolean;
  quote: string;
  heatmapCells: HeatmapCell[];
}) {
  const pixelShift = usePixelShift();
  const isIdle = useIdleTimer(30 * 60 * 1000);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onExit();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onExit]);

  const { month, day, year } = localDateParts();
  const universalDay = universalDayNumber(month, day, year);
  const personalDay = personalDayNumber(month, day, year);
  const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "America/Los_Angeles" });
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "America/Los_Angeles" });

  // Screensaver — minimal, OLED-safe
  if (isIdle) {
    return (
      <div className="fixed inset-0 z-[100] bg-black text-white flex flex-col items-center justify-center font-sans">
        <p className="text-2xl text-white/10 italic max-w-xl text-center leading-relaxed">
          &ldquo;{quote}&rdquo;
        </p>
        <span className="mt-12 text-6xl font-medium text-white/[0.06] tracking-tight font-mono">{timeStr}</span>
      </div>
    );
  }

  const totalHeatmapTasks = heatmapCells.reduce((sum, c) => sum + c.task_count, 0);

  return (
    <div
      className="fixed inset-0 z-[100] bg-black text-white flex flex-col overflow-hidden select-none font-sans"
      style={{ transform: `translate(${pixelShift.x}px, ${pixelShift.y}px)` }}
    >
      {/* Emergency banner */}
      {emergencyStop && (
        <div className="bg-red-500/90 text-center py-3 text-lg font-bold tracking-wide animate-pulse">
          EMERGENCY STOP — YOU SHALL NOT PASS
        </div>
      )}

      {/* Top bar */}
      <div className="flex items-center justify-between px-8 py-4 shrink-0 border-b border-white/[0.04]">
        <div className="flex items-center gap-5">
          <span className="text-4xl font-bold tracking-tight font-mono text-white/90">{timeStr}</span>
          <span className="text-sm font-medium text-white/20">{dateStr}</span>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-white/20 uppercase">Universal</span>
              <span className="text-xl font-bold font-mono text-muted-foreground">{universalDay}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-white/20 uppercase">Personal</span>
              <span className="text-xl font-bold font-mono text-muted-foreground">{personalDay}</span>
            </div>
          </div>
          <button
            onClick={onExit}
            className="text-white/15 hover:text-white/60 transition-colors p-1.5 rounded-lg hover:bg-white/5"
          >
            <Minimize2 className="size-5" />
          </button>
        </div>
      </div>

      {/* Main grid */}
      <div className="flex-1 grid grid-cols-12 grid-rows-[1fr_1fr_auto] gap-4 p-6 min-h-0">

        {/* The Council — hero, 8 cols top */}
        <div className="col-span-8 row-span-2 rounded-xl border border-white/[0.06] bg-white/[0.015] p-6 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <Shield className="size-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold text-white/80">The Council</h2>
            </div>
            <span className="text-xs font-medium text-white/20 uppercase tracking-wider">
              {pendingApprovals.length} pending
            </span>
          </div>
          {pendingApprovals.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-base font-medium text-white/10">No pending approvals</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-2">
              {pendingApprovals.map((a: any) => (
                <div
                  key={a.id}
                  className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-5 py-3.5 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="size-2 rounded-full bg-white/40" />
                    <span className="text-sm font-mono font-medium text-white/60">{a.action_type}</span>
                    <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${
                      a.risk_level === "critical" ? "bg-red-500/10 text-red-400" :
                      a.risk_level === "high" ? "bg-orange-500/10 text-orange-400" :
                      "bg-white/5 text-white/30"
                    }`}>
                      {a.risk_level}
                    </span>
                  </div>
                  <span className="text-xs font-medium text-white/15">{new Date(a.created_at).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Gandalf — 4 cols, 2 rows */}
        <div className="col-span-4 row-span-2 rounded-xl border border-white/[0.04] bg-white/[0.015] p-6 flex flex-col">
          <div className="flex items-center gap-2.5 mb-4">
            <Wand2 className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Gandalf</h2>
          </div>
          <div className="flex items-center gap-2 mb-5">
            <span className="size-2.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
            <span className="text-sm font-medium text-white/40">Active</span>
          </div>
          <div className="mt-auto pt-4 border-t border-white/[0.04]">
            <p className="text-sm text-white/20 italic leading-relaxed">
              &ldquo;{quote}&rdquo;
            </p>
          </div>
        </div>

        {/* Bottom row — 3 panels */}

        {/* Strider */}
        <div className="col-span-3 rounded-xl border border-white/[0.04] bg-white/[0.015] p-5 flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <Swords className="size-4 text-muted-foreground" />
            <h2 className="text-xs font-semibold text-white/60 uppercase tracking-wider">Strider</h2>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2.5">
            {PERSONAS.map((p) => (
              <div key={p.name} className="flex items-center gap-1.5">
                <span className={`size-2 rounded-full ${
                  p.status === "active" ? "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.4)]" : "bg-white/[0.08]"
                }`} />
                <span className={`text-sm font-medium ${p.status === "active" ? "text-white/60" : "text-white/20"}`}>
                  {p.name}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Heatmap */}
        <div className="col-span-5 rounded-xl border border-white/[0.04] bg-white/[0.015] p-5 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity className="size-4 text-muted-foreground" />
              <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">Activity</span>
            </div>
            <span className="text-lg font-bold font-mono text-muted-foreground">{totalHeatmapTasks}</span>
          </div>
          <div className="flex-1 min-h-0">
            <FullscreenHeatmap cells={heatmapCells} />
          </div>
        </div>

        {/* Vitals */}
        <div className="col-span-4 rounded-xl border border-white/[0.04] bg-white/[0.015] p-5 flex items-center justify-around">
          <div className="text-center">
            <span className="text-2xl font-bold font-mono text-green-400">${dailySpend.toFixed(2)}</span>
            <p className="text-[10px] font-semibold text-white/20 uppercase tracking-wider mt-1">Spend today</p>
          </div>
          <div className="h-8 w-px bg-white/[0.06]" />
          <div className="text-center">
            <span className="text-2xl font-bold font-mono text-white/70">{activeCrons}</span>
            <p className="text-[10px] font-semibold text-white/20 uppercase tracking-wider mt-1">Crons</p>
          </div>
          <div className="h-8 w-px bg-white/[0.06]" />
          <div className="text-center">
            <span className={`text-sm font-bold ${emergencyStop ? "text-red-400" : "text-green-400/60"}`}>
              {emergencyStop ? "HALTED" : "OK"}
            </span>
            <p className="text-[10px] font-semibold text-white/20 uppercase tracking-wider mt-1">Status</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Larger heatmap for fullscreen
function FullscreenHeatmap({ cells }: { cells: HeatmapCell[] }) {
  const grid = buildHeatmapGrid(cells);
  const maxVal = Math.max(...cells.map((c) => c.task_count), 1);

  if (cells.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-white/10 text-lg">No activity data</span>
      </div>
    );
  }

  return (
    <div className="flex gap-1 h-full">
      <div className="flex flex-col gap-[3px] shrink-0 justify-end pb-0">
        {DAYS_SHORT.map((d, i) => (
          <div key={i} className="flex-1 flex items-center justify-end pr-1">
            <span className="text-[10px] text-white/15">{d}</span>
          </div>
        ))}
      </div>
      <div className="flex-1 flex flex-col gap-[3px]">
        {grid.map((row, day) => (
          <div key={day} className="flex-1 flex gap-[3px]">
            {row.map((count, hour) => {
              const intensity = count / maxVal;
              const opacity = count === 0 ? 0.04 : 0.15 + intensity * 0.85;
              return (
                <div
                  key={hour}
                  className="flex-1 rounded-sm"
                  style={{
                    background: `rgba(255, 255, 255, ${opacity})`,
                    boxShadow: intensity > 0.8 ? `0 0 6px rgba(255, 255, 255, ${intensity * 0.4})` : undefined,
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Eisenhower Mini Grid
// ---------------------------------------------------------------------------

function EisenhowerMiniGrid({ wsId }: { wsId: string }) {
  const { data } = useQuery({
    ...eisenhowerCountsOptions(wsId),
    refetchInterval: 30_000,
  });

  const counts = data ?? { do: 0, schedule: 0, delegate: 0, eliminate: 0 };

  const cells: { label: string; count: number; color: string }[] = [
    { label: "Do", count: counts.do, color: "text-red-400" },
    { label: "Schedule", count: counts.schedule, color: "text-blue-400" },
    { label: "Delegate", count: counts.delegate, color: "text-yellow-400" },
    { label: "Eliminate", count: counts.eliminate, color: "text-muted-foreground" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {cells.map((c) => (
        <div key={c.label} className="text-center rounded-lg border border-border bg-muted/30 py-3">
          <span className={`text-2xl font-bold font-mono ${c.color}`}>{c.count}</span>
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mt-0.5">
            {c.label}
          </p>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main War Room Page
// ---------------------------------------------------------------------------

export function WarRoomPage() {
  const wsId = useWorkspaceId();
  const [fullscreen, setFullscreen] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  // Data
  const { data: approvalData } = useQuery(approvalListOptions(wsId, { status: "pending", limit: 10 }));
  const pendingApprovals = approvalData?.items ?? [];

  const { data: spendData } = useQuery({
    queryKey: ["usage", wsId, "daily-spend-war"],
    queryFn: () => api.getDailySpend(),
    refetchInterval: 30_000,
  });
  const dailySpend = spendData?.cost_usd ?? 0;

  const { data: cronData } = useQuery({
    queryKey: ["watch", wsId, "count-war"],
    queryFn: () => api.countEnabledScheduledTasks(),
    refetchInterval: 30_000,
  });
  const activeCrons = (cronData as { count: number } | undefined)?.count ?? 0;

  const { data: safetyData } = useQuery({
    queryKey: ["safety", wsId, "config-war"],
    queryFn: () => api.getSafetyConfig(),
    refetchInterval: 30_000,
  });
  const emergencyStop = safetyData?.emergency_stop ?? false;

  const { data: patternsData } = useQuery({
    ...observatoryPatternsOptions(wsId),
    refetchInterval: 60_000,
  });

  const { month, day, year } = localDateParts();
  const universalDay = universalDayNumber(month, day, year);
  const personalDay = personalDayNumber(month, day, year);
  const quote = getQuoteOfDay();
  const formatDate = (d: Date) =>
    d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "America/Los_Angeles" });

  return (
    <>
      {fullscreen && (
        <FullscreenOverlay
          onExit={() => setFullscreen(false)}
          pendingApprovals={pendingApprovals}
          dailySpend={dailySpend}
          activeCrons={activeCrons}
          emergencyStop={emergencyStop}
          quote={quote}
          heatmapCells={patternsData?.heatmap ?? []}
        />
      )}

      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex h-12 shrink-0 items-center justify-between border-b px-5">
          <div className="flex items-center gap-2">
            <Tv className="h-4 w-4 text-muted-foreground" />
            <h1 className="text-sm font-medium">War Room</h1>
          </div>
          <button
            onClick={() => setFullscreen(true)}
            className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Maximize2 className="size-3.5" />
            Fullscreen
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Emergency banner */}
          {emergencyStop && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-center">
              <ShieldAlert className="size-4 inline-block mr-2 text-red-400" />
              <span className="text-sm font-medium text-red-400">
                EMERGENCY STOP ACTIVE — All operations halted
              </span>
            </div>
          )}

          {/* GG33 bar */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <Sparkles className="size-3.5 text-muted-foreground/60" />
            <span>{formatDate(now)}</span>
            <span className="text-muted-foreground/40">·</span>
            <span>Universal Day: <span className="font-mono text-foreground">{universalDay}</span></span>
            <span className="text-muted-foreground/40">·</span>
            <span>Personal Day: <span className="font-mono text-foreground">{personalDay}</span></span>
          </div>

          {/* The Council — largest section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="size-4 text-muted-foreground" />
                The Council
              </CardTitle>
              <CardDescription>
                {pendingApprovals.length === 0
                  ? "No pending approvals — the Council rests"
                  : `${pendingApprovals.length} pending approval${pendingApprovals.length > 1 ? "s" : ""}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pendingApprovals.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground/40">
                  <Shield className="size-8" />
                </div>
              ) : (
                <div className="space-y-2">
                  {pendingApprovals.map((a: any) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm text-muted-foreground">{a.action_type}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          a.risk_level === "critical" ? "bg-red-500/15 text-red-400" :
                          a.risk_level === "high" ? "bg-orange-500/15 text-orange-400" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          {a.risk_level}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(a.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Eisenhower Matrix compact */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Grid2x2 className="size-4 text-muted-foreground" />
                Eisenhower Matrix
              </CardTitle>
              <CardDescription>Issue prioritisation by quadrant</CardDescription>
            </CardHeader>
            <CardContent>
              <EisenhowerMiniGrid wsId={wsId} />
            </CardContent>
          </Card>

          {/* Agent status — 2 columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Gandalf */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wand2 className="size-4 text-muted-foreground" />
                  Gandalf
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full bg-green-500" />
                  <span className="text-sm">Active</span>
                </div>
                <p className="text-sm text-muted-foreground italic leading-relaxed">
                  &ldquo;{quote}&rdquo;
                </p>
              </CardContent>
            </Card>

            {/* Strider */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Swords className="size-4 text-muted-foreground" />
                  Strider
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  {PERSONAS.map((p) => (
                    <div key={p.name} className="flex items-center gap-1.5">
                      <span className={`size-2 rounded-full ${STATUS_DOT[p.status]}`} />
                      <span className="text-sm text-muted-foreground">{p.name}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Activity Heatmap */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="size-4 text-muted-foreground" />
                Hourly Activity
              </CardTitle>
              <CardDescription>Task distribution over the last 7 days</CardDescription>
            </CardHeader>
            <CardContent>
              <CompactHeatmap cells={patternsData?.heatmap ?? []} />
            </CardContent>
          </Card>

          {/* Vitals footer */}
          <div className="flex items-center gap-6 text-sm text-muted-foreground pb-2">
            <div className="flex items-center gap-1.5">
              <DollarSign className="size-3.5" />
              <span>Today: <span className="font-mono text-foreground">${dailySpend.toFixed(2)}</span></span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="size-3.5" />
              <span>Active crons: <span className="font-mono text-foreground">{activeCrons}</span></span>
            </div>
            <div className="flex items-center gap-1.5">
              <Shield className="size-3.5" />
              <span className={emergencyStop ? "text-red-400 font-medium" : ""}>
                {emergencyStop ? "STOPPED" : "Operational"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
