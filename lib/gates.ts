/**
 * Quality gates that guard a promotion out of an environment.
 *
 * A gate has a kind (what type of check it is) and a label (what the
 * user wrote in). Gates are compared by kind + case-insensitive label.
 */
export type GateKind = "test" | "pr" | "flow" | "custom";

export interface Gate {
  kind: GateKind;
  label: string;
}

export interface GateKindInfo {
  kind: GateKind;
  label: string;
  hint: string;
  placeholder: string;
}

/** Kinds a user can write a gate in for, in display order. */
export const WRITE_IN_KINDS: GateKindInfo[] = [
  {
    kind: "pr",
    label: "PR",
    hint: "Pull request rules: approvals, reviewers, required checks",
    placeholder: "e.g. 2 approvals from release managers",
  },
  {
    kind: "flow",
    label: "Flow",
    hint: "A Salesforce Flow that must complete before promotion",
    placeholder: "e.g. Deployment_Validation flow",
  },
  {
    kind: "custom",
    label: "Custom",
    hint: "Anything else your team requires",
    placeholder: "e.g. Security sign-off",
  },
];

export const KIND_LABEL: Record<GateKind, string> = {
  test: "Built-in",
  pr: "PR",
  flow: "Flow",
  custom: "Custom",
};

/** Gates offered as one-click toggles. */
export const PRESET_GATES: Gate[] = [
  { kind: "test", label: "Apex Tests" },
  { kind: "test", label: "PMD" },
  { kind: "pr", label: "PR Review" },
];

const KINDS: GateKind[] = ["test", "pr", "flow", "custom"];

export function isGateKind(value: unknown): value is GateKind {
  return typeof value === "string" && (KINDS as string[]).includes(value);
}

/** One normalisation for every label, whether typed in or loaded from a save. */
export function cleanLabel(text: string): string {
  return text.trim().replace(/\s+/g, " ").slice(0, 80);
}

function presetNamed(label: string): Gate | undefined {
  return PRESET_GATES.find((p) => p.label.toLowerCase() === label.toLowerCase());
}

export function gateKey(gate: Gate): string {
  return `${gate.kind}:${cleanLabel(gate.label).toLowerCase()}`;
}

export function sameGate(a: Gate, b: Gate): boolean {
  return gateKey(a) === gateKey(b);
}

export function hasGate(gates: Gate[], gate: Gate): boolean {
  return gates.some((g) => sameGate(g, gate));
}

export function addGate(gates: Gate[], gate: Gate): Gate[] {
  return hasGate(gates, gate) ? gates : [...gates, gate];
}

export function removeGate(gates: Gate[], gate: Gate): Gate[] {
  return gates.filter((g) => !sameGate(g, gate));
}

export function toggleGate(gates: Gate[], gate: Gate): Gate[] {
  return hasGate(gates, gate) ? removeGate(gates, gate) : addGate(gates, gate);
}

export function isPreset(gate: Gate): boolean {
  return hasGate(PRESET_GATES, gate);
}

/** Build a gate from text the user typed for a given kind. Returns null for blank input. */
export function gateFromText(kind: GateKind, text: string): Gate | null {
  const label = cleanLabel(text);
  if (!label) return null;
  // Typing a preset's name should resolve to that preset (and its kind).
  return presetNamed(label) ?? { kind, label };
}

/**
 * Normalise anything that may have been stored as a gate: a plain string
 * from a v1/v2 save, or a [kind, label] tuple / object from a v3 save.
 */
export function normalizeGate(input: unknown): Gate | null {
  if (typeof input === "string") {
    const label = cleanLabel(input);
    if (!label) return null;
    // Older saves stored built-in gates as plain strings.
    const preset = presetNamed(label);
    return preset && preset.kind === "test" ? preset : { kind: "custom", label };
  }
  let kind: unknown;
  let label: unknown;
  if (Array.isArray(input)) {
    [kind, label] = input;
  } else if (input && typeof input === "object") {
    const obj = input as { kind?: unknown; k?: unknown; label?: unknown; l?: unknown };
    kind = obj.kind ?? obj.k;
    label = obj.label ?? obj.l;
  }
  if (!isGateKind(kind) || typeof label !== "string") return null;
  const clean = cleanLabel(label);
  return clean ? { kind, label: clean } : null;
}

export function normalizeGates(input: unknown): Gate[] {
  if (!Array.isArray(input)) return [];
  const out: Gate[] = [];
  for (const item of input) {
    const gate = normalizeGate(item);
    if (gate && !hasGate(out, gate)) out.push(gate);
  }
  return out;
}

/** Compact tuple form used in serialized pipelines. */
export function serializeGate(gate: Gate): [GateKind, string] {
  return [gate.kind, gate.label];
}
