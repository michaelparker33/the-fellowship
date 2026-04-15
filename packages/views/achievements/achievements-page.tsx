"use client";

import { useQuery } from "@tanstack/react-query";
import { achievementsOptions } from "@multica/core/achievements/queries";
import { Trophy } from "lucide-react";
import { useWorkspaceId } from "@multica/core/hooks";
import type { Achievement } from "@multica/core/types";

const ACHIEVEMENT_META: Record<string, { title: string; description: string; icon: string }> = {
  first_light: {
    title: "First Light",
    icon: "🌅",
    description: "Created the first issue in the workspace. The journey begins.",
  },
  council_convenes: {
    title: "The Council Convenes",
    icon: "🛡️",
    description: "The first approval request was raised. The Council has been called.",
  },
  rangers_first_report: {
    title: "Ranger's First Report",
    icon: "📜",
    description: "The Watch fired its first scheduled task. The rangers are on patrol.",
  },
  white_rider: {
    title: "The White Rider",
    icon: "⚡",
    description: "Emergency stop was activated. You shall not pass.",
  },
  not_all_who_wander: {
    title: "Not All Who Wander",
    icon: "🧭",
    description: "A wandering achievement, found by those who look.",
  },
  grey_pilgrim: {
    title: "The Grey Pilgrim",
    icon: "🧙",
    description: "The first agent task completed. Gandalf has begun his work.",
  },
  there_and_back_again: {
    title: "There and Back Again",
    icon: "🔄",
    description: "Emergency stop was lifted. The Fellowship marches on.",
  },
};

const ALL_KEYS = Object.keys(ACHIEVEMENT_META);

interface AchievementCardProps {
  achievement: Achievement | null;
  achievementKey: string;
}

function AchievementCard({ achievement, achievementKey }: AchievementCardProps) {
  const meta = ACHIEVEMENT_META[achievementKey] ?? {
    title: achievementKey,
    icon: "🏆",
    description: "",
  };
  const unlocked = achievement !== null;

  return (
    <div
      className={`relative rounded-lg border p-5 flex flex-col gap-3 transition-all ${
        unlocked
          ? "border-amber-500/40 bg-amber-950/10 shadow-[0_0_12px_rgba(245,158,11,0.1)]"
          : "border-border bg-secondary opacity-50 grayscale"
      }`}
    >
      <div className="text-4xl">{meta.icon}</div>
      <div>
        <h3 className={`font-semibold text-sm ${unlocked ? "text-foreground" : "text-muted-foreground"}`}>
          {meta.title}
        </h3>
        <p className="text-xs text-muted-foreground mt-1">{meta.description}</p>
      </div>
      {unlocked && achievement?.unlocked_at && (
        <p className="text-xs text-amber-500/70 mt-auto">
          {new Date(achievement.unlocked_at).toLocaleDateString()}
        </p>
      )}
      {!unlocked && (
        <p className="text-xs text-muted-foreground/50 mt-auto italic">Locked</p>
      )}
    </div>
  );
}

export function AchievementsPage() {
  const wsId = useWorkspaceId();
  const { data, isLoading } = useQuery(achievementsOptions(wsId));

  const unlockedMap = new Map<string, Achievement>(
    (data?.items ?? []).map((a) => [a.achievement_key, a]),
  );

  const unlockedCount = unlockedMap.size;
  const totalCount = ALL_KEYS.length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b px-5">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-muted-foreground" />
          <h1 className="text-sm font-medium">Achievements</h1>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="font-bold text-amber-500">{unlockedCount}</span>
          <span className="text-muted-foreground">/ {totalCount}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* Progress bar */}
        <div className="h-1 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-500 rounded-full transition-all duration-700"
            style={{ width: `${totalCount > 0 ? (unlockedCount / totalCount) * 100 : 0}%` }}
          />
        </div>
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {ALL_KEYS.map((k) => (
              <div key={k} className="rounded-lg border border-border bg-secondary h-36 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {ALL_KEYS.map((k) => (
              <AchievementCard
                key={k}
                achievementKey={k}
                achievement={unlockedMap.get(k) ?? null}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
