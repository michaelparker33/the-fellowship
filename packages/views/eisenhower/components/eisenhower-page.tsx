"use client";

import { useCallback } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Grid2x2 } from "lucide-react";
import { cn } from "@multica/ui/lib/utils";
import { Badge } from "@multica/ui/components/ui/badge";
import { useWorkspaceId } from "@multica/core/hooks";
import { useNavigation } from "../../navigation";
import { eisenhowerMatrixOptions, eisenhowerKeys } from "@multica/core/eisenhower";
import { useUpdateIssue } from "@multica/core/issues/mutations";
import { PriorityIcon } from "../../issues/components/priority-icon";
import { ActorAvatar } from "../../common/actor-avatar";
import type { EisenhowerItem, EisenhowerQuadrant, IssuePriority } from "@multica/core/types";

// ---------------------------------------------------------------------------
// Quadrant configuration
// ---------------------------------------------------------------------------

const QUADRANT_CONFIG: Record<
  EisenhowerQuadrant,
  { label: string; subtitle: string; emoji: string; accentClass: string; emptyText: string }
> = {
  do: {
    label: "Do First",
    subtitle: "Urgent & Important",
    emoji: "\uD83D\uDD34",
    accentClass: "bg-red-500",
    emptyText: "No urgent & important issues",
  },
  schedule: {
    label: "Schedule",
    subtitle: "Important, Not Urgent",
    emoji: "\uD83D\uDCC5",
    accentClass: "bg-blue-500",
    emptyText: "No scheduled issues",
  },
  delegate: {
    label: "Delegate",
    subtitle: "Urgent, Not Important",
    emoji: "\uD83E\uDD16",
    accentClass: "bg-yellow-500",
    emptyText: "No issues to delegate",
  },
  eliminate: {
    label: "Eliminate",
    subtitle: "Neither Urgent nor Important",
    emoji: "\uD83D\uDDD1\uFE0F",
    accentClass: "bg-muted-foreground/40",
    emptyText: "No issues to eliminate",
  },
};

const QUADRANT_ORDER: EisenhowerQuadrant[] = ["do", "schedule", "delegate", "eliminate"];

// ---------------------------------------------------------------------------
// Draggable issue card
// ---------------------------------------------------------------------------

function DraggableIssueCard({
  item,
  onNavigate,
}: {
  item: EisenhowerItem;
  onNavigate: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.id,
    data: { quadrant: item.eisenhower_quadrant },
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-lg border bg-card px-3 py-2.5 cursor-grab active:cursor-grabbing transition-shadow",
        "hover:shadow-sm hover:border-border/80",
        isDragging && "opacity-50 shadow-lg z-50",
      )}
      {...listeners}
      {...attributes}
    >
      <div
        className="flex items-center justify-between gap-2"
        onClick={(e) => {
          e.stopPropagation();
          onNavigate(item.id);
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter") onNavigate(item.id);
        }}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <PriorityIcon priority={item.priority as IssuePriority} />
          <span className="text-xs font-mono text-muted-foreground shrink-0">
            {item.identifier}
          </span>
          <span className="text-sm truncate">{item.title}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {item.assignee_id && (
            <ActorAvatar
              actorType={item.assignee_type ?? "member"}
              actorId={item.assignee_id}
              size={20}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Droppable quadrant
// ---------------------------------------------------------------------------

function DroppableQuadrant({
  quadrant,
  items,
  count,
  onNavigate,
}: {
  quadrant: EisenhowerQuadrant;
  items: EisenhowerItem[];
  count: number;
  onNavigate: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: quadrant });
  const cfg = QUADRANT_CONFIG[quadrant];

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col rounded-xl border bg-card/50 overflow-hidden transition-colors",
        isOver && "ring-2 ring-ring/40 bg-accent/30",
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b">
        <div className={cn("size-2.5 rounded-full shrink-0", cfg.accentClass)} />
        <span className="text-sm font-medium">
          {cfg.emoji} {cfg.label}
        </span>
        <span className="text-xs text-muted-foreground">{cfg.subtitle}</span>
        <Badge variant="secondary" className="ml-auto text-xs tabular-nums">
          {count}
        </Badge>
      </div>

      {/* Cards */}
      <div className="flex-1 p-2 space-y-1.5 overflow-y-auto min-h-[120px]">
        {items.length === 0 ? (
          <div className="flex items-center justify-center h-full py-8">
            <p className="text-sm text-muted-foreground/60">{cfg.emptyText}</p>
          </div>
        ) : (
          items.map((item) => (
            <DraggableIssueCard key={item.id} item={item} onNavigate={onNavigate} />
          ))
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function EisenhowerPage() {
  const wsId = useWorkspaceId();
  const { push } = useNavigation();
  const qc = useQueryClient();
  const updateIssue = useUpdateIssue();

  const { data } = useQuery(eisenhowerMatrixOptions(wsId));
  const items = data?.items ?? [];
  const counts = data?.counts ?? { do: 0, schedule: 0, delegate: 0, eliminate: 0 };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleNavigate = useCallback(
    (id: string) => push(`/issues/${id}`),
    [push],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over) return;

      const targetQuadrant = over.id as EisenhowerQuadrant;
      const sourceQuadrant = (active.data.current as { quadrant: string })?.quadrant;

      if (sourceQuadrant === targetQuadrant) return;

      const issueId = active.id as string;

      // Optimistic update
      qc.setQueryData(
        eisenhowerKeys.matrix(wsId),
        (old: typeof data) => {
          if (!old) return old;
          return {
            ...old,
            items: old.items.map((item) =>
              item.id === issueId
                ? { ...item, eisenhower_quadrant: targetQuadrant }
                : item,
            ),
            counts: {
              ...old.counts,
              [sourceQuadrant]: Math.max(0, (old.counts[sourceQuadrant as keyof typeof old.counts] ?? 0) - 1),
              [targetQuadrant]: (old.counts[targetQuadrant as keyof typeof old.counts] ?? 0) + 1,
            },
          };
        },
      );

      updateIssue.mutate(
        { id: issueId, eisenhower_quadrant: targetQuadrant },
        {
          onSettled: () => {
            qc.invalidateQueries({ queryKey: eisenhowerKeys.all(wsId) });
          },
        },
      );
    },
    [qc, wsId, data, updateIssue],
  );

  // Group items by quadrant
  const grouped: Record<EisenhowerQuadrant, EisenhowerItem[]> = {
    do: [],
    schedule: [],
    delegate: [],
    eliminate: [],
  };
  for (const item of items) {
    grouped[item.eisenhower_quadrant]?.push(item);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center border-b px-5">
        <div className="flex items-center gap-2">
          <Grid2x2 className="h-4 w-4 text-muted-foreground" />
          <h1 className="text-sm font-medium">Eisenhower Matrix</h1>
        </div>
      </div>

      {/* Matrix grid */}
      <div className="flex-1 overflow-hidden p-4">
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-2 grid-rows-2 gap-3 h-full">
            {QUADRANT_ORDER.map((q) => (
              <DroppableQuadrant
                key={q}
                quadrant={q}
                items={grouped[q]}
                count={counts[q]}
                onNavigate={handleNavigate}
              />
            ))}
          </div>
        </DndContext>
      </div>
    </div>
  );
}
