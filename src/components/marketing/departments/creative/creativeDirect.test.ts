import assert from "node:assert/strict";
import test from "node:test";
import {
  CREATIVE_DIRECT_IDENTITY,
  CREATIVE_DIRECT_JOB_PREAMBLE,
  CREATIVE_DIRECT_LABEL_HE,
  CREATIVE_DIRECT_NAME,
  CREATIVE_DIRECT_OPEN_MARKER,
  CREATIVE_DIRECT_OPEN_PROMPT,
  CREATIVE_DIRECT_SKILL_PATH,
  CREATIVE_DIRECT_SKIN_SLUG,
} from "./creativeDirect.ts";

test("user-facing label is קריאייטיב דיירקט only", () => {
  assert.equal(CREATIVE_DIRECT_LABEL_HE, "קריאייטיב דיירקט");
  assert.doesNotMatch(CREATIVE_DIRECT_LABEL_HE, /כרמן ישיר/);
  assert.match(CREATIVE_DIRECT_NAME, /Creative Direct/);
});

test("standing skill is a file plus Carmen skin, not a per-job lecture", () => {
  assert.equal(CREATIVE_DIRECT_SKIN_SLUG, "creative_direct");
  assert.match(CREATIVE_DIRECT_SKILL_PATH, /creative-direct\/SKILL.md/);
  assert.match(CREATIVE_DIRECT_OPEN_PROMPT, /STANDING SKILL/);
  assert.match(CREATIVE_DIRECT_OPEN_PROMPT, /ai_skills.creative_direct/);
  assert.match(CREATIVE_DIRECT_JOB_PREAMBLE, /JOB only/);
  assert.match(CREATIVE_DIRECT_JOB_PREAMBLE, /Do not ask to be re-briefed/);
  assert.match(CREATIVE_DIRECT_IDENTITY, /GenerateImage/);
});

test("sticky lookup marker is distinct from per-job dispatches", () => {
  assert.equal(CREATIVE_DIRECT_OPEN_MARKER, "[CREATIVE AGENT] opened Creative Direct");
  assert.equal(CREATIVE_DIRECT_OPEN_MARKER.startsWith("[CREATIVE AGENT]"), true);
});
