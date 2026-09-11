"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Handle, type Node, type NodeProps, Position } from "@xyflow/react";
import {
  type NodeKind,
  type OrgType,
  ORG_TYPES,
  orgTypeInfo,
  type Stage,
  addDeployer,
  removeDeployer,
} from "@/lib/pipeline";
import { DeployersEditor } from "./DeployersEditor";
import { BranchIcon, PlusIcon, UsersIcon } from "./icons";

/** Plain, comparable data for one card. Callbacks come from OrgNodeActionsContext. */
export interface OrgNodeData extends Record<string, unknown> {
  name: string;
  branch: string;
  orgType: OrgType;
  kind: NodeKind;
  selected: boolean;
  /** Who may deploy into this environment. */
  deployers: string[];
  /** Deployers named elsewhere in the pipeline, offered as quick adds. */
  deployerSuggestions: string[];
  stageMoves: { stage: Stage; label: string }[];
}

export type OrgNodeType = Node<OrgNodeData, "org">;

export interface OrgNodeActions {
  onRename: (id: string, name: string) => void;
  onChangeBranch: (id: string, branch: string) => void;
  onChangeType: (id: string, orgType: OrgType) => void;
  onChangeDeployers: (id: string, deployers: string[]) => void;
  onAddBefore: (id: string) => void;
  onAddAfter: (id: string) => void;
  onAddNextTo: (id: string) => void;
  onMoveStage: (id: string, stage: Stage) => void;
  onDelete: (id: string) => void;
}

/** Provided by PipelineBuilder around the React Flow canvas. */
export const OrgNodeActionsContext = createContext<OrgNodeActions | null>(null);

function useOrgNodeActions(): OrgNodeActions {
  const actions = useContext(OrgNodeActionsContext);
  if (!actions) throw new Error("OrgNode must be rendered inside OrgNodeActionsContext");
  return actions;
}

/** Handles exist only so edges have anchors; they are invisible. */
const HIDDEN_HANDLE = "!h-1 !w-1 !min-h-0 !min-w-0 !border-0 !bg-transparent !pointer-events-none";

const MENU_ITEM =
  "block w-full px-5 py-3.5 text-left text-lg font-medium text-slate-700 transition hover:bg-slate-100 dark:text-zinc-200 dark:hover:bg-zinc-700";

function useOutsideClose(open: boolean, ref: React.RefObject<HTMLElement | null>, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as globalThis.Node)) close();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, ref, close]);
}

/** An environment card: name, org type, who can deploy to it, and its git branch. */
export function OrgNode({ id, data, selected }: NodeProps<OrgNodeType>) {
  const actions = useOrgNodeActions();
  const type = orgTypeInfo(data.orgType);
  const isSelected = selected || data.selected;
  const isProduction = data.kind === "production";

  const [menuOpen, setMenuOpen] = useState(false);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const peopleRef = useRef<HTMLDivElement>(null);

  useOutsideClose(menuOpen, cardRef, () => setMenuOpen(false));
  useOutsideClose(peopleOpen, peopleRef, () => setPeopleOpen(false));

  const pick = (action: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    action();
  };

  return (
    <div
      ref={cardRef}
      onMouseLeave={() => setMenuOpen(false)}
      data-popover={menuOpen || peopleOpen ? "open" : undefined}
      className={[
        "group relative w-72 rounded-2xl border bg-white shadow-sm transition-all dark:bg-zinc-800 before:absolute before:left-0 before:top-0 before:h-full before:w-2 before:rounded-l-2xl",
        type.accent,
        isSelected
          ? "border-slate-900 shadow-lg ring-2 ring-slate-900/10 dark:border-zinc-100 dark:ring-white/20"
          : "border-slate-200 hover:border-slate-300 hover:shadow-md dark:border-zinc-700 dark:hover:border-zinc-500",
      ].join(" ")}
    >
      <Handle type="target" position={Position.Left} className={HIDDEN_HANDLE} />
      <Handle type="source" position={Position.Right} className={HIDDEN_HANDLE} />
      <Handle id="top" type="source" position={Position.Top} className={HIDDEN_HANDLE} />
      <Handle id="bottom" type="target" position={Position.Bottom} className={HIDDEN_HANDLE} />

      <div className="flex min-h-[252px] flex-col px-5 py-5 pl-6">
        <div className="flex items-start gap-2">
          <input
            value={data.name}
            onChange={(e) => actions.onRename(id, e.target.value)}
            className="nodrag nopan w-full rounded-lg border border-transparent bg-transparent text-xl font-bold text-slate-800 outline-none hover:border-slate-200 focus:border-slate-300 focus:bg-slate-50 dark:text-zinc-100 dark:hover:border-zinc-600 dark:focus:border-zinc-500 dark:focus:bg-zinc-700/50"
            spellCheck={false}
          />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((open) => !open);
            }}
            title="Environment actions"
            aria-expanded={menuOpen}
            className="nodrag mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-500 dark:hover:bg-zinc-600 dark:hover:text-zinc-100"
          >
            <PlusIcon size={18} />
          </button>
        </div>

        <div className="mt-3">
          <select
            value={data.orgType}
            onChange={(e) => actions.onChangeType(id, e.target.value as OrgType)}
            className="nodrag nopan w-full cursor-pointer rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-base font-medium text-slate-600 outline-none transition hover:bg-slate-100 focus:border-slate-300 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600 dark:focus:border-zinc-400"
          >
            {ORG_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div ref={peopleRef} className="relative mt-3">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setPeopleOpen((open) => !open);
            }}
            title="Who can deploy to this environment"
            aria-expanded={peopleOpen}
            className={[
              "nodrag nopan flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition",
              data.deployers.length > 0
                ? "border-indigo-200 bg-indigo-50/70 text-indigo-700 hover:border-indigo-300 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:border-indigo-700"
                : "border-dashed border-slate-300 text-slate-500 hover:border-slate-400 hover:text-slate-700 dark:border-zinc-600 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-200",
            ].join(" ")}
          >
            <UsersIcon size={15} className="shrink-0" />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">
              {data.deployers.length > 0 ? data.deployers.join(", ") : "Who can deploy here?"}
            </span>
          </button>
          {peopleOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="nodrag nopan absolute left-0 right-0 top-full z-30 mt-1.5 rounded-xl border border-slate-200 bg-white p-3.5 shadow-xl dark:border-zinc-600 dark:bg-zinc-800"
            >
              <DeployersEditor
                title="Can deploy here"
                subtitle={data.name}
                deployers={data.deployers}
                suggestions={data.deployerSuggestions}
                onAdd={(name) => actions.onChangeDeployers(id, addDeployer(data.deployers, name))}
                onRemove={(name) => actions.onChangeDeployers(id, removeDeployer(data.deployers, name))}
                onClose={() => setPeopleOpen(false)}
              />
            </div>
          )}
        </div>

        <div className="mt-auto flex justify-end pt-4">
          <label className="nodrag nopan flex cursor-text items-center gap-2 rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-slate-600 transition focus-within:border-slate-400 hover:border-slate-300 dark:border-zinc-600 dark:bg-zinc-700/70 dark:text-zinc-300 dark:focus-within:border-zinc-400">
            <BranchIcon size={15} className="shrink-0" />
            <input
              value={data.branch}
              onChange={(e) => actions.onChangeBranch(id, e.target.value)}
              title="Git branch"
              style={{ width: `${Math.max(3, data.branch.length) + 1}ch` }}
              className="bg-transparent font-mono text-base font-semibold outline-none"
              spellCheck={false}
            />
          </label>
        </div>
      </div>

      {menuOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="nodrag absolute right-3 top-16 z-30 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white py-1 shadow-xl dark:border-zinc-600 dark:bg-zinc-800"
        >
          <button type="button" className={MENU_ITEM} onClick={pick(() => actions.onAddBefore(id))}>
            ← Add before
          </button>
          {!isProduction && (
            <button type="button" className={MENU_ITEM} onClick={pick(() => actions.onAddAfter(id))}>
              → Add after
            </button>
          )}
          {!isProduction && (
            <button type="button" className={MENU_ITEM} onClick={pick(() => actions.onAddNextTo(id))}>
              ↓ Add next to
            </button>
          )}
          {data.stageMoves.length > 0 && (
            <div className="my-1 border-t border-slate-100 dark:border-zinc-700" />
          )}
          {data.stageMoves.map((move) => (
            <button
              key={move.stage}
              type="button"
              className={MENU_ITEM}
              onClick={pick(() => actions.onMoveStage(id, move.stage))}
            >
              {move.label}
            </button>
          ))}
          {!isProduction && (
            <>
              <div className="my-1 border-t border-slate-100 dark:border-zinc-700" />
              <button
                type="button"
                className="block w-full px-5 py-3.5 text-left text-lg font-semibold text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/50"
                onClick={pick(() => actions.onDelete(id))}
              >
                Delete
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
