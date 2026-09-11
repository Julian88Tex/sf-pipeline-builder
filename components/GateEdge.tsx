"use client";

import { useEffect, useRef, useState } from "react";
import {
  BaseEdge,
  type Edge,
  EdgeLabelRenderer,
  type EdgeProps,
  getBezierPath,
  Position,
} from "@xyflow/react";
import { type Gate, addGate, removeGate } from "@/lib/gates";
import { GateBadge } from "./gates-ui";
import { GatePicker } from "./GatePicker";
import { ShieldIcon } from "./icons";

export interface GateEdgeData extends Record<string, unknown> {
  /** Gates guarding the promotion out of the source environment. */
  gates: Gate[];
  sourceId: string;
  sourceName: string;
  targetName: string;
  onChangeGates: (id: string, gates: Gate[]) => void;
}

export type GateEdgeType = Edge<GateEdgeData, "gate">;

/** A promotion arrow with its quality gates shown as badges near the source. */
export function GateEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  data,
}: EdgeProps<GateEdgeType>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const [path] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: 0.2,
  });

  // Badges sit just past the source card: above it for vertical arrows,
  // a little way along the arrow for horizontal ones.
  let x: number;
  let y: number;
  if (sourcePosition === Position.Top) {
    x = sourceX;
    y = sourceY - 52;
  } else {
    x = sourceX + 64;
    y = sourceY + (targetY - sourceY) * 0.08;
  }

  const gates = data?.gates ?? [];
  const change = (next: Gate[]) => data?.onChangeGates(data.sourceId, next);

  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} />
      <EdgeLabelRenderer>
        <div
          ref={ref}
          style={{
            transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`,
            pointerEvents: "all",
            zIndex: open ? 1000 : 10,
          }}
          className="nodrag nopan absolute"
        >
          {open ? (
            <div className="w-72 rounded-xl border border-slate-200 bg-white p-3.5 shadow-xl dark:border-zinc-600 dark:bg-zinc-800">
              <GatePicker
                title="Quality gates"
                subtitle={data ? `${data.sourceName} → ${data.targetName}` : undefined}
                gates={gates}
                onToggle={(gate, on) => change(on ? addGate(gates, gate) : removeGate(gates, gate))}
                onClose={() => setOpen(false)}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setOpen(true)}
              title="Quality gates for this promotion"
              aria-expanded={false}
              className={
                gates.length > 0
                  ? "flex flex-col items-center gap-1"
                  : "flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-300 opacity-40 transition hover:text-emerald-500 hover:opacity-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-600 dark:hover:text-emerald-400"
              }
            >
              {gates.length > 0 ? (
                gates.map((gate) => <GateBadge key={`${gate.kind}:${gate.label}`} gate={gate} />)
              ) : (
                <ShieldIcon size={14} />
              )}
            </button>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
