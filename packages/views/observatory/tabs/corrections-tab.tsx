"use client";

import type { CorrectionsState, Correction } from "@multica/core/types";

const SEVERITY_CONFIG = {
  critical: { color: "text-red-400 border-red-500/40 bg-red-950/10", badge: "bg-red-900/50 text-red-300" },
  major:    { color: "text-orange-400 border-orange-500/40 bg-orange-950/10", badge: "bg-orange-900/50 text-orange-300" },
  minor:    { color: "text-yellow-400 border-yellow-500/40 bg-yellow-950/10", badge: "bg-yellow-900/50 text-yellow-300" },
};

function CorrectionCard({ correction }: { correction: Correction }) {
  const cfg = SEVERITY_CONFIG[correction.severity];
  return (
    <div className={`border rounded-lg p-4 space-y-2 ${cfg.color}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.badge}`}>
              {correction.severity.toUpperCase()}
            </span>
            <span className="text-xs text-muted-foreground">{correction.action_type}</span>
            {correction.risk_level && (
              <span className="text-xs text-muted-foreground">risk: {correction.risk_level}</span>
            )}
          </div>
          {correction.issue_title && (
            <p className="text-sm font-medium text-foreground mt-1 truncate">{correction.issue_title}</p>
          )}
          {correction.agent_name && (
            <p className="text-xs text-muted-foreground">Agent: {correction.agent_name}</p>
          )}
        </div>
        {correction.decided_at && (
          <span className="text-xs text-muted-foreground shrink-0">
            {new Date(correction.decided_at).toLocaleDateString()}
          </span>
        )}
      </div>
      {correction.decision_note && (
        <p className="text-xs text-muted-foreground border-t border-current/20 pt-2">
          {correction.decision_note}
        </p>
      )}
    </div>
  );
}

interface CorrectionsTabProps {
  data: CorrectionsState | null;
  isLoading: boolean;
}

export function CorrectionsTab({ data, isLoading }: CorrectionsTabProps) {
  if (isLoading) {
    return (
      <div className="p-6 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="border rounded-lg h-20 animate-pulse bg-secondary" />
        ))}
      </div>
    );
  }

  if (!data || data.total === 0) {
    return (
      <div className="p-6 text-center text-muted-foreground text-sm">
        No rejected approvals found. The Council has been lenient.
      </div>
    );
  }

  const { critical = 0, major = 0, minor = 0 } = data.counts;

  return (
    <div className="p-6 space-y-5">
      {/* Summary row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Critical", count: critical, cls: "text-red-400" },
          { label: "Major", count: major, cls: "text-orange-400" },
          { label: "Minor", count: minor, cls: "text-yellow-400" },
        ].map(({ label, count, cls }) => (
          <div key={label} className="border border-border rounded-lg p-4 text-center">
            <div className={`text-3xl font-bold ${cls}`}>{count}</div>
            <div className="text-xs text-muted-foreground mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Correction list */}
      <div className="space-y-3">
        {["critical", "major", "minor"].map((sev) => {
          const items = data.corrections.filter((c) => c.severity === sev);
          if (items.length === 0) return null;
          return (
            <div key={sev}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                {sev} ({items.length})
              </h3>
              <div className="space-y-2">
                {items.map((c) => (
                  <CorrectionCard key={c.id} correction={c} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
