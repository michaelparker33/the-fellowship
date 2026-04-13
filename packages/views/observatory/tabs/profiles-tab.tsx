"use client";

import type { AgentProfile } from "@multica/core/types";

const STATUS_COLOR: Record<string, string> = {
  idle:    "text-green-400",
  working: "text-amber-400",
  blocked: "text-red-400",
  error:   "text-red-500",
  offline: "text-muted-foreground",
};

function ProfileCard({ profile }: { profile: AgentProfile }) {
  const statusColor = STATUS_COLOR[profile.status] ?? "text-muted-foreground";
  const successRate = profile.total_tasks > 0
    ? ((profile.completed_tasks / profile.total_tasks) * 100).toFixed(0)
    : null;

  return (
    <div className="border border-border rounded-lg p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold">{profile.name}</h3>
          <div className="flex items-center gap-1 mt-0.5">
            <span className={`text-xs font-medium ${statusColor}`}>● {profile.status}</span>
          </div>
        </div>
        {profile.model && (
          <span className="text-xs bg-muted px-2 py-1 rounded font-mono">{profile.model}</span>
        )}
      </div>

      {profile.provider && (
        <div className="text-xs text-muted-foreground">Provider: {profile.provider}</div>
      )}

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-2xl font-bold">{profile.total_tasks}</div>
          <div className="text-xs text-muted-foreground">Total tasks</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-green-400">{profile.completed_tasks}</div>
          <div className="text-xs text-muted-foreground">Completed</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-red-400">{profile.failed_tasks}</div>
          <div className="text-xs text-muted-foreground">Failed</div>
        </div>
        <div>
          <div className="text-2xl font-bold">{successRate ?? "—"}%</div>
          <div className="text-xs text-muted-foreground">Success rate</div>
        </div>
      </div>

      <div className="border-t border-border pt-3 space-y-1 text-xs text-muted-foreground">
        <div className="flex justify-between">
          <span>Total tokens</span>
          <span>{profile.total_tokens.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span>Total cost</span>
          <span>${profile.total_cost_usd.toFixed(4)}</span>
        </div>
        {profile.last_active && (
          <div className="flex justify-between">
            <span>Last active</span>
            <span>{new Date(profile.last_active).toLocaleDateString()}</span>
          </div>
        )}
      </div>
    </div>
  );
}

interface ProfilesTabProps {
  data: AgentProfile[] | null;
  isLoading: boolean;
}

export function ProfilesTab({ data, isLoading }: ProfilesTabProps) {
  if (isLoading) {
    return (
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2].map((i) => (
          <div key={i} className="border border-border rounded-lg h-64 animate-pulse bg-muted/20" />
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="p-6 text-center text-muted-foreground text-sm">
        No agents with activity found.
      </div>
    );
  }

  return (
    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
      {data.map((profile) => (
        <ProfileCard key={profile.id} profile={profile} />
      ))}
    </div>
  );
}
