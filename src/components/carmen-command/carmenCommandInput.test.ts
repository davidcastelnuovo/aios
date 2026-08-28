import assert from "node:assert/strict";
import test from "node:test";
import {
  deliveryForInputMode,
  onRealtimeUnavailable,
  shouldResumeLegacyListen,
  shouldSpeakWithLegacyTts,
  tagChatTurn,
  volumeControlsLiveSession,
} from "./carmenCommandInput.ts";

test("typed and callback turns are text-only", () => {
  assert.equal(deliveryForInputMode("typed"), "text");
  assert.equal(deliveryForInputMode("external_channel_callback"), "text");
  assert.equal(deliveryForInputMode("realtime_voice"), "realtime");
});

test("typed replies never go through carmen-speak", () => {
  assert.equal(shouldSpeakWithLegacyTts("typed"), false);
  assert.equal(shouldSpeakWithLegacyTts("realtime_voice"), false);
  assert.equal(shouldSpeakWithLegacyTts("external_channel_callback"), false);
});

test("volume toggle is Live-only", () => {
  assert.equal(volumeControlsLiveSession("typed"), false);
  assert.equal(volumeControlsLiveSession("realtime_voice"), true);
  assert.equal(volumeControlsLiveSession("external_channel_callback"), false);
});

test("Realtime failure must not fall back to transcribe-voice", () => {
  const result = onRealtimeUnavailable();
  assert.equal(result.fallbackToLegacyListen, false);
  assert.match(result.description, /Realtime/);
});

test("typed send never reopens the legacy listen loop", () => {
  assert.equal(shouldResumeLegacyListen({ inputMode: "typed", realtimeActive: false }), false);
  assert.equal(shouldResumeLegacyListen({ inputMode: "realtime_voice", realtimeActive: false }), false);
});

test("chat turns are tagged with input and delivery mode", () => {
  assert.deepEqual(tagChatTurn("typed"), { input_mode: "typed", delivery_mode: "text" });
  assert.deepEqual(tagChatTurn("realtime_voice"), {
    input_mode: "realtime_voice",
    delivery_mode: "realtime",
  });
});
