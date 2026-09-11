"use client";

import { ViewportPortal } from "@xyflow/react";
import { COL_GAP, type EnvNode, NODE_H, NODE_W, ROW_GAP, STAGES } from "@/lib/pipeline";

/** Shaded lanes behind the cards, one per stage that has environments. */
export function StageLanes({ nodes }: { nodes: EnvNode[] }) {
  const ys = nodes.map((n) => n.row * ROW_GAP);
  const top = Math.min(...ys) - 70;
  const bottom = Math.max(...ys) + NODE_H + 60;

  const lanes = STAGES.map((stage) => {
    const layers = nodes.filter((n) => n.stage === stage.value).map((n) => n.layer);
    if (layers.length === 0) return null;
    const x = Math.min(...layers) * COL_GAP - 44;
    const width = Math.max(...layers) * COL_GAP + NODE_W + 44 - x;
    return { ...stage, x, width };
  }).filter((lane) => lane !== null);

  return (
    <ViewportPortal>
      {lanes.map((lane) => (
        <div
          key={lane.value}
          className="rounded-3xl border-2 border-slate-300/80 bg-slate-200/50 dark:border-zinc-700 dark:bg-zinc-900/70"
          style={{
            position: "absolute",
            left: lane.x,
            top,
            width: lane.width,
            height: bottom - top,
            zIndex: -1,
            pointerEvents: "none",
          }}
        >
          <div className="pt-4 text-center text-base font-bold uppercase tracking-[0.25em] text-slate-500 dark:text-zinc-500">
            {lane.label}
          </div>
        </div>
      ))}
    </ViewportPortal>
  );
}
