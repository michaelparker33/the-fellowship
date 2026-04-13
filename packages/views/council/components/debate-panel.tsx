"use client";

import type { DebateVote } from "@multica/core/types";
import { Badge } from "@multica/ui/components/ui/badge";
import { Bot, ThumbsUp, ThumbsDown } from "lucide-react";
import { cn } from "@multica/ui/lib/utils";

interface DebatePanelProps {
  votes: DebateVote[];
  contested: boolean;
}

export function DebatePanel({ votes, contested }: DebatePanelProps) {
  if (votes.length === 0) return null;

  const approveVotes = votes.filter((v) => v.verdict === "approve");
  const rejectVotes = votes.filter((v) => v.verdict === "reject");

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          Council Debate
        </span>
        {contested && (
          <Badge className="bg-amber-500/15 text-amber-500 text-xs px-1.5 py-0">
            CONTESTED
          </Badge>
        )}
        <span className="text-xs text-muted-foreground ml-auto">
          {approveVotes.length} approve / {rejectVotes.length} reject
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {votes.map((vote, i) => (
          <div
            key={`${vote.agent_id}-${i}`}
            className={cn(
              "rounded-md border p-3 text-xs",
              vote.verdict === "approve"
                ? "border-green-500/30 bg-green-500/5"
                : "border-red-500/30 bg-red-500/5",
            )}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-500/15">
                <Bot className="h-3 w-3 text-purple-400" />
              </div>
              <span className="font-medium">{vote.agent_name}</span>
              {vote.verdict === "approve" ? (
                <Badge className="bg-green-500/15 text-green-500 text-xs px-1.5 py-0 ml-auto">
                  <ThumbsUp className="h-3 w-3 mr-1" />
                  Approve
                </Badge>
              ) : (
                <Badge className="bg-red-500/15 text-red-500 text-xs px-1.5 py-0 ml-auto">
                  <ThumbsDown className="h-3 w-3 mr-1" />
                  Reject
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground leading-relaxed pl-7">
              {vote.reasoning}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
