"use client";

import { useState } from "react";
import {
  type Gate,
  type GateKind,
  gateFromText,
  gateKey,
  isPreset,
  PRESET_GATES,
  WRITE_IN_KINDS,
} from "@/lib/gates";
import { GateChip, GateIcon, type GateState } from "./gates-ui";
import { CloseIcon } from "./icons";

interface GatePickerProps {
  /** Gates currently applied. For a multi-selection pass the union. */
  gates: Gate[];
  /** Whether a gate is on every target ("all"), only some ("some") or none. Defaults to all/none from `gates`. */
  stateOf?: (gate: Gate) => GateState;
  onToggle: (gate: Gate, on: boolean) => void;
  title: string;
  subtitle?: string;
  onClose?: () => void;
}

/**
 * Editor for the quality gates on a promotion. Built-in gates toggle with a
 * click; PR, Flow and Custom gates are written in by the user.
 */
export function GatePicker({ gates, stateOf, onToggle, title, subtitle, onClose }: GatePickerProps) {
  const [kind, setKind] = useState<GateKind>("pr");
  const [text, setText] = useState("");

  const state = (gate: Gate): GateState =>
    stateOf ? stateOf(gate) : gates.some((g) => gateKey(g) === gateKey(gate)) ? "all" : "none";

  const toggle = (gate: Gate) => onToggle(gate, state(gate) !== "all");

  const add = () => {
    const gate = gateFromText(kind, text);
    if (!gate) return;
    onToggle(gate, true);
    setText("");
  };

  const writtenIn = gates.filter((g) => !isPreset(g));
  const kindInfo = WRITE_IN_KINDS.find((k) => k.kind === kind) ?? WRITE_IN_KINDS[0];

  return (
    <div className="text-left">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
            {title}
          </div>
          {subtitle && (
            <div className="truncate text-[11px] text-slate-400 dark:text-zinc-500">{subtitle}</div>
          )}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            title="Close"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-700"
          >
            <CloseIcon size={12} />
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {PRESET_GATES.map((gate) => (
          <GateChip key={gateKey(gate)} gate={gate} state={state(gate)} onClick={() => toggle(gate)} />
        ))}
        {writtenIn.map((gate) => (
          <GateChip key={gateKey(gate)} gate={gate} state={state(gate)} onClick={() => toggle(gate)} />
        ))}
      </div>

      <div className="mt-3 border-t border-slate-100 pt-2.5 dark:border-zinc-700">
        <div className="flex items-center gap-1" role="radiogroup" aria-label="Gate type">
          {WRITE_IN_KINDS.map((k) => (
            <button
              key={k.kind}
              type="button"
              role="radio"
              aria-checked={kind === k.kind}
              title={k.hint}
              onClick={() => setKind(k.kind)}
              className={[
                "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-bold transition",
                kind === k.kind
                  ? "bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-slate-500 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-700",
              ].join(" ")}
            >
              <GateIcon kind={k.kind} size={11} />
              {k.label}
            </button>
          ))}
        </div>
        <div className="mt-1.5 flex gap-1.5">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder={kindInfo.placeholder}
            aria-label={`Write in a ${kindInfo.label} gate`}
            aria-describedby="gate-kind-hint"
            maxLength={80}
            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 outline-none focus:border-slate-400 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200"
            spellCheck={false}
          />
          {text.trim() && (
            <button
              type="button"
              onClick={add}
              className="rounded-lg bg-slate-900 px-3 text-sm font-bold text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              Add
            </button>
          )}
        </div>
        <p id="gate-kind-hint" className="mt-1.5 text-[11px] leading-snug text-slate-500 dark:text-zinc-400">
          {kindInfo.hint}
        </p>
      </div>
    </div>
  );
}
