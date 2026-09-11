"use client";

import { useState } from "react";
import { type Gate, addGate, hasGate, removeGate } from "@/lib/gates";
import { type EnvNode, type OrgType, ORG_TYPES, addDeployer, removeDeployer } from "@/lib/pipeline";
import { DeployersEditor } from "./DeployersEditor";
import { GatePicker } from "./GatePicker";
import { CloseIcon, ShieldIcon, UsersIcon } from "./icons";

interface SelectionBarProps {
  nodes: EnvNode[];
  deployerSuggestions: string[];
  onChangeType: (ids: string[], orgType: OrgType) => void;
  onChangeGates: (updates: { id: string; gates: Gate[] }[]) => void;
  onChangeDeployers: (updates: { id: string; deployers: string[] }[]) => void;
  onDelete: (ids: string[]) => void;
  onClose: () => void;
}

type Panel = "gates" | "deployers" | null;

/** Floating toolbar for editing several selected environments at once. */
export function SelectionBar({
  nodes,
  deployerSuggestions,
  onChangeType,
  onChangeGates,
  onChangeDeployers,
  onDelete,
  onClose,
}: SelectionBarProps) {
  const [panel, setPanel] = useState<Panel>(null);

  if (nodes.length < 2) return null;

  const ids = nodes.map((n) => n.id);
  const allProduction = nodes.every((n) => n.kind === "production");
  const sharedType = nodes.every((n) => n.orgType === nodes[0].orgType) ? nodes[0].orgType : undefined;

  // Gates: union across the selection, with per-gate all/some state.
  const gateUnion: Gate[] = [];
  for (const n of nodes) for (const g of n.gates) if (!hasGate(gateUnion, g)) gateUnion.push(g);
  const gateState = (gate: Gate) =>
    nodes.every((n) => hasGate(n.gates, gate))
      ? "all"
      : nodes.some((n) => hasGate(n.gates, gate))
        ? "some"
        : "none";
  const toggleGate = (gate: Gate, on: boolean) =>
    onChangeGates(
      nodes.map((n) => ({ id: n.id, gates: on ? addGate(n.gates, gate) : removeGate(n.gates, gate) })),
    );

  // Deployers: union across the selection, with per-name all/some state.
  const deployerUnion: string[] = [];
  for (const n of nodes) {
    for (const d of n.deployers) {
      if (!deployerUnion.some((x) => x.toLowerCase() === d.toLowerCase())) deployerUnion.push(d);
    }
  }
  const hasDeployer = (n: EnvNode, name: string) =>
    n.deployers.some((d) => d.toLowerCase() === name.toLowerCase());
  const deployerState = (name: string) => (nodes.every((n) => hasDeployer(n, name)) ? "all" : "some");

  const toggle = (next: Panel) => setPanel((current) => (current === next ? null : next));

  const panelButton = (active: boolean) =>
    [
      "flex h-8 w-8 items-center justify-center rounded-full border transition",
      active
        ? "border-emerald-300 bg-emerald-50 text-emerald-600 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
        : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-300",
    ].join(" ");

  return (
    <div className="absolute bottom-6 left-1/2 z-30 -translate-x-1/2">
      {panel === "gates" && (
        <div className="absolute bottom-full left-1/2 mb-2 w-72 -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-3 shadow-xl dark:border-zinc-600 dark:bg-zinc-800">
          <GatePicker
            title="Quality gates"
            subtitle={`${nodes.length} environments`}
            gates={gateUnion}
            stateOf={gateState}
            onToggle={toggleGate}
          />
        </div>
      )}
      {panel === "deployers" && (
        <div className="absolute bottom-full left-1/2 mb-2 w-72 -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-3 shadow-xl dark:border-zinc-600 dark:bg-zinc-800">
          <DeployersEditor
            title="Can deploy here"
            subtitle={`${nodes.length} environments`}
            deployers={deployerUnion}
            stateOf={deployerState}
            suggestions={deployerSuggestions}
            onAdd={(name) =>
              onChangeDeployers(nodes.map((n) => ({ id: n.id, deployers: addDeployer(n.deployers, name) })))
            }
            onRemove={(name) =>
              onChangeDeployers(
                nodes.map((n) => ({ id: n.id, deployers: removeDeployer(n.deployers, name) })),
              )
            }
          />
        </div>
      )}

      <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1.5 pl-4 pr-2 shadow-xl dark:border-zinc-700 dark:bg-zinc-800">
        <span className="whitespace-nowrap text-sm font-bold text-slate-700 dark:text-zinc-200">
          {nodes.length} selected
        </span>
        <select
          value={sharedType ?? ""}
          onChange={(e) => onChangeType(ids, e.target.value as OrgType)}
          className="cursor-pointer rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-600 outline-none dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
        >
          {sharedType === undefined && (
            <option value="" disabled>
              Mixed types
            </option>
          )}
          {ORG_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => toggle("gates")}
          title="Quality gates"
          aria-expanded={panel === "gates"}
          className={panelButton(panel === "gates")}
        >
          <ShieldIcon size={14} strokeWidth={2} />
        </button>
        <button
          type="button"
          onClick={() => toggle("deployers")}
          title="Who can deploy"
          aria-expanded={panel === "deployers"}
          className={panelButton(panel === "deployers")}
        >
          <UsersIcon size={15} />
        </button>
        {!allProduction && (
          <button
            type="button"
            onClick={() => onDelete(ids)}
            className="rounded-full px-3 py-1.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/50"
          >
            Delete
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          title="Clear selection"
          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
        >
          <CloseIcon size={13} />
        </button>
      </div>
    </div>
  );
}
