"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  type NodeMouseHandler,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { Gate } from "@/lib/gates";
import {
  COL_GAP,
  type EnvNode,
  NODE_H,
  NODE_W,
  type OrgType,
  type Pipeline,
  ROW_GAP,
  type Stage,
  addAfter,
  addBefore,
  addNextTo,
  allDeployers,
  branchFromName,
  decodeShareFragment,
  defaultPipeline,
  defaultTrnPipeline,
  deleteNode,
  moveNodeToStage,
  nodePosition,
  parsePipeline,
  patchNode,
  serializePipeline,
  stageLabel,
  stageMovesFor,
  STAGES,
} from "@/lib/pipeline";
import { FeatureRequests } from "./FeatureRequests";
import { GateEdge, type GateEdgeType } from "./GateEdge";
import {
  NewMenu,
  type RecentPipeline,
  RecentsMenu,
  SaveBadge,
  type ShareMeta,
  ShareMenu,
  ThemeToggle,
} from "./header";
import { CloudPipelineMark, LockIcon, RedoIcon, UndoIcon } from "./icons";
import {
  OrgNode,
  type OrgNodeActions,
  OrgNodeActionsContext,
  type OrgNodeData,
  type OrgNodeType,
} from "./OrgNode";
import { SelectionBar } from "./SelectionBar";
import { StageLanes } from "./StageLanes";

const WORKING_KEY = "sf-pipeline-builder:working";
const RECENTS_KEY = "sf-pipeline-builder:recents";
const LEGACY_SHARE_KEY = "sf-pipeline-builder:share";

const nodeTypes = { org: OrgNode };
const edgeTypes = { gate: GateEdge };

type Updater = (pipeline: Pipeline) => Pipeline;

// Dark mode lives on <html class="dark"> (set before hydration by the theme
// script in the layout); React reads it as an external store.
function subscribeToTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}
const isDark = () => document.documentElement.classList.contains("dark");
const isDarkOnServer = () => false;

function sameStrings(a: string[], b: string[]) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/**
 * True when two cards would render identically. React Flow only keeps a
 * node's measurements (and therefore its edges' anchor points) when it is
 * handed the very same node object again, so unchanged cards must be reused.
 */
function sameNodeData(a: OrgNodeData, b: OrgNodeData) {
  return (
    a.name === b.name &&
    a.branch === b.branch &&
    a.orgType === b.orgType &&
    a.kind === b.kind &&
    a.selected === b.selected &&
    sameStrings(a.deployers, b.deployers) &&
    sameStrings(a.deployerSuggestions, b.deployerSuggestions) &&
    a.stageMoves.length === b.stageMoves.length &&
    a.stageMoves.every((m, i) => m.stage === b.stageMoves[i].stage && m.label === b.stageMoves[i].label)
  );
}

// Flow node objects are cached by id and reused while the card's rendered
// data and position are unchanged (gate edits, for instance, only touch edges).
const flowNodeCache = new Map<string, OrgNodeType>();

function toFlowNode(env: EnvNode, data: OrgNodeData): OrgNodeType {
  const position = nodePosition(env);
  const cached = flowNodeCache.get(env.id);
  if (
    cached &&
    cached.position.x === position.x &&
    cached.position.y === position.y &&
    sameNodeData(cached.data, data)
  ) {
    return cached;
  }
  const node: OrgNodeType = {
    id: env.id,
    type: "org",
    width: NODE_W,
    height: NODE_H,
    // With `measured` present React Flow keeps the node's handle bounds when the
    // object is replaced, so edges (and their open gate editors) do not remount.
    measured: { width: NODE_W, height: NODE_H },
    position,
    data,
  };
  flowNodeCache.set(env.id, node);
  return node;
}

function readRecents(): RecentPipeline[] {
  try {
    const list = JSON.parse(localStorage.getItem(RECENTS_KEY) ?? "[]");
    return Array.isArray(list) ? list.filter((r) => r && r.id && r.key) : [];
  } catch {
    return [];
  }
}

/** Canvas rectangle that contains every card, never smaller than a comfortable viewport. */
function boundsOf(nodes: EnvNode[]) {
  const xs = nodes.map((n) => n.layer * COL_GAP);
  const ys = nodes.map((n) => n.row * ROW_GAP);
  let minX = Math.min(...xs);
  let maxX = Math.max(...xs) + NODE_W;
  let minY = Math.min(...ys) - 70;
  let maxY = Math.max(...ys) + NODE_H;
  if (maxX - minX < 1000) {
    const cx = (minX + maxX) / 2;
    minX = cx - 500;
    maxX = cx + 500;
  }
  if (maxY - minY < 700) {
    const cy = (minY + maxY) / 2;
    minY = cy - 350;
    maxY = cy + 350;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function Builder() {
  const [pipeline, setPipelineState] = useState<Pipeline>(() => defaultPipeline());
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const dark = useSyncExternalStore(subscribeToTheme, isDark, isDarkOnServer);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [share, setShare] = useState<ShareMeta | null>(null);
  const [dirty, setDirty] = useState(false);
  const [recents, setRecents] = useState<RecentPipeline[]>([]);
  const [lock, setLock] = useState<{ id: string; error: boolean } | null>(null);
  const [passwordInput, setPasswordInput] = useState("");

  const initialised = useRef(false);
  const undoStack = useRef<Pipeline[]>([]);
  const redoStack = useRef<Pipeline[]>([]);
  const lastEdit = useRef({ tag: "", at: 0 });
  const current = useRef(pipeline);
  const { fitBounds } = useReactFlow();

  const setPipeline = useCallback((next: Pipeline) => {
    current.current = next;
    setPipelineState(next);
  }, []);

  /** Apply an edit with undo support. Edits sharing a tag within 1.5s coalesce into one undo step. */
  const commit = useCallback(
    (update: Updater, tag = "") => {
      const before = current.current;
      const after = update(before);
      if (after === before) return;
      const now = Date.now();
      const coalesce = tag !== "" && tag === lastEdit.current.tag && now - lastEdit.current.at < 1500;
      if (!coalesce) {
        undoStack.current.push(before);
        if (undoStack.current.length > 50) undoStack.current.shift();
        setCanUndo(true);
        redoStack.current = [];
        setCanRedo(false);
      }
      lastEdit.current = { tag, at: now };
      setDirty(true);
      setPipeline(after);
    },
    [setPipeline],
  );

  const undo = useCallback(() => {
    const previous = undoStack.current.pop();
    if (!previous) return;
    redoStack.current.push(current.current);
    setCanRedo(true);
    setCanUndo(undoStack.current.length > 0);
    lastEdit.current = { tag: "", at: 0 };
    setDirty(true);
    setPipeline(previous);
  }, [setPipeline]);

  const redo = useCallback(() => {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push(current.current);
    setCanUndo(true);
    setCanRedo(redoStack.current.length > 0);
    lastEdit.current = { tag: "", at: 0 };
    setDirty(true);
    setPipeline(next);
  }, [setPipeline]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName ?? "";
      if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo]);

  const loadShared = useCallback(
    (id: string, password?: string) => {
      fetch(`/api/pipelines/${id}${password ? `?pw=${encodeURIComponent(password)}` : ""}`, {
        cache: "no-store",
      })
        .then(async (res) => {
          if (res.status === 401) {
            setLock({ id, error: !!password });
            return;
          }
          if (!res.ok) return;
          const parsed = parsePipeline(await res.text());
          if (parsed) {
            setPipeline(parsed);
            setDirty(false);
            setLock(null);
            setPasswordInput("");
          }
        })
        .catch(() => {});
    },
    [setPipeline],
  );

  // First load: migrate old share metadata, then open a shared link, a packed
  // link, or unsaved work from the last visit. Otherwise start fresh. This has
  // to run after hydration because it reads the URL hash and localStorage.
  /* eslint-disable react-hooks/set-state-in-effect -- mount-time session restore */
  useEffect(() => {
    if (initialised.current) return;
    initialised.current = true;

    let list = readRecents();
    try {
      const legacy = JSON.parse(localStorage.getItem(LEGACY_SHARE_KEY) ?? "null");
      if (legacy?.masterId && legacy?.writeKey && !list.some((r) => r.id === legacy.masterId)) {
        list = [
          {
            id: legacy.masterId,
            key: legacy.writeKey,
            name: "My Pipeline",
            at: new Date().toISOString(),
            p: !!legacy.protected,
          },
          ...list,
        ];
        localStorage.setItem(RECENTS_KEY, JSON.stringify(list));
      }
      localStorage.removeItem(LEGACY_SHARE_KEY);
    } catch {}
    setRecents(list);

    const metaFor = (id?: string | null): ShareMeta | null => {
      const recent = id ? list.find((r) => r.id === id) : undefined;
      return recent ? { masterId: recent.id, writeKey: recent.key, protected: !!recent.p } : null;
    };

    const shared = window.location.hash.match(/^#s=([a-z0-9-]+)$/i);
    if (shared) {
      setShare(metaFor(shared[1]));
      loadShared(shared[1]);
      return;
    }
    const packed = window.location.hash.match(/^#p=(.+)$/);
    if (packed) {
      const parsed = decodeShareFragment(packed[1]);
      if (parsed) {
        setPipeline(parsed);
        setDirty(true);
      }
      return;
    }
    try {
      const raw = localStorage.getItem(WORKING_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved && typeof saved === "object" && "d" in saved) {
        if (saved.dirty) {
          const parsed = parsePipeline(saved.d);
          if (parsed) {
            setPipeline(parsed);
            setDirty(true);
            setShare(metaFor(saved.master));
          }
        }
      } else if (saved && typeof saved === "object" && "v" in saved) {
        const parsed = parsePipeline(raw);
        if (parsed) {
          setPipeline(parsed);
          setDirty(true);
        }
      }
    } catch {}
  }, [loadShared, setPipeline]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Keep a working copy in this browser so unsaved edits survive a reload.
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(
          WORKING_KEY,
          JSON.stringify({
            d: serializePipeline(pipeline),
            dirty,
            master: share?.masterId ?? null,
          }),
        );
      } catch {}
    }, 400);
    return () => clearTimeout(timer);
  }, [pipeline, dirty, share]);

  const rememberRecent = useCallback((entry: RecentPipeline) => {
    setRecents((prev) => {
      const next = [entry, ...prev.filter((r) => r.id !== entry.id)].slice(0, 15);
      try {
        localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  /** Save to the server. Pass a password to set one, null to remove it, undefined to leave it alone. */
  const save = useCallback(
    async (password?: string | null) => {
      try {
        const res = await fetch("/api/pipelines", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            data: serializePipeline(current.current),
            masterId: share?.masterId,
            writeKey: share?.writeKey,
            ...(password !== undefined ? { password: password ?? "" } : {}),
          }),
        });
        if (!res.ok) return null;
        const body = (await res.json()) as {
          masterId: string;
          writeKey: string;
          versionId: string;
          protected: boolean;
        };
        setShare({
          masterId: body.masterId,
          writeKey: body.writeKey,
          protected: body.protected,
        });
        setDirty(false);
        rememberRecent({
          id: body.masterId,
          key: body.writeKey,
          name: current.current.name,
          at: new Date().toISOString(),
          p: body.protected,
        });
        return { masterId: body.masterId, versionId: body.versionId };
      } catch {
        return null;
      }
    },
    [share, rememberRecent],
  );

  const openRecent = useCallback(
    (recent: RecentPipeline) => {
      history.replaceState(null, "", `#s=${recent.id}`);
      setShare({
        masterId: recent.id,
        writeKey: recent.key,
        protected: !!recent.p,
      });
      setSelectedIds([]);
      loadShared(recent.id);
    },
    [loadShared],
  );

  const startNew = useCallback(
    (trn: boolean) => {
      setPipeline(trn ? defaultTrnPipeline() : defaultPipeline());
      setDirty(false);
      setShare(null);
      setSelectedIds([]);
      history.replaceState(null, "", window.location.pathname);
    },
    [setPipeline],
  );

  const setPassword = useCallback(async (password: string | null) => (await save(password)) !== null, [save]);

  const toggleDark = useCallback(() => {
    const next = !isDark();
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {}
  }, []);

  const fitAll = useCallback(
    (duration = 200) => fitBounds(boundsOf(pipeline.nodes), { padding: 0.12, duration }),
    [fitBounds, pipeline.nodes],
  );

  useEffect(() => {
    const timer = setTimeout(() => fitAll(), 50);
    return () => clearTimeout(timer);
  }, [pipeline.nodes.length, fitAll]);

  const canvasRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => fitAll(0), 100);
    });
    observer.observe(el);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [fitAll]);

  const selectedNodes = useMemo(
    () => pipeline.nodes.filter((n) => selectedIds.includes(n.id)),
    [pipeline.nodes, selectedIds],
  );
  // sameNodeData compares suggestions by content, so a fresh array per edit is fine.
  const deployerSuggestions = useMemo(() => allDeployers(pipeline), [pipeline]);

  const rename = useCallback(
    (id: string, name: string) =>
      commit(
        (p) => ({
          ...p,
          nodes: p.nodes.map((n) =>
            n.id === id
              ? {
                  ...n,
                  name,
                  branch: n.kind === "production" ? n.branch : branchFromName(name),
                }
              : n,
          ),
        }),
        `rename:${id}`,
      ),
    [commit],
  );
  const changeBranch = useCallback(
    (id: string, branch: string) =>
      commit((p) => patchNode(p, id, { branch: branch.replace(/\s+/g, "") }), `branch:${id}`),
    [commit],
  );
  const changeType = useCallback(
    (ids: string[], orgType: OrgType) =>
      commit((p) => ids.reduce((acc, id) => patchNode(acc, id, { orgType }), p), `type:${ids.join()}`),
    [commit],
  );
  const changeTypeOne = useCallback(
    (id: string, orgType: OrgType) => changeType([id], orgType),
    [changeType],
  );
  const setGatesMany = useCallback(
    (updates: { id: string; gates: Gate[] }[]) =>
      commit((p) => updates.reduce((acc, u) => patchNode(acc, u.id, { gates: u.gates }), p)),
    [commit],
  );
  const setGates = useCallback(
    (id: string, gates: Gate[]) => commit((p) => patchNode(p, id, { gates }), `gates:${id}`),
    [commit],
  );
  const setDeployersMany = useCallback(
    (updates: { id: string; deployers: string[] }[]) =>
      commit((p) => updates.reduce((acc, u) => patchNode(acc, u.id, { deployers: u.deployers }), p)),
    [commit],
  );
  const setDeployers = useCallback(
    (id: string, deployers: string[]) => commit((p) => patchNode(p, id, { deployers }), `deployers:${id}`),
    [commit],
  );
  const moveStage = useCallback(
    (id: string, stage: Stage) => commit((p) => moveNodeToStage(p, id, stage)),
    [commit],
  );
  const insertBefore = useCallback((id: string) => commit((p) => addBefore(p, id)), [commit]);
  const insertAfter = useCallback((id: string) => commit((p) => addAfter(p, id)), [commit]);
  const insertNextTo = useCallback((id: string) => commit((p) => addNextTo(p, id)), [commit]);
  const deleteMany = useCallback(
    (ids: string[]) => {
      commit((p) => ids.reduce((acc, id) => deleteNode(acc, id), p));
      setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
    },
    [commit],
  );
  const deleteOne = useCallback((id: string) => deleteMany([id]), [deleteMany]);

  const onNodeClick = useCallback<NodeMouseHandler<OrgNodeType>>((e, node) => {
    const multi = e.shiftKey || e.metaKey || e.ctrlKey;
    setSelectedIds((prev) =>
      multi ? (prev.includes(node.id) ? prev.filter((id) => id !== node.id) : [...prev, node.id]) : [node.id],
    );
  }, []);

  const nodeActions = useMemo<OrgNodeActions>(
    () => ({
      onRename: rename,
      onChangeBranch: changeBranch,
      onChangeType: changeTypeOne,
      onChangeDeployers: setDeployers,
      onAddBefore: insertBefore,
      onAddAfter: insertAfter,
      onAddNextTo: insertNextTo,
      onMoveStage: moveStage,
      onDelete: deleteOne,
    }),
    [
      rename,
      changeBranch,
      changeTypeOne,
      setDeployers,
      insertBefore,
      insertAfter,
      insertNextTo,
      moveStage,
      deleteOne,
    ],
  );

  const rfNodes = useMemo<OrgNodeType[]>(
    () =>
      pipeline.nodes.map((n) => {
        const data: OrgNodeData = {
          name: n.name,
          branch: n.branch,
          orgType: n.orgType,
          kind: n.kind,
          selected: selectedIds.includes(n.id),
          deployers: n.deployers,
          deployerSuggestions,
          stageMoves: stageMovesFor(pipeline, n).map((stage) => ({
            stage,
            label:
              STAGES.findIndex((s) => s.value === stage) > STAGES.findIndex((s) => s.value === n.stage)
                ? `Move to ${stageLabel(stage)} →`
                : `← Move to ${stageLabel(stage)}`,
          })),
        };
        return toFlowNode(n, data);
      }),
    [pipeline, selectedIds, deployerSuggestions],
  );

  const rfEdges = useMemo<GateEdgeType[]>(
    () =>
      pipeline.edges.map((e) => {
        const source = pipeline.nodes.find((n) => n.id === e.source);
        const target = pipeline.nodes.find((n) => n.id === e.target);
        const vertical = source && target && source.layer === target.layer;
        const color = dark ? "#71717a" : "#94a3b8";
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          ...(vertical ? { sourceHandle: "top", targetHandle: "bottom" } : {}),
          type: "gate",
          data: {
            gates: source?.gates ?? [],
            sourceId: e.source,
            sourceName: source?.name ?? "",
            targetName: target?.name ?? "",
            onChangeGates: setGates,
          },
          style: { stroke: color, strokeWidth: 2.5 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color,
            width: 16,
            height: 16,
          },
        };
      }),
    [pipeline.edges, pipeline.nodes, dark, setGates],
  );

  return (
    <div className="flex h-full w-full flex-col">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-200 bg-white px-4 py-3 sm:px-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-500">
            <CloudPipelineMark />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-zinc-500">
              Salesforce Pipeline Builder
            </div>
            <div className="flex items-center gap-2">
              <input
                value={pipeline.name}
                onChange={(e) => commit((p) => ({ ...p, name: e.target.value }), "pipeline-name")}
                title="Name your pipeline"
                className="-mx-1 w-44 rounded px-1 text-base font-bold leading-tight text-slate-900 outline-none transition hover:bg-slate-100 focus:bg-slate-100 sm:w-64 dark:text-zinc-100 dark:hover:bg-zinc-800 dark:focus:bg-zinc-800"
                spellCheck={false}
              />
              <SaveBadge dirty={dirty} saved={share !== null} />
            </div>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <RecentsMenu recents={recents} activeId={share?.masterId} onOpen={openRecent} />
          <ShareMenu meta={share} onSave={save} onSetPassword={setPassword} />
          <NewMenu onNew={() => startNew(false)} onNewTrn={() => startNew(true)} />
          <ThemeToggle dark={dark} onToggle={toggleDark} />
        </div>
      </header>

      <div ref={canvasRef} className="relative min-h-0 flex-1 bg-slate-50 dark:bg-zinc-950">
        <OrgNodeActionsContext.Provider value={nodeActions}>
          <ReactFlow<OrgNodeType, GateEdgeType>
            nodes={rfNodes}
            edges={rfEdges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            colorMode={dark ? "dark" : "light"}
            onNodeClick={onNodeClick}
            onPaneClick={() => setSelectedIds([])}
            onInit={() => fitAll(0)}
            minZoom={0.15}
            maxZoom={1.5}
            proOptions={{ hideAttribution: true }}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={20}
              size={1}
              color={dark ? "#3f3f46" : "#cbd5e1"}
            />
            <Controls showInteractive={false} showFitView position="top-right" />
            <StageLanes nodes={pipeline.nodes} />
          </ReactFlow>
        </OrgNodeActionsContext.Provider>

        <div className="absolute left-4 top-4 z-20 flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-800">
          <button
            type="button"
            onClick={undo}
            disabled={!canUndo}
            title="Undo (Cmd+Z)"
            className="flex h-9 w-10 items-center justify-center border-b border-slate-100 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            <UndoIcon />
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={!canRedo}
            title="Redo (Cmd+Shift+Z)"
            className="flex h-9 w-10 items-center justify-center text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            <RedoIcon />
          </button>
        </div>

        <FeatureRequests />

        <SelectionBar
          nodes={selectedNodes}
          deployerSuggestions={deployerSuggestions}
          onChangeType={changeType}
          onChangeGates={setGatesMany}
          onChangeDeployers={setDeployersMany}
          onDelete={deleteMany}
          onClose={() => setSelectedIds([])}
        />

        {lock && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-100 p-6 dark:bg-zinc-950">
            <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
              <div className="mb-1 flex items-center gap-2 text-base font-bold text-slate-800 dark:text-zinc-100">
                <LockIcon />
                This pipeline is protected
              </div>
              <p className="mb-4 text-sm text-slate-400 dark:text-zinc-400">Enter the password to view it.</p>
              <input
                type="password"
                autoFocus
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && passwordInput && loadShared(lock.id, passwordInput)}
                placeholder="Password"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
              {lock.error && (
                <p className="mt-2 text-xs font-semibold text-rose-500">Wrong password — try again.</p>
              )}
              <button
                type="button"
                onClick={() => passwordInput && loadShared(lock.id, passwordInput)}
                className="mt-4 w-full rounded-lg bg-slate-900 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
              >
                Unlock
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function PipelineBuilder() {
  return (
    <ReactFlowProvider>
      <Builder />
    </ReactFlowProvider>
  );
}
