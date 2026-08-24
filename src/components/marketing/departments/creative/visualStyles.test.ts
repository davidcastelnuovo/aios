import assert from "node:assert/strict";
import test from "node:test";
import { pickNextVariationStyle } from "./designedLayers.ts";
import {
  CREATIVE_VISUAL_STYLES,
  DEFAULT_VISUAL_STYLE_ID,
  buildVisualStyleLock,
  isVisualStyleId,
  stylesInGroup,
} from "./visualStyles.ts";

test("default style is adaptive; the ten boards stay optional", () => {
  assert.equal(DEFAULT_VISUAL_STYLE_ID, "adaptive");
  assert.deepEqual(stylesInGroup("auto").map((item) => item.id), ["adaptive"]);
  const reference = stylesInGroup("reference").map((item) => item.id);
  assert.deepEqual(reference, [
    "swiss",
    "industrial",
    "mediterranean",
    "kinetic",
    "glass",
    "collage",
    "bauhaus",
    "cinematic",
    "holographic",
    "organic",
  ]);
});

test("legacy style ids still resolve so old projects keep working", () => {
  for (const id of ["adaptive", "photoreal", "animation", "illustration", "popart", "render3d", "editorial", "ugc", "watercolor", "comic"]) {
    assert.equal(isVisualStyleId(id), true);
  }
});

test("collage lock is not overridden by a global anti-collage rule", () => {
  const lock = buildVisualStyleLock({}, { styleId: "collage" });
  assert.match(lock, /analog mixed-media collage/i);
  assert.doesNotMatch(lock, /Forbidden:.*collage/i);
});

test("style locks are treatment only and never require a travel cliché", () => {
  for (const styleId of ["swiss", "kinetic", "organic", "bauhaus", "cinematic", "holographic"] as const) {
    const lock = buildVisualStyleLock({}, { styleId });
    assert.match(lock, /THIS copy/i);
    assert.match(lock, /IRON RULE/i);
    assert.match(lock, /style is costume and lighting only/i);
    assert.match(lock, /RANGE, not a style system/i);
    assert.match(lock, /BRAND COLOR LOCK/i);
    assert.doesNotMatch(lock, /destination coast/i);
  }
  assert.match(buildVisualStyleLock({}, { styleId: "organic" }), /ONLY if the copy is about a place/i);
  assert.match(buildVisualStyleLock({}, { styleId: "bauhaus" }), /never a default airplane wing/i);
  assert.match(buildVisualStyleLock({}, { styleId: "kinetic" }), /not a random streaking car/i);
});

test("new variations stay adaptive instead of cycling the style boards", () => {
  const next = pickNextVariationStyle(["swiss", "industrial"]);
  assert.equal(next.id, "adaptive");
  assert.equal(next.group, "auto");
});

test("adaptive lock does not apply a named style-board recipe", () => {
  const lock = buildVisualStyleLock({}, { styleId: "adaptive" });
  assert.match(lock, /invent a treatment from this copy/i);
  assert.doesNotMatch(lock, /Swiss \/ international commercial/i);
  assert.doesNotMatch(lock, /pink-purple-cyan/i);
});
