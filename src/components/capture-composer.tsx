"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Mic } from "lucide-react";

type Created = {
  id: string;
  title: string;
  board: "CURRENT" | "BACKLOG" | "ICEBOX";
};

type CaptureResponse = {
  ok?: boolean;
  error?: string;
  captureId?: string;
  tasks?: Created[];
  counts?: { CURRENT: number; BACKLOG: number; ICEBOX: number };
  rawFallback?: boolean;
};

type SpeechRec = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((ev: {
    resultIndex: number;
    results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
  }) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function getRecognizer(): (new () => SpeechRec) | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRec;
    webkitSpeechRecognition?: new () => SpeechRec;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

const LANE_LABEL = { CURRENT: "Current", BACKLOG: "Backlog", ICEBOX: "Icebox" } as const;

export function CaptureComposer({
  onCreated,
}: {
  onCreated: (ids: string[]) => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [micNote, setMicNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    captureId: string;
    tasks: Created[];
    counts: { CURRENT: number; BACKLOG: number; ICEBOX: number };
    rawFallback: boolean;
  } | null>(null);
  const [supported, setSupported] = useState<boolean | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const recRef = useRef<SpeechRec | null>(null);
  const baseText = useRef("");
  const silence = useRef<number | null>(null);
  const startedAt = useRef(0);

  useEffect(() => {
    setSupported(Boolean(getRecognizer()));
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (e.key === "c" && !e.metaKey && !e.ctrlKey && !e.altKey && !typing) {
        e.preventDefault();
        box.current?.focus();
      }
      if (e.key === "Escape" && document.activeElement === box.current) {
        if (text.trim() && !window.confirm("Discard this capture?")) return;
        setText("");
        setError(null);
        box.current?.blur();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [text]);

  useEffect(() => {
    if (!listening) return;
    const id = window.setInterval(() => {
      setSeconds(Math.floor((Date.now() - startedAt.current) / 1000));
      if (Date.now() - startedAt.current > 120_000) stopMic();
    }, 250);
    return () => window.clearInterval(id);
  }, [listening]);

  function stopMic() {
    if (silence.current) window.clearTimeout(silence.current);
    silence.current = null;
    try {
      recRef.current?.stop();
    } catch {
      /* already stopped */
    }
    setListening(false);
  }

  function startMic() {
    const Ctor = getRecognizer();
    if (!Ctor) {
      setSupported(false);
      return;
    }
    setError(null);
    setMicNote(null);
    baseText.current = text.trim();
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.onresult = (ev) => {
      let finalText = "";
      let interim = "";
      for (let i = 0; i < ev.results.length; i++) {
        const piece = ev.results[i]?.[0]?.transcript ?? "";
        if (ev.results[i]?.isFinal) finalText += piece;
        else interim += piece;
      }
      const spoken = `${finalText} ${interim}`.replace(/\s+/g, " ").trim();
      setText([baseText.current, spoken].filter(Boolean).join(baseText.current ? " " : ""));
      if (silence.current) window.clearTimeout(silence.current);
      silence.current = window.setTimeout(() => stopMic(), 2000);
    };
    rec.onerror = (ev) => {
      if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
        setMicNote("Microphone permission denied. You can still type.");
      } else if (ev.error !== "aborted" && ev.error !== "no-speech") {
        setMicNote("Voice didn't start. You can still type.");
      }
      setListening(false);
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    try {
      rec.start();
      startedAt.current = Date.now();
      setSeconds(0);
      setListening(true);
    } catch {
      setMicNote("Microphone permission denied. You can still type.");
    }
  }

  async function submit(mode: "parse" | "raw" = "parse") {
    const value = text.trim();
    if (!value || busy) return;
    stopMic();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: value, action: mode }),
      });
      const data = (await res.json().catch(() => ({}))) as CaptureResponse;
      if (!res.ok || !data.ok || !data.captureId || !data.tasks) {
        throw new Error(data.error || "Could not make tasks");
      }
      setText("");
      setToast({
        captureId: data.captureId,
        tasks: data.tasks,
        counts: data.counts ?? { CURRENT: 0, BACKLOG: 0, ICEBOX: data.tasks.length },
        rawFallback: Boolean(data.rawFallback),
      });
      onCreated(data.tasks.map((t) => t.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not make tasks");
    } finally {
      setBusy(false);
    }
  }

  async function undo() {
    if (!toast) return;
    const id = toast.captureId;
    setToast(null);
    await fetch("/api/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "undo", captureId: id }),
    });
    onCreated([]);
  }

  const counts = toast?.counts;
  const summary = counts
    ? `Added ${toast.tasks.length} · ${counts.CURRENT} Current · ${counts.BACKLOG} Backlog · ${counts.ICEBOX} Icebox`
    : "";

  return (
    <div className="space-y-2">
      <form
        className="flex items-end gap-2 rounded-2xl border border-indigo-500/30 bg-zinc-900/70 p-2 pl-3.5"
        onSubmit={(e) => {
          e.preventDefault();
          void submit("parse");
        }}
      >
        <label className="min-w-0 flex-1">
          <span className="sr-only">Capture</span>
          <textarea
            ref={box}
            value={text}
            disabled={busy}
            rows={1}
            placeholder='Type or talk… e.g. "call vet thursday, fix the fence, someday think about a greenhouse"'
            className="max-h-36 min-h-10 w-full resize-none bg-transparent py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submit("parse");
              }
            }}
          />
        </label>
        {supported === false ? null : (
          <button
            type="button"
            aria-pressed={listening}
            aria-label={listening ? "Stop voice" : "Start voice"}
            disabled={busy || supported === null}
            onClick={() => (listening ? stopMic() : startMic())}
            className={
              listening
                ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-500 text-white"
                : "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-zinc-200"
            }
          >
            <Mic className="h-4 w-4" />
          </button>
        )}
        <button
          type="submit"
          disabled={busy || !text.trim()}
          className="h-9 shrink-0 rounded-xl bg-indigo-500 px-3.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
        </button>
      </form>

      <div aria-live="polite" className="min-h-5 text-xs text-zinc-500">
        {supported === false && "Voice unavailable; type instead"}
        {listening && (
          <span className="text-rose-300">
            Listening {seconds}s
            <span className="ml-2 inline-block h-2 w-8 rounded-full bg-rose-400/70 align-middle" />
          </span>
        )}
        {busy && "Making tasks…"}
        {micNote && <span className="text-amber-200">{micNote}</span>}
      </div>

      {error && (
        <div role="alert" className="flex flex-wrap items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
          <span className="min-w-0 flex-1">{error}</span>
          <button type="button" className="underline" onClick={() => void submit("parse")}>
            Retry
          </button>
          <button type="button" className="underline" onClick={() => void submit("raw")}>
            Save as one task
          </button>
        </div>
      )}

      {toast && (
        <div className="rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-zinc-200">
          <div className="flex flex-wrap items-center gap-2">
            <span>
              {toast.rawFallback ? `${summary} · saved the raw text` : summary}
            </span>
            <button type="button" className="text-indigo-300 underline" onClick={() => void undo()}>
              Undo
            </button>
          </div>
          <ul className="mt-1 space-y-0.5 text-xs text-zinc-400">
            {toast.tasks.map((task) => (
              <li key={task.id}>
                <button
                  type="button"
                  className="underline"
                  onClick={() => {
                    document.querySelector(`[data-task-id="${task.id}"] button`)?.dispatchEvent(
                      new MouseEvent("click", { bubbles: true }),
                    );
                  }}
                >
                  {task.title}
                </button>
                {" · "}
                {LANE_LABEL[task.board]}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
