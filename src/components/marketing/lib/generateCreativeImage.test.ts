import assert from "node:assert/strict";
import test from "node:test";
import { buildFinishedAdLock, buildNoGlyphLock, wrapCreativeImagePrompt } from "./creativeImagePrompt.ts";

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

test("default wrap is a finished Hebrew ad, not a letter-empty plate", () => {
  const lock = buildFinishedAdLock();
  assert.match(lock, /FINISHED HEBREW AD/);
  assert.match(lock, /Paint the quoted Hebrew/);
  assert.match(lock, /APPROVED CONCEPT/);
  assert.match(lock, /right-to-left/i);
  assert.doesNotMatch(lock, /ZERO GLYPHS/);
  const wrapped = wrapCreativeImagePrompt("STAGE THIS IDEA");
  assert.match(wrapped, /^FINISHED HEBREW AD/);
  assert.match(wrapped, /STAGE THIS IDEA/);
  assert.doesNotMatch(wrapped, /ZERO GLYPHS/);
});

test("live-text wrap keeps the no-glyph lock at both ends", () => {
  const wrapped = wrapCreativeImagePrompt("STAGE THIS IDEA", { liveTextLayers: true, regenerate: true });
  assert.match(wrapped, /^ZERO GLYPHS/);
  assert.match(wrapped, /STAGE THIS IDEA/);
  assert.match(wrapped, /REGENERATE[\s\S]*STAGE THIS IDEA[\s\S]*REGENERATE/);
});

test("inpaint wrap does not add a finished-ad or no-glyph lock", () => {
  const wrapped = wrapCreativeImagePrompt("INPAINT / ERASE. Delete פרומו", { inpaint: true });
  assert.equal(wrapped, "INPAINT / ERASE. Delete פרומו");
  assert.doesNotMatch(wrapped, /FINISHED HEBREW AD/);
  assert.doesNotMatch(wrapped, /ZERO GLYPHS/);
});

test("concept-led prompts stay first after wrapping", () => {
  const wrapped = wrapCreativeImagePrompt("MUST FOLLOW THIS APPROVED VISUAL CONCEPT\nBig idea: empty pocket");
  assert.match(wrapped, /^MUST FOLLOW THIS APPROVED VISUAL CONCEPT/);
  assert.match(wrapped, /FINISHED HEBREW AD/);
});
