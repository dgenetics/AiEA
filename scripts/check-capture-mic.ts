/**
 * Capture is typed. There is no microphone and no Web Speech session.
 * Run: npm run test:capture-mic
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
assert.equal(existsSync(join(root, "src/lib/capture-mic.ts")), false, "capture-mic.ts should be deleted");

const composer = readFileSync(join(root, "src/components/capture-composer.tsx"), "utf8");
assert.doesNotMatch(composer, /SpeechRecognition|webkitSpeechRecognition|createMicSession|getUserMedia/);
assert.doesNotMatch(composer, /Start voice|Stop listening|Voice unavailable|from "lucide-react"[^;]*\bMic\b/);
assert.match(composer, /placeholder="Type a task…"/);
assert.match(composer, /"Add"/);
assert.match(composer, /action: mode/);
assert.match(composer, /submit\("parse"\)/);
assert.match(composer, /submit\("raw"\)/);

const features = readFileSync(join(root, "FEATURES.md"), "utf8");
assert.match(features, /Type a task…/);
assert.doesNotMatch(features, /Web Speech|Voice unavailable/);

console.log("capture: text field and Add only; no microphone");
