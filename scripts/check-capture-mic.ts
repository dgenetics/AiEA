/**
 * Capture mic must release the audio session. A Bluetooth car treats an open
 * Web Speech recognizer as a call that cannot be hung up.
 * Run: npm run test:capture-mic
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createMicSession, type SpeechRecognizer } from "../src/lib/capture-mic";

type FakeRec = SpeechRecognizer & { events: string[] };

function fakeRecognizer(): FakeRec {
  const rec: FakeRec = {
    continuous: false,
    interimResults: false,
    lang: "",
    events: [],
    start() {
      this.events.push("start");
    },
    stop() {
      this.events.push("stop");
      this.onend?.();
    },
    abort() {
      this.events.push("abort");
    },
    onresult: null,
    onerror: null,
    onend: null,
  };
  return rec;
}

function harness(opts?: { silenceMs?: number; maxListenMs?: number }) {
  const created: FakeRec[] = [];
  const notes: Array<string | null> = [];
  const listening: boolean[] = [];
  const transcripts: string[] = [];
  const pending: Array<{ id: number; ms: number; fn: () => void }> = [];
  let nextId = 1;
  const timers = {
    setTimeout(fn: () => void, ms: number) {
      const id = nextId++;
      pending.push({ id, ms, fn });
      return id;
    },
    clearTimeout(id: number) {
      const index = pending.findIndex((item) => item.id === id);
      if (index >= 0) pending.splice(index, 1);
    },
  };
  const session = createMicSession({
    createRecognizer() {
      const rec = fakeRecognizer();
      created.push(rec);
      return rec;
    },
    onTranscript(spoken) {
      transcripts.push(spoken);
    },
    onListening(value) {
      listening.push(value);
    },
    onNote(note) {
      notes.push(note);
    },
    silenceMs: opts?.silenceMs ?? 4_000,
    maxListenMs: opts?.maxListenMs ?? 120_000,
    timers,
  });

  function fireDue(ms: number) {
    const due = pending.filter((item) => item.ms <= ms);
    for (const item of due) {
      const index = pending.indexOf(item);
      if (index >= 0) pending.splice(index, 1);
      item.fn();
    }
  }

  return { session, created, notes, listening, transcripts, pending, fireDue };
}

function assertReleased(rec: FakeRec, label: string) {
  assert.equal(rec.continuous, false, `${label}: continuous left on`);
  assert.ok(rec.events.includes("stop"), `${label}: stop() not called`);
  assert.ok(rec.events.includes("abort"), `${label}: abort() not called`);
  assert.equal(rec.events.filter((e) => e === "start").length, 1, `${label}: start loop`);
}

const paths = ["manual", "submit", "hidden", "pagehide", "unmount"] as const;

for (const reason of paths) {
  const { session, created } = harness();
  session.begin();
  const rec = created[0]!;
  assert.equal(rec.continuous, true);
  session.release(reason);
  assertReleased(rec, reason);
  assert.equal(session.isListening(), false, reason);
  assert.equal(session.startCount(), 1, reason);
  rec.onend?.();
  assert.equal(session.startCount(), 1, `${reason}: onend restarted`);
  assert.equal(rec.events.filter((e) => e === "start").length, 1);
}

{
  const { session, created, transcripts, pending, fireDue } = harness();
  session.begin();
  const rec = created[0]!;
  assert.ok(pending.some((item) => item.ms === 4_000), "silence timer armed with no results");
  fireDue(3_999);
  assert.equal(session.isListening(), true, "still listening before silence");
  assert.equal(rec.events.includes("stop"), false);
  fireDue(4_000);
  assertReleased(rec, "silence");
  assert.equal(transcripts.length, 0);
}

{
  const { session, created, transcripts, pending, fireDue } = harness({ silenceMs: 4_000 });
  session.begin();
  const rec = created[0]!;
  rec.onresult?.({
    resultIndex: 0,
    results: [{ 0: { transcript: "call vet" }, isFinal: false }],
  });
  assert.deepEqual(transcripts, ["call vet"]);
  const before = pending.length;
  assert.ok(before >= 1);
  fireDue(3_999);
  assert.equal(session.isListening(), true, "result resets the silence window");
  fireDue(4_000);
  assertReleased(rec, "silence after speech");
}

{
  const { session, created, notes } = harness();
  session.begin();
  const rec = created[0]!;
  rec.onerror?.({ error: "not-allowed" });
  assertReleased(rec, "error");
  assert.equal(notes.at(-1), "Microphone permission denied. You can still type.");
  assert.equal(session.startCount(), 1, "onerror did not restart");
}

{
  const { session, created } = harness();
  session.begin();
  const rec = created[0]!;
  const startsBefore = rec.events.filter((e) => e === "start").length;
  rec.onend?.();
  assertReleased(rec, "onend");
  assert.equal(rec.events.filter((e) => e === "start").length, startsBefore, "onend restarted recognition");
  assert.equal(session.startCount(), 1);
}

{
  const { session, created, fireDue } = harness({ maxListenMs: 1_000, silenceMs: 60_000 });
  session.begin();
  const rec = created[0]!;
  rec.onresult?.({
    resultIndex: 0,
    results: [{ 0: { transcript: "still talking" }, isFinal: true }],
  });
  fireDue(1_000);
  assertReleased(rec, "max");
}

{
  const { session, created } = harness();
  const doc = {
    visibilityState: "visible",
    listeners: new Map<string, Array<() => void>>(),
    addEventListener(type: string, listener: () => void) {
      const list = this.listeners.get(type) ?? [];
      list.push(listener);
      this.listeners.set(type, list);
    },
    removeEventListener(type: string, listener: () => void) {
      const list = this.listeners.get(type) ?? [];
      this.listeners.set(
        type,
        list.filter((item) => item !== listener),
      );
    },
  };
  const win = {
    listeners: new Map<string, Array<() => void>>(),
    addEventListener(type: string, listener: () => void) {
      const list = this.listeners.get(type) ?? [];
      list.push(listener);
      this.listeners.set(type, list);
    },
    removeEventListener(type: string, listener: () => void) {
      const list = this.listeners.get(type) ?? [];
      this.listeners.set(
        type,
        list.filter((item) => item !== listener),
      );
    },
  };
  const unbind = session.bindLifecycle(doc, win);
  session.begin();
  const rec = created[0]!;
  doc.visibilityState = "hidden";
  for (const listener of doc.listeners.get("visibilitychange") ?? []) listener();
  assertReleased(rec, "visibility hidden");
  unbind();
  assert.equal(doc.listeners.get("visibilitychange")?.length ?? 0, 0);
  assert.equal(win.listeners.get("pagehide")?.length ?? 0, 0);
}

{
  const { session, created } = harness();
  const doc = {
    visibilityState: "visible",
    addEventListener() {},
    removeEventListener() {},
  };
  const pagehide: Array<() => void> = [];
  const win = {
    addEventListener(type: string, listener: () => void) {
      if (type === "pagehide") pagehide.push(listener);
    },
    removeEventListener() {},
  };
  session.bindLifecycle(doc, win);
  session.begin();
  const rec = created[0]!;
  for (const listener of pagehide) listener();
  assertReleased(rec, "pagehide");
}

{
  const { session } = harness();
  const stopped: string[] = [];
  let closed = 0;
  session.holdAudio({
    stream: {
      getTracks: () => [
        { stop: () => stopped.push("a") },
        { stop: () => stopped.push("b") },
      ],
    },
    context: {
      state: "running",
      close: () => {
        closed += 1;
      },
    },
  });
  session.release("unmount");
  assert.deepEqual(stopped, ["a", "b"]);
  assert.equal(closed, 1);
  session.release("unmount");
  assert.equal(closed, 1, "second release closed the context again");
}

console.log("capture-mic: stop/abort on manual, submit, silence, error, end, hide, pagehide, unmount; no onend restart");
