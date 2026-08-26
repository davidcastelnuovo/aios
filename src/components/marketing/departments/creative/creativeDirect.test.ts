import assert from "node:assert/strict";
import test from "node:test";
import {
  CREATIVE_DIRECT_IDENTITY,
  CREATIVE_DIRECT_NAME,
  CREATIVE_DIRECT_OPEN_MARKER,
  CREATIVE_DIRECT_OPEN_PROMPT,
} from "./creativeDirect.ts";

test("Creative Direct identity is a dedicated image chat, not a coding agent", () => {
  assert.match(CREATIVE_DIRECT_NAME, /Creative Direct/);
  assert.match(CREATIVE_DIRECT_IDENTITY, /Carmen Direct/);
  assert.match(CREATIVE_DIRECT_IDENTITY, /GenerateImage/);
  assert.match(CREATIVE_DIRECT_IDENTITY, /Do NOT write code/);
  assert.match(CREATIVE_DIRECT_IDENTITY, /TYPE only/);
  assert.match(CREATIVE_DIRECT_OPEN_PROMPT, /waiting for jobs/);
});

test("sticky lookup marker is distinct from per-job dispatches", () => {
  assert.equal(CREATIVE_DIRECT_OPEN_MARKER, "[CREATIVE AGENT] opened Creative Direct");
  assert.equal(CREATIVE_DIRECT_OPEN_MARKER.startsWith("[CREATIVE AGENT]"), true);
  assert.match(CREATIVE_DIRECT_OPEN_MARKER, /opened Creative Direct/);
});
