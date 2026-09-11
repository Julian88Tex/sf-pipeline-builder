"use client";

import type { Gate, GateKind } from "@/lib/gates";
import { FlowIcon, PencilIcon, PullRequestIcon, ShieldIcon } from "./icons";

export type GateState = "all" | "some" | "none";

/** Colour system per gate kind: built-in = emerald, PR = violet, flow = sky, custom = amber. */
const KIND_STYLES: Record<GateKind, { on: string; some: string; badge: string }> = {
  test: {
    on: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    some: "border-emerald-200 bg-white text-emerald-600/70 dark:border-emerald-900 dark:bg-zinc-800 dark:text-emerald-400/70",
    badge:
      "border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-400 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  },
  pr: {
    on: "border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-700 dark:bg-violet-950 dark:text-violet-300",
    some: "border-violet-200 bg-white text-violet-600/70 dark:border-violet-900 dark:bg-zinc-800 dark:text-violet-400/70",
    badge:
      "border-violet-200 bg-violet-50 text-violet-700 hover:border-violet-400 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-300",
  },
  flow: {
    on: "border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-700 dark:bg-sky-950 dark:text-sky-300",
    some: "border-sky-200 bg-white text-sky-600/70 dark:border-sky-900 dark:bg-zinc-800 dark:text-sky-400/70",
    badge:
      "border-sky-200 bg-sky-50 text-sky-700 hover:border-sky-400 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-300",
  },
  custom: {
    on: "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300",
    some: "border-amber-200 bg-white text-amber-600/70 dark:border-amber-900 dark:bg-zinc-800 dark:text-amber-400/70",
    badge:
      "border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-400 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300",
  },
};

const OFF =
  "border-slate-200 bg-white text-slate-400 hover:border-slate-300 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-500";

export function gateChipClass(kind: GateKind, state: GateState): string {
  if (state === "all") return KIND_STYLES[kind].on;
  if (state === "some") return KIND_STYLES[kind].some;
  return OFF;
}

export function gateBadgeClass(kind: GateKind): string {
  return KIND_STYLES[kind].badge;
}

export function GateIcon({ kind, size }: { kind: GateKind; size?: number }) {
  // Only pass size when set so each icon keeps its own default.
  const props = size !== undefined ? { size } : {};
  switch (kind) {
    case "pr":
      return <PullRequestIcon {...props} />;
    case "flow":
      return <FlowIcon {...props} />;
    case "custom":
      return <PencilIcon {...props} />;
    default:
      return <ShieldIcon {...props} />;
  }
}

export const KIND_TITLE: Record<GateKind, string> = {
  test: "Built-in gate",
  pr: "Pull request gate",
  flow: "Flow gate",
  custom: "Custom gate",
};

/** Toggleable chip used inside the gate editors. */
export function GateChip({ gate, state, onClick }: { gate: Gate; state: GateState; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${KIND_TITLE[gate.kind]}${state === "some" ? " (on some of the selected environments)" : ""}`}
      className={[
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-bold transition",
        gateChipClass(gate.kind, state),
      ].join(" ")}
    >
      <GateIcon kind={gate.kind} size={12} />
      {state === "some" ? "− " : ""}
      {gate.label}
    </button>
  );
}

/** Read-only badge shown on a promotion arrow. */
export function GateBadge({ gate }: { gate: Gate }) {
  return (
    <span
      title={KIND_TITLE[gate.kind]}
      className={[
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-bold shadow-sm transition",
        gateBadgeClass(gate.kind),
      ].join(" ")}
    >
      <GateIcon kind={gate.kind} />
      {gate.label}
    </span>
  );
}
