"use client";

import { useState } from "react";
import { ChevronDownIcon, HistoryIcon, LinkIcon, LockIcon, MoonIcon, SnapshotIcon, SunIcon } from "./icons";

export interface ShareMeta {
  masterId: string;
  writeKey: string;
  protected: boolean;
}

export interface RecentPipeline {
  id: string;
  key: string;
  name: string;
  at: string;
  p: boolean;
}

export function ThemeToggle({ dark, onToggle }: { dark: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      className="relative flex h-9 w-16 shrink-0 items-center rounded-full border border-slate-200 bg-slate-100 px-1 transition dark:border-zinc-700 dark:bg-zinc-800"
    >
      <span
        className={[
          "flex h-7 w-7 items-center justify-center rounded-full bg-white text-slate-600 shadow transition-transform dark:bg-zinc-600 dark:text-zinc-100",
          dark ? "translate-x-7" : "translate-x-0",
        ].join(" ")}
      >
        {dark ? <MoonIcon /> : <SunIcon />}
      </span>
    </button>
  );
}

export function NewMenu({ onNew, onNewTrn }: { onNew: () => void; onNewTrn: () => void }) {
  const [open, setOpen] = useState(false);
  const item =
    "block w-full px-4 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-zinc-200 dark:hover:bg-zinc-700";
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
      >
        New
        <ChevronDownIcon />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-10 z-50 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl dark:border-zinc-600 dark:bg-zinc-800">
            <button
              type="button"
              className={item}
              onClick={() => {
                setOpen(false);
                onNew();
              }}
            >
              New pipeline
            </button>
            <button
              type="button"
              className={item}
              onClick={() => {
                setOpen(false);
                onNewTrn();
              }}
            >
              New with <span className="font-mono text-xs font-bold">trn</span> names
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function SaveBadge({ dirty, saved }: { dirty: boolean; saved: boolean }) {
  const base = "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold";
  if (dirty) {
    return (
      <span
        title="You have changes that aren't saved to a link yet — use Save & Share"
        className={`${base} bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        Unsaved
      </span>
    );
  }
  if (saved) {
    return (
      <span
        title="All changes are saved to your live link"
        className={`${base} bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300`}
      >
        ✓ Saved
      </span>
    );
  }
  return (
    <span
      title="This pipeline only exists in this tab — Save & Share creates its links"
      className={`${base} bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400`}
    >
      Not saved
    </span>
  );
}

function relativeTime(iso: string): string {
  const seconds = (Date.now() - new Date(iso).getTime()) / 1000;
  if (!Number.isFinite(seconds) || seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function RecentsMenu({
  recents,
  activeId,
  onOpen,
}: {
  recents: RecentPipeline[];
  activeId?: string;
  onOpen: (recent: RecentPipeline) => void;
}) {
  const [open, setOpen] = useState(false);
  if (recents.length === 0) return null;
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Pipelines you've saved from this browser"
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
      >
        <HistoryIcon />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-10 z-50 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white py-1 shadow-xl dark:border-zinc-600 dark:bg-zinc-800">
            <div className="px-4 pb-1 pt-3 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
              Recent pipelines · this browser
            </div>
            {recents.map((recent) => (
              <button
                key={recent.id}
                type="button"
                onClick={() => {
                  setOpen(false);
                  onOpen(recent);
                }}
                className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition hover:bg-slate-100 dark:hover:bg-zinc-700"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-slate-800 dark:text-zinc-100">
                    {recent.name || "Untitled"}
                    {recent.id === activeId && (
                      <span className="ml-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        current
                      </span>
                    )}
                  </span>
                  <span className="block truncate font-mono text-[11px] text-slate-400 dark:text-zinc-500">
                    {recent.id}
                    {recent.p ? " · 🔒" : ""}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-slate-400 dark:text-zinc-500">
                  {relativeTime(recent.at)}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

type Pending = "live" | "version" | "pw" | null;

export function ShareMenu({
  meta,
  onSave,
  onSetPassword,
}: {
  meta: ShareMeta | null;
  onSave: () => Promise<{ masterId: string; versionId: string } | null>;
  onSetPassword: (password: string | null) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<Pending>(null);
  const [copied, setCopied] = useState<"live" | "version" | null>(null);
  const [password, setPassword] = useState("");

  const copyLink = async (kind: "live" | "version") => {
    if (pending) return;
    setPending(kind);
    const result = await onSave();
    setPending(null);
    if (!result) return;
    const id = kind === "live" ? result.masterId : result.versionId;
    const url = `${window.location.origin}${window.location.pathname}#s=${id}`;
    history.replaceState(null, "", `#s=${id}`);
    try {
      await navigator.clipboard.writeText(url);
    } catch {}
    setCopied(kind);
    setTimeout(() => setCopied(null), 2000);
  };

  const applyPassword = async (value: string | null) => {
    if (pending) return;
    setPending("pw");
    await onSetPassword(value);
    setPending(null);
    setPassword("");
  };

  const option =
    "flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 px-3.5 py-3 text-left transition hover:border-slate-300 hover:bg-slate-50 dark:border-zinc-700 dark:hover:border-zinc-500 dark:hover:bg-zinc-700/40";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 text-sm font-semibold text-white transition hover:bg-slate-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        <LinkIcon />
        Save &amp; Share
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-10 z-50 w-80 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl dark:border-zinc-600 dark:bg-zinc-800">
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => copyLink("live")}
                className={option}
                disabled={pending !== null}
              >
                <span>
                  <span className="block text-sm font-bold text-slate-800 dark:text-zinc-100">
                    {pending === "live" ? "Saving…" : copied === "live" ? "Link copied!" : "Copy live link"}
                  </span>
                  <span className="block text-xs text-slate-400 dark:text-zinc-400">
                    Always shows your latest saved version
                  </span>
                </span>
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="shrink-0 text-slate-400"
                >
                  <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => copyLink("version")}
                className={option}
                disabled={pending !== null}
              >
                <span>
                  <span className="block text-sm font-bold text-slate-800 dark:text-zinc-100">
                    {pending === "version"
                      ? "Saving…"
                      : copied === "version"
                        ? "Link copied!"
                        : "Copy version link"}
                  </span>
                  <span className="block text-xs text-slate-400 dark:text-zinc-400">
                    A snapshot of the pipeline right now
                  </span>
                </span>
                <SnapshotIcon className="shrink-0 text-slate-400" />
              </button>
              <div className="mt-1 border-t border-slate-100 pt-3 dark:border-zinc-700">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                  <LockIcon size={11} strokeWidth={2.5} />
                  Password
                </div>
                {meta?.protected ? (
                  <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-3.5 py-2.5 dark:bg-emerald-950/50">
                    <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                      Protected
                    </span>
                    <button
                      type="button"
                      onClick={() => applyPassword(null)}
                      disabled={pending !== null}
                      className="text-xs font-semibold text-rose-600 hover:underline dark:text-rose-400"
                    >
                      {pending === "pw" ? "…" : "Remove"}
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-1.5">
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) =>
                        e.key === "Enter" && password.trim() && applyPassword(password.trim())
                      }
                      placeholder="Set a password…"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                    />
                    {password.trim() && (
                      <button
                        type="button"
                        onClick={() => applyPassword(password.trim())}
                        disabled={pending !== null}
                        className="shrink-0 rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900"
                      >
                        {pending === "pw" ? "…" : "Set"}
                      </button>
                    )}
                  </div>
                )}
                <p className="mt-2 text-[11px] leading-snug text-slate-400 dark:text-zinc-500">
                  Anyone opening your links will need the password.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
