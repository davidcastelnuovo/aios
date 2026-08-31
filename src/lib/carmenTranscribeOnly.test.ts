import assert from "node:assert/strict";
import test from "node:test";
import {
  isMicCaptureMode,
  loadMicCaptureMode,
  logTranscribeOnlyEvent,
  MIC_CAPTURE_MODE_KEY,
  shouldAllowTtsResponse,
} from "./carmenTranscribeOnly.ts";

test("transcribe_only blocks TTS responses", () => {
  assert.equal(shouldAllowTtsResponse("transcribe_only"), false);
  assert.equal(shouldAllowTtsResponse("typed"), true);
  assert.equal(shouldAllowTtsResponse("realtime_voice"), true);
});

test("mic capture mode validates known values", () => {
  assert.equal(isMicCaptureMode("transcribe_only"), true);
  assert.equal(isMicCaptureMode("realtime_voice"), true);
  assert.equal(isMicCaptureMode("typed"), false);
});

test("loadMicCaptureMode defaults to realtime_voice", () => {
  if (typeof globalThis.localStorage === "undefined") return;
  const prev = globalThis.localStorage.getItem(MIC_CAPTURE_MODE_KEY);
  try {
    globalThis.localStorage.setItem(MIC_CAPTURE_MODE_KEY, "transcribe_only");
    assert.equal(loadMicCaptureMode(), "transcribe_only");
    globalThis.localStorage.removeItem(MIC_CAPTURE_MODE_KEY);
    assert.equal(loadMicCaptureMode(), "realtime_voice");
  } finally {
    if (prev == null) globalThis.localStorage.removeItem(MIC_CAPTURE_MODE_KEY);
    else globalThis.localStorage.setItem(MIC_CAPTURE_MODE_KEY, prev);
  }
});

test("logTranscribeOnlyEvent prefixes structured pipeline steps", () => {
  const lines: unknown[][] = [];
  const orig = console.info;
  console.info = (...args: unknown[]) => lines.push(args);
  try {
    logTranscribeOnlyEvent("send_text", { chars: 12 });
    assert.equal(lines.length, 1);
    assert.equal(lines[0][0], "[carmen:transcribe_only]");
    assert.deepEqual(lines[0][1], { step: "send_text", chars: 12 });
  } finally {
    console.info = orig;
  }
});
