"use client";

import type { MemoryState, MemoryProfile } from "@multica/core/types";

const CATEGORY_COLORS: Record<string, string> = {
  correction: "text-red-400",
  preference: "text-blue-400",
  todo: "text-yellow-400",
  project: "text-green-400",
  environment: "text-purple-400",
  other: "text-muted-foreground",
};

function CapacityBar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = Math.min(100, max > 0 ? (value / max) * 100 : 0);
  const color = pct > 80 ? "bg-red-500" : pct > 60 ? "bg-yellow-500" : "bg-green-500";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span>{value.toLocaleString()} / {max.toLocaleString()} chars ({pct.toFixed(0)}%)</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ProfileCard({ profile }: { profile: MemoryProfile }) {
  const catCounts = profile.entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="border border-border rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm capitalize">{profile.name}</h3>
        <span className="text-xs text-muted-foreground">{profile.entries.length} entries</span>
      </div>
      <CapacityBar value={profile.total_chars} max={profile.max_chars} label="Memory capacity" />
      <div className="flex flex-wrap gap-2">
        {Object.entries(catCounts).map(([cat, count]) => (
          <span key={cat} className={`text-xs px-2 py-0.5 rounded-full bg-muted ${CATEGORY_COLORS[cat] ?? ""}`}>
            {cat}: {count}
          </span>
        ))}
      </div>
      {profile.entries.length > 0 && (
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {profile.entries.map((entry, i) => (
            <div key={i} className="text-xs text-muted-foreground flex gap-2">
              <span className={`shrink-0 w-2 h-2 rounded-full mt-1 ${CATEGORY_COLORS[entry.category] ?? "bg-muted"}`} />
              <span className="truncate">{entry.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface MemoryTabProps {
  data: MemoryState | null;
  isLoading: boolean;
}

export function MemoryTab({ data, isLoading }: MemoryTabProps) {
  if (isLoading) {
    return (
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2].map((i) => (
          <div key={i} className="border border-border rounded-lg h-48 animate-pulse bg-muted/20" />
        ))}
      </div>
    );
  }

  if (!data || !data.profiles || data.profiles.length === 0) {
    return (
      <div className="p-6 text-center text-muted-foreground text-sm">
        <p>No memory files found in <code>~/.hermes/memories/</code></p>
        <p className="mt-1 text-xs">Memory files will appear here when Hermes profiles are active.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <p className="text-xs text-muted-foreground">
        Palantír memory capacity — last read {new Date(data.read_at).toLocaleTimeString()}
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data.profiles.map((p) => (
          <ProfileCard key={p.name} profile={p} />
        ))}
      </div>
    </div>
  );
}
