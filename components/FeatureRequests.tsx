"use client";

import { useCallback, useState } from "react";
import { BulbIcon, CloseIcon } from "./icons";

interface FeatureRequest {
  text: string;
  createdAt: string;
}

/** Floating "suggest a feature" button and its request list. */
export function FeatureRequests() {
  const [open, setOpen] = useState(false);
  const [requests, setRequests] = useState<FeatureRequest[] | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/requests");
      setRequests(res.ok ? await res.json() : []);
    } catch {
      setRequests([]);
    }
  }, []);

  const show = () => {
    setOpen(true);
    if (requests === null) load();
  };

  const send = async () => {
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: value }),
      });
      if (res.ok) {
        const created = (await res.json()) as FeatureRequest;
        setRequests((current) => [created, ...(current ?? [])]);
        setText("");
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={show}
        title="Suggest a feature"
        className="absolute bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-amber-400 text-amber-950 shadow-lg transition hover:scale-105 hover:bg-amber-300 active:scale-95"
      >
        <BulbIcon />
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6"
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[80dvh] w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl dark:bg-zinc-900"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-zinc-800">
              <h2 className="text-base font-bold text-slate-800 dark:text-zinc-100">Feature requests</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
              >
                <CloseIcon size={14} />
              </button>
            </div>
            <div className="flex gap-2 px-5 pt-4">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="What should this app do next?"
                maxLength={500}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-zinc-500"
              />
              <button
                type="button"
                onClick={send}
                disabled={!text.trim() || sending}
                className="shrink-0 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
              >
                {sending ? "…" : "Send"}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {requests === null ? (
                <p className="py-6 text-center text-sm text-slate-400">Loading…</p>
              ) : requests.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">
                  No requests yet — add the first one!
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {requests.map((request, i) => (
                    <li
                      key={`${request.createdAt}-${i}`}
                      className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-800/50"
                    >
                      <p className="text-sm text-slate-700 dark:text-zinc-200">{request.text}</p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        {new Date(request.createdAt).toLocaleDateString()}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
