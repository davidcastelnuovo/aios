import assert from "node:assert/strict";
import test from "node:test";
import {
  canAdvanceToReview,
  canSynthesize,
  capabilitiesForProvider,
  markParliamentFailed,
  parliamentSeatsFromConfig,
  recordParliamentAnswer,
  type ParliamentState,
} from "./logic.ts";

function base(): ParliamentState {
  return {
    round: 1,
    max_rounds: 2,
    seats: { cursor: { provider: "cursor" }, grok: { provider: "grok" } },
    status: "round1",
    topic: "How should we ship X?",
    tools: "read_only",
  };
}

test("parliament MVP seats default to cursor+grok", () => {
  assert.deepEqual(parliamentSeatsFromConfig({}), ["cursor", "grok"]);
  assert.deepEqual(parliamentSeatsFromConfig({ seats: ["cursor", "grok", "claude", "chatgpt", "extra"] }), [
    "cursor", "grok", "claude", "chatgpt",
  ]);
});

test("partial failure does not block synthesis", () => {
  let state = recordParliamentAnswer(base(), "cursor", "ship it", 1);
  state = markParliamentFailed(state, "grok", "timeout");
  assert.equal(canAdvanceToReview(state), true);
  state = { ...state, status: "round2", round: 2 };
  state = recordParliamentAnswer(state, "cursor", "still ship it", 2);
  assert.equal(canSynthesize(state), true);
});

test("direct channels require a callback; internal streams", () => {
  assert.equal(capabilitiesForProvider("internal").streaming_reply, true);
  assert.equal(capabilitiesForProvider("internal").callback_required, false);
  assert.equal(capabilitiesForProvider("cursor").callback_required, true);
  assert.equal(capabilitiesForProvider("chatgpt").callback_required, true);
});
