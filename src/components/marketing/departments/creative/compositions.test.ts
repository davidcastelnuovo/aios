import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CREATIVE_COMPOSITIONS,
  buildCompositionLock,
  pickCompositionId,
  pickVariationComposition,
  compositionById,
  DEFAULT_COMPOSITION_ID,
  layoutRectsOverlap,
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

test("composition lock forbids the old caption template and copying faces from boards", () => {
  const lock = buildCompositionLock("rail");
  assert.match(lock, /RAIL/);
  assert.match(lock, /logo-top-right/i);
  assert.match(lock, /not layout and not faces/i);
  assert.match(lock, /Never default to bottom-left/i);
});

test("pickCompositionId prefers an unused structure", () => {
  const first = pickCompositionId("a");
  const second = pickCompositionId("b", [first]);
  assert.notEqual(second, first);
});

test("auto generation never picks the Promo lead-gen offer board", () => {
  for (const seed of ["a", "b", "copy-1", "וריאציה 3", "seo / geo"]) {
    assert.notEqual(pickVariationComposition({ seed }), "offer");
    assert.notEqual(pickCompositionId(seed, [], { exclude: ["offer"] }), "offer");
  }
  assert.equal(pickVariationComposition({ seed: "x", lockedId: "offer" }), "offer");
});

test("auto generation rotates poster layouts across a grid", () => {
  const used: Array<"offer" | "flush" | "rail" | "slash" | "badge" | "flag" | "split"> = [];
  const picked = ["1", "2", "3", "4"].map((seed) => {
    const id = pickVariationComposition({ seed, used });
    used.push(id);
    return id;
  });
  assert.equal(new Set(picked).size, 4);
  assert.equal(picked.includes("offer"), false);
});

test("missing composition falls back to flush, not the offer board", () => {
  assert.equal(DEFAULT_COMPOSITION_ID, "flush");
  assert.equal(compositionById(undefined).id, "flush");
});

test("flush logo is not bottom-left and does not sit under type or CTA", () => {
  const flush = compositionById("flush");
  assert.ok(flush.logo.y < 20, "logo should sit near the top");
  assert.ok(flush.logo.x > 50, "logo should not default to the left edge");
  assert.equal(layoutRectsOverlap(flush.logo, flush.type), false);
  assert.equal(layoutRectsOverlap(flush.logo, flush.cta), false);
});

test("no composition parks the logo on top of type or CTA", () => {
  for (const item of CREATIVE_COMPOSITIONS) {
    assert.equal(layoutRectsOverlap(item.logo, item.type), false, `${item.id} logo vs type`);
    assert.equal(layoutRectsOverlap(item.logo, item.cta), false, `${item.id} logo vs cta`);
  }
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
