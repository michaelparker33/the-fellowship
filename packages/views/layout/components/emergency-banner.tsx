"use client";

import { useQuery } from "@tanstack/react-query";
import { safetyConfigOptions } from "@multica/core/safety/queries";
import { useWorkspaceId } from "@multica/core/hooks";
import { ShieldAlert } from "lucide-react";

export function EmergencyBanner() {
  const wsId = useWorkspaceId();
  const { data } = useQuery(safetyConfigOptions(wsId));

  if (!data?.emergency_stop) return null;

  return (
    <div className="flex items-center justify-center gap-2 bg-red-900/90 border-b border-red-700 px-4 py-2 text-sm text-red-100 shrink-0">
      <ShieldAlert className="h-4 w-4 text-red-400 shrink-0" />
      <span className="font-semibold">Emergency Stop Active</span>
      <span className="text-red-300">— All agent tasks are halted. Resume in Settings → Safety.</span>
    </div>
  );
}
