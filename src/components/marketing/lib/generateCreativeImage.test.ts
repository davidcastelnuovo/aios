import assert from "node:assert/strict";
import test from "node:test";
import { buildNoGlyphLock, wrapCreativeImagePrompt } from "./creativeImagePrompt.ts";

test("no-glyph lock forbids baked Hebrew and English on the PNG", () => {
  const lock = buildNoGlyphLock();
  assert.match(lock, /ZERO GLYPHS/);
  assert.match(lock, /Not Hebrew/);
  assert.match(lock, /garbles Hebrew/);
  assert.match(lock, /Do NOT reserve a top headline strip/);
  assert.doesNotMatch(lock, /REGENERATE/);
});

test("regenerate lock tells the model not to paint replacement words", () => {
  const lock = buildNoGlyphLock({ regenerate: true });
  assert.match(lock, /REGENERATE/);
  assert.match(lock, /letter-empty/);
  assert.match(lock, /gibberish/);
});

test("image prompt wraps the no-glyph lock at both ends", () => {
  const wrapped = wrapCreativeImagePrompt("STAGE THIS IDEA", { regenerate: true });
  assert.match(wrapped, /^ZERO GLYPHS/);
  assert.match(wrapped, /STAGE THIS IDEA/);
  assert.match(wrapped, /REGENERATE[\s\S]*STAGE THIS IDEA[\s\S]*REGENERATE/);
});
