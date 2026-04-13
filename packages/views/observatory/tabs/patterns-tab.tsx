"use client";

import type { PatternsState, HeatmapCell } from "@multica/core/types";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function buildHeatmapGrid(cells: HeatmapCell[]): number[][] {
  const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const cell of cells) {
    if (cell.day_of_week >= 0 && cell.day_of_week < 7 && cell.hour_of_day >= 0 && cell.hour_of_day < 24) {
      grid[cell.day_of_week]![cell.hour_of_day] = cell.task_count;
    }
  }
  return grid;
}

function Heatmap({ cells }: { cells: HeatmapCell[] }) {
  const grid = buildHeatmapGrid(cells);
  const maxVal = Math.max(...cells.map((c) => c.task_count), 1);

  return (
    <div className="overflow-x-auto">
      <div className="inline-block min-w-full">
        <div className="flex gap-1">
          {/* Y-axis labels */}
          <div className="flex flex-col gap-1 shrink-0">
            <div className="h-5 w-8" />
            {DAYS.map((d) => (
              <div key={d} className="h-5 w-8 text-xs text-muted-foreground flex items-center">{d}</div>
            ))}
          </div>
          <div>
            {/* X-axis hours */}
            <div className="flex gap-1 mb-1">
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} className="w-5 h-5 text-xs text-muted-foreground text-center leading-5">
                  {h % 4 === 0 ? h : ""}
                </div>
              ))}
            </div>
            {/* Grid */}
            {grid.map((row, day) => (
              <div key={day} className="flex gap-1 mb-1">
                {row.map((count, hour) => {
                  const intensity = maxVal > 0 ? count / maxVal : 0;
                  const opacity = count === 0 ? 0.05 : 0.15 + intensity * 0.85;
                  return (
                    <div
                      key={hour}
                      title={`${DAYS[day]} ${hour}:00 — ${count} tasks`}
                      className="w-5 h-5 rounded-sm cursor-default"
                      style={{ background: `rgba(255, 255, 255, ${opacity})` }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

interface PatternsTabProps {
  data: PatternsState | null;
  isLoading: boolean;
}

export function PatternsTab({ data, isLoading }: PatternsTabProps) {
  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Analyzing patterns...</div>;
  }

  if (!data) {
    return <div className="p-6 text-sm text-muted-foreground">No pattern data available yet.</div>;
  }

  return (
    <div className="p-6 space-y-8">
      {/* Skill suggestions */}
      {data.skill_suggestions.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3 text-amber-400">
            ✨ Skill Candidates ({data.skill_suggestions.length})
          </h3>
          <div className="space-y-2">
            {data.skill_suggestions.map((s, i) => (
              <div key={i} className="flex items-center justify-between border border-amber-500/30 bg-amber-950/10 rounded-lg px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{s.title}</p>
                  <p className="text-xs text-muted-foreground">Repeated {s.occurrence_count}× — last seen {new Date(s.last_seen).toLocaleDateString()}</p>
                </div>
                <span className="text-xs bg-amber-900/50 text-amber-300 px-2 py-1 rounded-full shrink-0">
                  Auto-suggest skill
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Heatmap */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Hourly Activity Heatmap (last 7 days)</h3>
        {data.heatmap.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity data yet.</p>
        ) : (
          <Heatmap cells={data.heatmap} />
        )}
      </div>

      {/* Task clusters */}
      {data.task_clusters.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3">Task Clusters (last 30 days)</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {data.task_clusters.map((cluster, i) => (
              <div key={i} className="border border-border rounded-lg p-3">
                <div className="text-lg font-bold">{cluster.issue_count}</div>
                <div className="text-sm text-muted-foreground capitalize">{cluster.cluster_label}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {(cluster.task_rate * 100).toFixed(0)}% have tasks
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Repeated prompts */}
      {data.repeated_prompts.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3">Repeated Prompts</h3>
          <div className="space-y-1">
            {data.repeated_prompts.map((rp, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="flex items-center gap-2 min-w-0">
                  {rp.could_be_skill && <span className="text-amber-400 shrink-0">★</span>}
                  <span className="text-sm truncate">{rp.title}</span>
                </div>
                <span className="text-xs text-muted-foreground shrink-0 ml-2">×{rp.occurrence_count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
