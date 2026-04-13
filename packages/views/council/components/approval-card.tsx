"use client";

import { useState } from "react";
import type { Approval, DryRunResult } from "@multica/core/types";
import { Badge } from "@multica/ui/components/ui/badge";
import { Button } from "@multica/ui/components/ui/button";
import { Textarea } from "@multica/ui/components/ui/textarea";
import {
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Clock,
  Bot,
  Swords,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { cn } from "@multica/ui/lib/utils";
import { DebatePanel } from "./debate-panel";

const riskColors: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-yellow-500/15 text-yellow-500",
  high: "bg-orange-500/15 text-orange-500",
  critical: "bg-red-500/15 text-red-500",
};

function riskScoreColor(score: number): string {
  if (score <= 3) return "bg-green-500/15 text-green-500";
  if (score <= 6) return "bg-yellow-500/15 text-yellow-500";
  if (score <= 8) return "bg-orange-500/15 text-orange-500";
  return "bg-red-500/15 text-red-500";
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/15 text-yellow-500",
  approved: "bg-green-500/15 text-green-500",
  rejected: "bg-red-500/15 text-red-500",
  expired: "bg-muted text-muted-foreground",
};

function timeAgo(dateStr: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 1000,
  );
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface ApprovalCardProps {
  approval: Approval;
  onApprove: (id: string, note?: string) => void;
  onReject: (id: string, note?: string) => void;
  onDryRun?: (id: string) => void;
  dryRunLoading?: boolean;
  dryRunResult?: DryRunResult | null;
}

export function ApprovalCard({
  approval,
  onApprove,
  onReject,
  onDryRun,
  dryRunLoading,
  dryRunResult: externalDryRunResult,
}: ApprovalCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [noteMode, setNoteMode] = useState<"approve" | "reject" | null>(null);
  const [note, setNote] = useState("");
  const [showDryRun, setShowDryRun] = useState(false);

  const isPending = approval.status === "pending";

  // Use external result or the one stored on the approval
  const dryRunResult = externalDryRunResult ?? (approval.dry_run_result as DryRunResult | null);

  const handleSubmit = () => {
    if (noteMode === "approve") {
      onApprove(approval.id, note || undefined);
    } else if (noteMode === "reject") {
      onReject(approval.id, note || undefined);
    }
    setNoteMode(null);
    setNote("");
  };

  return (
    <div
      className={cn(
        "rounded-lg border p-4 transition-all",
        isPending && approval.risk_level === "critical" &&
          "border-red-500/50 shadow-[0_0_12px_rgba(239,68,68,0.15)]",
        isPending && approval.risk_level === "high" &&
          "border-orange-500/30",
        !isPending && "opacity-70",
      )}
    >
      <div className="flex items-start gap-3">
        {/* Agent icon */}
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-500/15">
          <Bot className="h-4 w-4 text-purple-400" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{approval.agent_id.slice(0, 8)}</span>
            <Badge
              variant="outline"
              className="font-mono text-xs px-1.5 py-0"
            >
              {approval.action_type}
            </Badge>
            <Badge className={cn("text-xs px-1.5 py-0", riskColors[approval.risk_level])}>
              {approval.risk_level}
            </Badge>
            <Badge className={cn("text-xs px-1.5 py-0 font-mono", riskScoreColor(approval.risk_score))}>
              {approval.risk_score}/10
            </Badge>
            {approval.contested_by && (
              <Badge className="bg-amber-500/15 text-amber-500 text-xs px-1.5 py-0">
                <Swords className="h-3 w-3 mr-1" />
                CONTESTED
              </Badge>
            )}
            {!isPending && (
              <Badge className={cn("text-xs px-1.5 py-0", statusColors[approval.status])}>
                {approval.status}
              </Badge>
            )}
            <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {timeAgo(approval.created_at)}
            </span>
          </div>

          {/* Autonomy level */}
          <p className="text-xs text-muted-foreground mt-1">
            Tier: {approval.autonomy_level}
          </p>

          {/* Decision info */}
          {approval.decided_at && (
            <p className="text-xs text-muted-foreground mt-1">
              {approval.status === "approved" ? "Approved" : "Rejected"}{" "}
              {timeAgo(approval.decided_at)}
              {approval.decision_note && ` — "${approval.decision_note}"`}
            </p>
          )}

          {/* Payload preview */}
          {approval.payload && Object.keys(approval.payload).length > 0 && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-2 transition-colors"
            >
              {expanded ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
              {expanded ? "Hide" : "Show"} payload
            </button>
          )}
          {expanded && (
            <pre className="mt-2 rounded-md bg-muted p-3 text-xs overflow-x-auto max-h-48">
              {JSON.stringify(approval.payload, null, 2)}
            </pre>
          )}

          {/* Debate panel */}
          {approval.debate_notes && approval.debate_notes.length > 0 && (
            <DebatePanel
              votes={approval.debate_notes}
              contested={approval.contested_by !== null}
            />
          )}

          {/* Dry run result panel */}
          {(showDryRun || dryRunResult) && dryRunResult && (
            <div className="mt-3 rounded-md border p-3 space-y-2">
              <div className="flex items-center gap-2">
                {dryRunResult.valid ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
                <span className="text-sm font-medium">
                  {dryRunResult.valid ? "Validation passed" : "Validation failed"}
                </span>
              </div>
              {dryRunResult.preview && (
                <p className="text-sm text-muted-foreground">{dryRunResult.preview}</p>
              )}
              {dryRunResult.affected_items.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Affected items:</p>
                  <ul className="text-xs text-muted-foreground space-y-0.5">
                    {dryRunResult.affected_items.map((item, i) => (
                      <li key={i} className="font-mono">{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {dryRunResult.warnings.length > 0 && (
                <div className="space-y-1">
                  {dryRunResult.warnings.map((w, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 mt-0.5 shrink-0" />
                      <span className="text-xs text-yellow-500">{w}</span>
                    </div>
                  ))}
                </div>
              )}
              {dryRunResult.errors.length > 0 && (
                <div className="space-y-1">
                  {dryRunResult.errors.map((e, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <XCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                      <span className="text-xs text-red-500">{e}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Note input */}
          {noteMode && (
            <div className="mt-3 flex flex-col gap-2">
              <Textarea
                placeholder={`Optional note for ${noteMode}...`}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className="text-sm"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSubmit}>
                  Confirm {noteMode}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setNoteMode(null);
                    setNote("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Action buttons */}
        {isPending && !noteMode && (
          <div className="flex gap-2 shrink-0">
            {onDryRun && (
              <Button
                size="sm"
                variant="outline"
                className="text-muted-foreground hover:bg-muted"
                onClick={() => {
                  setShowDryRun(true);
                  onDryRun(approval.id);
                }}
                disabled={dryRunLoading}
              >
                {dryRunLoading ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Search className="h-4 w-4 mr-1" />
                )}
                Dry Run
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="text-green-500 hover:bg-green-500/10 hover:text-green-400"
              onClick={() => setNoteMode("approve")}
            >
              <Check className="h-4 w-4 mr-1" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-red-500 hover:bg-red-500/10 hover:text-red-400"
              onClick={() => setNoteMode("reject")}
            >
              <X className="h-4 w-4 mr-1" />
              Reject
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
