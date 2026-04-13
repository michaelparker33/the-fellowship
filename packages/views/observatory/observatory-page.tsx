"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWorkspaceId } from "@multica/core/hooks";
import {
  observatoryMemoryOptions,
  observatoryCorrectionsOptions,
  observatoryPatternsOptions,
  observatoryHealthOptions,
  observatoryProfilesOptions,
  observatorySessionsOptions,
} from "@multica/core/observatory/queries";
import { MemoryTab } from "./tabs/memory-tab";
import { CorrectionsTab } from "./tabs/corrections-tab";
import { PatternsTab } from "./tabs/patterns-tab";
import { HealthTab } from "./tabs/health-tab";
import { ProfilesTab } from "./tabs/profiles-tab";
import { SessionsTab } from "./tabs/sessions-tab";
import { Telescope } from "lucide-react";

const TABS = [
  { id: "memory", label: "Memory" },
  { id: "corrections", label: "Corrections" },
  { id: "patterns", label: "Patterns" },
  { id: "health", label: "Health" },
  { id: "profiles", label: "Profiles" },
  { id: "sessions", label: "Sessions" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function ObservatoryPage() {
  const wsId = useWorkspaceId();
  const [activeTab, setActiveTab] = useState<TabId>("memory");

  const memoryQuery = useQuery(observatoryMemoryOptions());
  const correctionsQuery = useQuery(observatoryCorrectionsOptions(wsId));
  const patternsQuery = useQuery(observatoryPatternsOptions(wsId));
  const healthQuery = useQuery(observatoryHealthOptions());
  const profilesQuery = useQuery(observatoryProfilesOptions(wsId));
  const sessionsQuery = useQuery(observatorySessionsOptions(wsId));

  return (
    <div className="flex flex-col h-full">
      {/* Header + tabs */}
      <div className="border-b px-5 shrink-0">
        <div className="flex h-12 items-center gap-2">
          <Telescope className="h-4 w-4 text-muted-foreground" />
          <h1 className="text-sm font-medium">Observatory</h1>
        </div>
        <div className="flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm rounded-t-md border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-primary text-foreground font-medium"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "memory" && <MemoryTab data={memoryQuery.data ?? null} isLoading={memoryQuery.isLoading} />}
        {activeTab === "corrections" && <CorrectionsTab data={correctionsQuery.data ?? null} isLoading={correctionsQuery.isLoading} />}
        {activeTab === "patterns" && <PatternsTab data={patternsQuery.data ?? null} isLoading={patternsQuery.isLoading} />}
        {activeTab === "health" && <HealthTab data={healthQuery.data ?? null} isLoading={healthQuery.isLoading} />}
        {activeTab === "profiles" && <ProfilesTab data={profilesQuery.data?.profiles ?? null} isLoading={profilesQuery.isLoading} />}
        {activeTab === "sessions" && <SessionsTab data={sessionsQuery.data ?? null} isLoading={sessionsQuery.isLoading} />}
      </div>
    </div>
  );
}
