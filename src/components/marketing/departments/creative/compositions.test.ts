import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CREATIVE_COMPOSITIONS,
  buildCompositionLock,
  pickCompositionId,
} from "./compositions.ts";

test("seven graphic architectures are available and structurally different", () => {
  assert.equal(CREATIVE_COMPOSITIONS.length, 7);
  assert.equal(CREATIVE_COMPOSITIONS[0].id, "offer");
  const signatures = CREATIVE_COMPOSITIONS.map((item) => `${item.type.x}:${item.type.y}:${item.logo.x}`);
  assert.equal(new Set(signatures).size, signatures.length);
});

test("offer composition asks for a full-bleed photo and forbids a painted template", () => {
  const lock = buildCompositionLock("offer");
  assert.match(lock, /full-bleed/i);
  assert.match(lock, /diagonal/i);
  assert.doesNotMatch(lock, /Leave the LEFT/i);
});

test("composition lock forbids the old caption template and copying the boards", () => {
  const lock = buildCompositionLock("rail");
  assert.match(lock, /RAIL/);
  assert.match(lock, /logo-top-right/i);
  assert.match(lock, /RANGE, not layouts/i);
});

test("pickCompositionId prefers an unused structure", () => {
  const first = pickCompositionId("a");
  const second = pickCompositionId("b", [first]);
  assert.notEqual(second, first);
});

test("image generation lock no longer reserves the old caption template", () => {
  const source = readFileSync(new URL("../../lib/creativeImagePrompt.ts", import.meta.url), "utf8");
  assert.match(source, /Do NOT reserve a top headline strip/);
  assert.match(source, /garbles Hebrew/);
  assert.match(source, /quiet atmospheric pocket/);
  assert.doesNotMatch(source, /reserved top-right pad/);
  assert.doesNotMatch(source, /lower third/);
});

test("offer lock allows a soft pocket and forbids a painted silhouette", () => {
  const lock = buildCompositionLock("offer");
  assert.match(lock, /quiet atmospheric pocket/i);
  assert.match(lock, /drawn silhouette/i);
});
