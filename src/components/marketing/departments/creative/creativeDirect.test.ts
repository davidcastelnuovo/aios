import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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

test("standing skill file tells the image chat to honor the four-fact job brief", async () => {
  const skill = await readFile(new URL("../../../../../.cursor/skills/creative-direct/SKILL.md", import.meta.url), "utf8");
  assert.match(skill, /JOB BRIEF/);
  assert.match(skill, /Critical reference URLs/);
  assert.match(skill, /Project style/);
  assert.match(skill, /STYLE CHANGE/);
});

test("sticky lookup marker is distinct from per-job dispatches", () => {
  assert.equal(CREATIVE_DIRECT_OPEN_MARKER, "[CREATIVE AGENT] opened Creative Direct");
  assert.equal(CREATIVE_DIRECT_OPEN_MARKER.startsWith("[CREATIVE AGENT]"), true);
});
