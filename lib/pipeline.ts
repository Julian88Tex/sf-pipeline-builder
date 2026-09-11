import { type Gate, normalizeGates, PRESET_GATES, serializeGate } from "./gates";

export type { Gate, GateKind } from "./gates";

export type OrgType = "scratch" | "developer" | "developer-pro" | "partial-copy" | "full-copy" | "production";

export type Stage = "development" | "testing" | "production";

export type NodeKind = "dev" | "integration" | "stage" | "uat" | "production" | "hotfix";

export interface EnvNode {
  id: string;
  name: string;
  branch: string;
  orgType: OrgType;
  kind: NodeKind;
  stage: Stage;
  /** Gates that must pass before promoting *out of* this environment. */
  gates: Gate[];
  /** People, roles or teams allowed to deploy *into* this environment. */
  deployers: string[];
  layer: number;
  row: number;
}

export interface PipelineEdge {
  id: string;
  source: string;
  target: string;
}

export interface Pipeline {
  name: string;
  nodes: EnvNode[];
  edges: PipelineEdge[];
}

export const ORG_TYPES: { value: OrgType; label: string; accent: string }[] = [
  { value: "scratch", label: "Scratch Org", accent: "before:bg-teal-500" },
  { value: "developer", label: "Developer Sandbox", accent: "before:bg-sky-500" },
  { value: "developer-pro", label: "Developer Pro Sandbox", accent: "before:bg-indigo-500" },
  { value: "partial-copy", label: "Partial Copy Sandbox", accent: "before:bg-violet-500" },
  { value: "full-copy", label: "Full Copy Sandbox", accent: "before:bg-amber-500" },
  { value: "production", label: "Production Org", accent: "before:bg-rose-500" },
];

export const STAGES: { value: Stage; label: string }[] = [
  { value: "development", label: "Development" },
  { value: "testing", label: "Testing" },
  { value: "production", label: "Production" },
];

export const STAGE_ORDER: Stage[] = ["development", "testing", "production"];

export function orgTypeInfo(value: string) {
  return ORG_TYPES.find((t) => t.value === value) ?? ORG_TYPES[1];
}

export function stageLabel(stage: Stage): string {
  return STAGES.find((s) => s.value === stage)?.label ?? stage;
}

// Canvas layout. Cards sit on a grid of layers (columns) and rows.
export const NODE_W = 288;
export const NODE_H = 252;
export const COL_GAP = 430;
export const ROW_GAP = 300;

export function nodePosition(node: Pick<EnvNode, "layer" | "row">) {
  return { x: node.layer * COL_GAP, y: node.row * ROW_GAP };
}

let counter = 0;

export function newId(prefix = "n"): string {
  counter += 1;
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : String(counter);
  return `${prefix}_${rand}`;
}

/** Derive a git branch name from an environment name. */
export function branchFromName(name: string): string {
  return name.replace(/\s+/g, "").toLowerCase();
}

export function makeEdge(source: string, target: string): PipelineEdge {
  return { id: `${source}->${target}`, source, target };
}

const APEX_TESTS = PRESET_GATES[0];

export function defaultPipeline(): Pipeline {
  const devGates: Gate[] = [APEX_TESTS];
  const base = { orgType: "developer" as OrgType, deployers: [] as string[] };
  const dev1: EnvNode = {
    ...base,
    id: "dev1",
    name: "Dev1",
    branch: "dev1",
    kind: "dev",
    stage: "development",
    gates: devGates,
    layer: 0,
    row: -1,
  };
  const dev2: EnvNode = {
    ...base,
    id: "dev2",
    name: "Dev2",
    branch: "dev2",
    kind: "dev",
    stage: "development",
    gates: devGates,
    layer: 0,
    row: 0,
  };
  const dev3: EnvNode = {
    ...base,
    id: "dev3",
    name: "Dev3",
    branch: "dev3",
    kind: "dev",
    stage: "development",
    gates: devGates,
    layer: 0,
    row: 1,
  };
  const integration: EnvNode = {
    ...base,
    id: "integration",
    name: "Integration",
    branch: "integration",
    kind: "integration",
    stage: "testing",
    gates: [],
    layer: 1,
    row: 0,
  };
  const qa: EnvNode = {
    ...base,
    id: "qa",
    name: "QA",
    branch: "qa",
    kind: "stage",
    stage: "testing",
    gates: [],
    layer: 2,
    row: 0,
  };
  const staging: EnvNode = {
    ...base,
    id: "staging",
    name: "Staging",
    branch: "staging",
    kind: "stage",
    stage: "testing",
    gates: [],
    layer: 3,
    row: 0,
  };
  const uat: EnvNode = {
    ...base,
    id: "uat",
    name: "UAT",
    branch: "uat",
    orgType: "full-copy",
    kind: "uat",
    stage: "testing",
    gates: [],
    layer: 4,
    row: 0,
  };
  const prod: EnvNode = {
    ...base,
    id: "prod",
    name: "Production",
    branch: "main",
    orgType: "production",
    kind: "production",
    stage: "production",
    gates: [],
    layer: 5,
    row: 0,
  };
  const hotfix: EnvNode = {
    ...base,
    id: "hotfix",
    name: "Hotfix",
    branch: "hotfix",
    kind: "hotfix",
    stage: "testing",
    gates: devGates,
    layer: 4,
    row: 1,
  };

  return {
    name: "My Pipeline",
    nodes: [dev1, dev2, dev3, integration, qa, staging, uat, prod, hotfix],
    edges: [
      makeEdge(dev1.id, integration.id),
      makeEdge(dev2.id, integration.id),
      makeEdge(dev3.id, integration.id),
      makeEdge(integration.id, qa.id),
      makeEdge(qa.id, staging.id),
      makeEdge(staging.id, uat.id),
      makeEdge(uat.id, prod.id),
      makeEdge(hotfix.id, prod.id),
    ],
  };
}

/** Same default pipeline but with Copado-style `trn` environment names. */
export function defaultTrnPipeline(): Pipeline {
  const p = defaultPipeline();
  return {
    ...p,
    nodes: p.nodes.map((n) => {
      const compact = n.name.replace(/\s+/g, "");
      const name = compact.startsWith("trn") ? compact : `trn${compact}`;
      return { ...n, name, branch: n.kind === "production" ? n.branch : branchFromName(name) };
    }),
  };
}

/** First free row in a layer (below every existing card in that column). */
export function nextRow(nodes: EnvNode[], layer: number): number {
  const rows = nodes.filter((n) => n.layer === layer).map((n) => n.row);
  return rows.length === 0 ? 0 : Math.max(...rows) + 1;
}

/** Stages a card may be moved to: only the first/last card of a stage can cross into the neighbouring stage. */
export function stageMovesFor(pipeline: Pipeline, node: EnvNode): Stage[] {
  if (node.kind === "production") return [];
  const layers = pipeline.nodes.filter((n) => n.stage === node.stage).map((n) => n.layer);
  const idx = STAGE_ORDER.indexOf(node.stage);
  const moves: Stage[] = [];
  const prev = STAGE_ORDER[idx - 1];
  const next = STAGE_ORDER[idx + 1];
  if (prev && node.layer === Math.min(...layers)) moves.push(prev);
  if (next && node.layer === Math.max(...layers)) moves.push(next);
  return moves;
}

/** Renumber layers so they are 0..n with no gaps. */
export function compactLayers(nodes: EnvNode[]): EnvNode[] {
  const layers = [...new Set(nodes.map((n) => n.layer))].sort((a, b) => a - b);
  const remap = new Map(layers.map((layer, i) => [layer, i]));
  return layers.every((layer, i) => layer === i)
    ? nodes
    : nodes.map((n) => ({ ...n, layer: remap.get(n.layer)! }));
}

export function patchNode(pipeline: Pipeline, id: string, patch: Partial<EnvNode>): Pipeline {
  return {
    ...pipeline,
    nodes: pipeline.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
  };
}

export function moveNodeToStage(pipeline: Pipeline, id: string, stage: Stage): Pipeline {
  const node = pipeline.nodes.find((n) => n.id === id);
  if (!node || !stageMovesFor(pipeline, node).includes(stage)) return pipeline;
  const forward = STAGE_ORDER.indexOf(stage) > STAGE_ORDER.indexOf(node.stage);
  const layers = pipeline.nodes.filter((n) => n.stage === stage).map((n) => n.layer);
  const layer =
    layers.length > 0
      ? forward
        ? Math.min(...layers)
        : Math.max(...layers)
      : forward
        ? node.layer + 1
        : node.layer - 1;
  const others = pipeline.nodes.filter((n) => n.id !== id);
  const nodes = pipeline.nodes.map((n) =>
    n.id === id ? { ...n, stage, layer, row: nextRow(others, layer) } : n,
  );
  return { ...pipeline, nodes: compactLayers(nodes) };
}

function freshNode(stage: Stage, layer: number, row: number, prefix: string): EnvNode {
  return {
    id: newId(prefix),
    name: "NewEnv",
    branch: "newenv",
    orgType: "developer",
    kind: "stage",
    stage,
    gates: stage === "development" ? [APEX_TESTS] : [],
    deployers: [],
    layer,
    row,
  };
}

/** Insert a new environment that feeds into `id`. */
export function addBefore(pipeline: Pipeline, id: string): Pipeline {
  const node = pipeline.nodes.find((n) => n.id === id);
  if (!node) return pipeline;
  let nodes = pipeline.nodes;
  let layer = node.layer - 1;
  if (layer < Math.min(...pipeline.nodes.map((n) => n.layer))) {
    nodes = nodes.map((n) => ({ ...n, layer: n.layer + 1 }));
    layer = 0;
  }
  const stage: Stage = node.kind === "production" ? "testing" : node.stage;
  const created = freshNode(stage, layer, nextRow(nodes, layer), "env");
  return {
    ...pipeline,
    nodes: [...nodes, created],
    edges: [...pipeline.edges, makeEdge(created.id, id)],
  };
}

/** Insert a new environment between `id` and everything it currently promotes to. */
export function addAfter(pipeline: Pipeline, id: string): Pipeline {
  const node = pipeline.nodes.find((n) => n.id === id);
  if (!node || node.kind === "production") return pipeline;
  const layer = node.layer + 1;
  const nodes = pipeline.nodes.map((n) => (n.layer >= layer ? { ...n, layer: n.layer + 1 } : n));
  const stage: Stage = node.stage === "production" ? "testing" : node.stage;
  const created = freshNode(stage, layer, node.row, "stage");
  const edges: PipelineEdge[] = [];
  for (const e of pipeline.edges) {
    edges.push(e.source === id ? makeEdge(created.id, e.target) : e);
  }
  edges.push(makeEdge(id, created.id));
  return { ...pipeline, nodes: [...nodes, created], edges };
}

/** Duplicate an environment into the row below it, feeding the same targets. */
export function addNextTo(pipeline: Pipeline, id: string): Pipeline {
  const node = pipeline.nodes.find((n) => n.id === id);
  if (!node || node.kind === "production") return pipeline;
  const name = `${node.name.replace(/\s+/g, "")}2`;
  const created: EnvNode = {
    ...node,
    id: newId(node.kind),
    name,
    branch: branchFromName(name),
    gates: [...node.gates],
    deployers: [...node.deployers],
    row: nextRow(pipeline.nodes, node.layer),
  };
  const edges = pipeline.edges.filter((e) => e.source === id).map((e) => makeEdge(created.id, e.target));
  return { ...pipeline, nodes: [...pipeline.nodes, created], edges: [...pipeline.edges, ...edges] };
}

/** Remove an environment and reconnect its sources to its targets. */
export function deleteNode(pipeline: Pipeline, id: string): Pipeline {
  const node = pipeline.nodes.find((n) => n.id === id);
  if (!node || node.kind === "production") return pipeline;
  const sources = pipeline.edges.filter((e) => e.target === id).map((e) => e.source);
  const targets = pipeline.edges.filter((e) => e.source === id).map((e) => e.target);
  const bridged: PipelineEdge[] = [];
  for (const s of sources) for (const t of targets) if (s !== t) bridged.push(makeEdge(s, t));
  const seen = new Set<string>();
  const edges = pipeline.edges
    .filter((e) => e.source !== id && e.target !== id)
    .concat(bridged)
    .filter((e) => !seen.has(e.id) && (seen.add(e.id), true));
  return { ...pipeline, nodes: compactLayers(pipeline.nodes.filter((n) => n.id !== id)), edges };
}

/** Every distinct deployer named anywhere in the pipeline (for quick-add suggestions). */
export function allDeployers(pipeline: Pipeline): string[] {
  const seen = new Map<string, string>();
  for (const n of pipeline.nodes) {
    for (const d of n.deployers) {
      const key = d.toLowerCase();
      if (!seen.has(key)) seen.set(key, d);
    }
  }
  return [...seen.values()];
}

export function normalizeDeployers(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of input) {
    if (typeof item !== "string") continue;
    const value = item.trim().replace(/\s+/g, " ").slice(0, 60);
    const key = value.toLowerCase();
    if (!value || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

export function addDeployer(list: string[], name: string): string[] {
  const value = name.trim().replace(/\s+/g, " ").slice(0, 60);
  if (!value) return list;
  return list.some((d) => d.toLowerCase() === value.toLowerCase()) ? list : [...list, value];
}

export function removeDeployer(list: string[], name: string): string[] {
  return list.filter((d) => d.toLowerCase() !== name.toLowerCase());
}

// ---------------------------------------------------------------------------
// Serialization. Version 3 adds gate kinds and per-environment deployers;
// versions 1 and 2 are still readable so existing share links keep working.

const ORG_TYPE_VALUES = new Set<string>(ORG_TYPES.map((t) => t.value));
const NODE_KINDS = new Set<string>(["dev", "integration", "stage", "uat", "production", "hotfix"]);

type SerializedNodeV3 = [
  string, // id
  string, // name
  string, // branch
  OrgType,
  NodeKind,
  Stage,
  ReturnType<typeof serializeGate>[],
  number, // layer
  number, // row
  string[], // deployers
];

export function serializePipeline(pipeline: Pipeline): string {
  return JSON.stringify({
    v: 3,
    pn: pipeline.name,
    n: pipeline.nodes.map(
      (n): SerializedNodeV3 => [
        n.id,
        n.name,
        n.branch,
        n.orgType,
        n.kind,
        n.stage,
        n.gates.map(serializeGate),
        n.layer,
        n.row,
        n.deployers,
      ],
    ),
    e: pipeline.edges.map((e) => [e.source, e.target]),
  });
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function parsePipeline(text: string): Pipeline | null {
  try {
    const raw = JSON.parse(text) as { v?: unknown; pn?: unknown; n?: unknown; e?: unknown };
    const v = raw.v;
    if (![1, 2, 3].includes(v as number) || !Array.isArray(raw.n) || !Array.isArray(raw.e)) return null;
    const nodes: EnvNode[] = [];
    for (const entry of raw.n as unknown[]) {
      if (!Array.isArray(entry)) return null;
      let node: EnvNode;
      if (v === 1) {
        const [id, name, orgType, kind, stage, gates, layer, row] = entry;
        node = {
          id: asString(id),
          name: asString(name),
          branch: kind === "production" ? "main" : branchFromName(asString(name)),
          orgType: asString(orgType) as OrgType,
          kind: asString(kind) as NodeKind,
          stage: asString(stage) as Stage,
          gates: normalizeGates(gates),
          deployers: [],
          layer: asNumber(layer),
          row: asNumber(row),
        };
      } else {
        const [id, name, branch, orgType, kind, stage, gates, layer, row, deployers] = entry;
        node = {
          id: asString(id),
          name: asString(name),
          branch: asString(branch),
          orgType: asString(orgType) as OrgType,
          kind: asString(kind) as NodeKind,
          stage: asString(stage) as Stage,
          gates: normalizeGates(gates),
          deployers: v === 3 ? normalizeDeployers(deployers) : [],
          layer: asNumber(layer),
          row: asNumber(row),
        };
      }
      if (!node.id || !STAGE_ORDER.includes(node.stage)) return null;
      // Be lenient with values this app no longer knows, like the original was.
      if (!ORG_TYPE_VALUES.has(node.orgType)) node.orgType = "developer";
      if (!NODE_KINDS.has(node.kind)) node.kind = "stage";
      if (nodes.some((n) => n.id === node.id)) continue;
      if (!node.branch) node.branch = node.kind === "production" ? "main" : branchFromName(node.name);
      nodes.push(node);
    }
    if (nodes.length === 0) return null;
    const ids = new Set(nodes.map((n) => n.id));
    const seen = new Set<string>();
    const edges = (raw.e as unknown[])
      .filter((e): e is [string, string] => Array.isArray(e) && ids.has(e[0]) && ids.has(e[1]))
      .map(([s, t]) => makeEdge(s, t))
      .filter((e) => !seen.has(e.id) && (seen.add(e.id), true));
    return { name: asString(raw.pn) || "My Pipeline", nodes, edges };
  } catch {
    return null;
  }
}

/** Decode a legacy `#p=` share fragment (base64url of the serialized pipeline). */
export function decodeShareFragment(fragment: string): Pipeline | null {
  try {
    const b64 = fragment.replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    return parsePipeline(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}
