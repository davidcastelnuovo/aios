import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CREATIVE_COMPOSITIONS,
  buildCompositionLock,
  pickCompositionId,
} from "./compositions.ts";

test("six graphic architectures are available and structurally different", () => {
  assert.equal(CREATIVE_COMPOSITIONS.length, 6);
  const signatures = CREATIVE_COMPOSITIONS.map((item) => `${item.type.x}:${item.type.y}:${item.logo.x}`);
  assert.equal(new Set(signatures).size, signatures.length);
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
  const source = readFileSync(new URL("../../lib/generateCreativeImage.ts", import.meta.url), "utf8");
  assert.match(source, /Do NOT reserve a top headline strip/);
  assert.match(source, /garbles Hebrew/);
  assert.doesNotMatch(source, /reserved top-right pad/);
  assert.doesNotMatch(source, /lower third/);
});
