"use client";

import { useState } from "react";
import { CloseIcon, UsersIcon } from "./icons";

export type DeployerState = "all" | "some";

interface DeployersEditorProps {
  /** Deployers currently assigned. For a multi-selection pass the union. */
  deployers: string[];
  /** Whether a deployer is on every selected environment or only some. Defaults to "all". */
  stateOf?: (name: string) => DeployerState;
  /** Names used elsewhere in the pipeline, offered as one-click adds. */
  suggestions: string[];
  onAdd: (name: string) => void;
  onRemove: (name: string) => void;
  title: string;
  subtitle?: string;
  onClose?: () => void;
}

/**
 * Editor for who is allowed to deploy into an environment: people, roles or
 * teams, written in as free text.
 */
export function DeployersEditor({
  deployers,
  stateOf,
  suggestions,
  onAdd,
  onRemove,
  title,
  subtitle,
  onClose,
}: DeployersEditorProps) {
  const [text, setText] = useState("");

  const add = () => {
    const value = text.trim();
    if (!value) return;
    onAdd(value);
    setText("");
  };

  const has = (name: string) => deployers.some((d) => d.toLowerCase() === name.toLowerCase());
  const quickAdds = suggestions.filter((s) => !has(s));

  return (
    <div className="text-left">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
            <UsersIcon size={12} />
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

      {deployers.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-zinc-400">
          No one is listed yet. Add the people, roles or teams who may deploy here.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {deployers.map((name) => {
            const partial = stateOf?.(name) === "some";
            return (
              <span
                key={name.toLowerCase()}
                title={partial ? "On some of the selected environments" : undefined}
                className={[
                  "inline-flex items-center gap-1 rounded-full border py-1 pl-3 pr-1.5 text-sm font-semibold",
                  partial
                    ? "border-indigo-200 bg-white text-indigo-600/70 dark:border-indigo-900 dark:bg-zinc-800 dark:text-indigo-400/70"
                    : "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-300",
                ].join(" ")}
              >
                {partial ? "− " : ""}
                {name}
                <button
                  type="button"
                  onClick={() => onRemove(name)}
                  title={`Remove ${name}`}
                  className="flex h-5 w-5 items-center justify-center rounded-full text-indigo-400 transition hover:bg-indigo-100 hover:text-indigo-700 dark:hover:bg-indigo-900 dark:hover:text-indigo-200"
                >
                  <CloseIcon size={10} />
                </button>
              </span>
            );
          })}
        </div>
      )}

      <div className="mt-2.5 flex gap-1.5">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Person, role or team…"
          aria-label="Add someone who can deploy"
          maxLength={60}
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

      {quickAdds.length > 0 && (
        <div className="mt-2.5">
          <div className="mb-1 text-[11px] font-semibold text-slate-400 dark:text-zinc-500">
            Also in this pipeline
          </div>
          <div className="flex flex-wrap gap-1">
            {quickAdds.map((name) => (
              <button
                key={name.toLowerCase()}
                type="button"
                onClick={() => onAdd(name)}
                className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-500 transition hover:border-indigo-300 hover:text-indigo-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:border-indigo-700 dark:hover:text-indigo-300"
              >
                + {name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
