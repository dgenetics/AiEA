/**
 * Capture voice session. Web Speech holds the Bluetooth mic like a phone call
 * until stop() and abort() run. This session always releases it.
 *
 * Capture does not call getUserMedia. If a stream or AudioContext is attached
 * (a meter, a permission probe), release stops every track and closes the context.
 * onend never starts recognition again.
 */

export const SILENCE_MS = 4_000;
export const MAX_LISTEN_MS = 120_000;

export type MicReleaseReason =
  | "manual"
  | "submit"
  | "silence"
  | "max"
  | "error"
  | "end"
  | "hidden"
  | "pagehide"
  | "unmount";

export type SpeechResultEvent = {
  resultIndex: number;
  results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
};

export type SpeechRecognizer = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((ev: SpeechResultEvent) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
};

export type HeldAudio = {
  stream?: { getTracks: () => Array<{ stop: () => void }> } | null;
  context?: { close: () => void | Promise<void>; state?: string } | null;
};

type TimerApi = {
  setTimeout: (fn: () => void, ms: number) => number;
  clearTimeout: (id: number) => void;
};

type LifecycleTarget = {
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
};

type VisibilityDoc = LifecycleTarget & { visibilityState: string };

export type MicSession = {
  begin: () => void;
  release: (reason: MicReleaseReason) => void;
  holdAudio: (audio: HeldAudio) => void;
  bindLifecycle: (doc: VisibilityDoc, win: LifecycleTarget) => () => void;
  isListening: () => boolean;
  startCount: () => number;
};

const defaultTimers: TimerApi = {
  setTimeout: (fn, ms) => window.setTimeout(fn, ms) as unknown as number,
  clearTimeout: (id) => window.clearTimeout(id),
};

export function createMicSession(opts: {
  createRecognizer: () => SpeechRecognizer;
  onTranscript: (spoken: string) => void;
  onListening: (listening: boolean) => void;
  onNote: (note: string | null) => void;
  silenceMs?: number;
  maxListenMs?: number;
  timers?: TimerApi;
}): MicSession {
  const silenceMs = opts.silenceMs ?? SILENCE_MS;
  const maxListenMs = opts.maxListenMs ?? MAX_LISTEN_MS;
  const timers = opts.timers ?? defaultTimers;

  let recognizer: SpeechRecognizer | null = null;
  let audio: HeldAudio | null = null;
  let silenceId: number | null = null;
  let maxId: number | null = null;
  let active = false;
  let starts = 0;

  function clearTimers() {
    if (silenceId != null) timers.clearTimeout(silenceId);
    if (maxId != null) timers.clearTimeout(maxId);
    silenceId = null;
    maxId = null;
  }

  function armSilence() {
    if (silenceId != null) timers.clearTimeout(silenceId);
    silenceId = timers.setTimeout(() => release("silence"), silenceMs);
  }

  function stopHeldAudio() {
    const held = audio;
    audio = null;
    const tracks = held?.stream?.getTracks() ?? [];
    for (const track of tracks) {
      try {
        track.stop();
      } catch {
        /* already stopped */
      }
    }
    const context = held?.context;
    if (context && context.state !== "closed") {
      try {
        void context.close();
      } catch {
        /* already closed */
      }
    }
  }

  function release(reason: MicReleaseReason) {
    if (!active && !recognizer) {
      stopHeldAudio();
      return;
    }
    active = false;
    clearTimers();
    const rec = recognizer;
    recognizer = null;
    if (rec) {
      // Detach first so stop/abort cannot restart from onend.
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      try {
        rec.continuous = false;
      } catch {
        /* ignore */
      }
      try {
        rec.stop();
      } catch {
        /* already stopped */
      }
      try {
        rec.abort();
      } catch {
        /* already aborted */
      }
    }
    stopHeldAudio();
    opts.onListening(false);
    void reason;
  }

  function begin() {
    if (active) return;
    const rec = opts.createRecognizer();
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
      opts.onTranscript(spoken);
      if (active) armSilence();
    };
    rec.onerror = (ev) => {
      if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
        opts.onNote("Microphone permission denied. You can still type.");
      } else if (ev.error !== "aborted" && ev.error !== "no-speech") {
        opts.onNote("Voice didn't start. You can still type.");
      }
      release("error");
    };
    // Never start() from onend. A restart loop is what keeps a car Bluetooth call up.
    rec.onend = () => {
      release("end");
    };
    recognizer = rec;
    active = true;
    starts += 1;
    try {
      rec.start();
    } catch (err) {
      recognizer = rec;
      active = true;
      release("error");
      opts.onNote("Microphone permission denied. You can still type.");
      throw err;
    }
    armSilence();
    maxId = timers.setTimeout(() => release("max"), maxListenMs);
    opts.onListening(true);
  }

  function bindLifecycle(doc: VisibilityDoc, win: LifecycleTarget) {
    const onVisibility = () => {
      if (doc.visibilityState === "hidden") release("hidden");
    };
    const onPageHide = () => release("pagehide");
    doc.addEventListener("visibilitychange", onVisibility);
    win.addEventListener("pagehide", onPageHide);
    return () => {
      doc.removeEventListener("visibilitychange", onVisibility);
      win.removeEventListener("pagehide", onPageHide);
    };
  }

  return {
    begin,
    release,
    holdAudio(next) {
      audio = next;
    },
    bindLifecycle,
    isListening: () => active,
    startCount: () => starts,
  };
}
