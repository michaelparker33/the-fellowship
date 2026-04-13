"use client";

import type { HealthState } from "@multica/core/types";

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${ok ? "bg-green-500" : "bg-red-500"}`} />
  );
}

interface HealthTabProps {
  data: HealthState | null;
  isLoading: boolean;
}

export function HealthTab({ data, isLoading }: HealthTabProps) {
  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground animate-pulse">Checking system health...</div>;
  }

  if (!data) {
    return <div className="p-6 text-sm text-muted-foreground">Health data unavailable.</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <p className="text-xs text-muted-foreground">
        Auto-refreshes every 30s — last checked {new Date(data.read_at).toLocaleTimeString()}
      </p>

      {/* API Keys */}
      <section>
        <h3 className="text-sm font-semibold mb-3">API Keys</h3>
        <div className="space-y-2">
          {data.api_keys.map((key) => (
            <div key={key.name} className="flex items-center justify-between border border-border rounded-lg px-4 py-2.5">
              <div className="flex items-center gap-2">
                <StatusDot ok={key.present} />
                <span className="text-sm font-mono">{key.name}</span>
              </div>
              <span className={`text-xs ${key.present ? "text-green-400" : "text-red-400"}`}>
                {key.present ? "✓ Present" : "✗ Missing"}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Services */}
      <section>
        <h3 className="text-sm font-semibold mb-3">Services</h3>
        <div className="space-y-2">
          {data.services.map((svc) => (
            <div key={svc.name} className="flex items-center justify-between border border-border rounded-lg px-4 py-2.5">
              <div className="flex items-center gap-2">
                <StatusDot ok={svc.running} />
                <span className="text-sm capitalize">{svc.name}</span>
                {svc.pid ? <span className="text-xs text-muted-foreground">PID {svc.pid}</span> : null}
              </div>
              <span className={`text-xs ${svc.running ? "text-green-400" : "text-muted-foreground"}`}>
                {svc.running ? "Running" : "Not detected"}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Disk */}
      {data.disk && (
        <section>
          <h3 className="text-sm font-semibold mb-3">Disk</h3>
          <div className="border border-border rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Used</span>
              <span>{data.disk.used_gb.toFixed(1)} GB / {data.disk.total_gb.toFixed(1)} GB ({data.disk.used_percent.toFixed(0)}%)</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${data.disk.used_percent > 85 ? "bg-red-500" : data.disk.used_percent > 70 ? "bg-yellow-500" : "bg-green-500"}`}
                style={{ width: `${data.disk.used_percent}%` }}
              />
            </div>
            <div className="text-xs text-muted-foreground">{data.disk.free_gb.toFixed(1)} GB free</div>
          </div>
        </section>
      )}

      {/* Memory / runtime */}
      <section>
        <h3 className="text-sm font-semibold mb-3">Runtime</h3>
        <div className="border border-border rounded-lg p-4 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Go</span>
            <span className="font-mono text-xs">{data.go_version}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">OS</span>
            <span className="font-mono text-xs">{data.os}</span>
          </div>
          {Object.entries(data.memory_mb ?? {}).map(([k, v]) => (
            <div key={k} className="flex justify-between">
              <span className="text-muted-foreground">{k}</span>
              <span className="font-mono text-xs">{v} MB</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
