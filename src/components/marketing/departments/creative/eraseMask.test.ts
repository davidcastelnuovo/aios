import assert from "node:assert/strict";
import test from "node:test";
import { applyEraseMarks, buildErasePrompt, createKeepMask, maskHasCoverage } from "./eraseMask.ts";

test("buildErasePrompt names the marked word and forbids new type", () => {
  const prompt = buildErasePrompt("פרומו");
  assert.match(prompt, /INPAINT \/ ERASE/);
  assert.match(prompt, /פרומו/);
  assert.match(prompt, /Do not add letters/);
  assert.match(prompt, /unmasked pixel/);
  assert.doesNotMatch(buildErasePrompt("  "), /«/);
});

test("empty mask has no coverage; a stroke punches a transparent hole", () => {
  const empty = createKeepMask(32, 32);
  assert.equal(maskHasCoverage(empty), false);
  assert.equal(empty[3], 255);

  applyEraseMarks(empty, 32, 32, [{ type: "stroke", points: [{ x: 0.5, y: 0.5 }], radius: 0.2 }]);
  assert.equal(maskHasCoverage(empty), true);
  const center = ((16 * 32) + 16) * 4;
  assert.equal(empty[center + 3], 0);
  assert.equal(empty[3], 255);
});

test("a rect mark erases a box and leaves the opposite corner", () => {
  const data = createKeepMask(20, 20);
  applyEraseMarks(data, 20, 20, [{ type: "rect", x: 0, y: 0, width: 0.4, height: 0.4 }]);
  assert.equal(data[3], 0);
  const far = ((19 * 20) + 19) * 4;
  assert.equal(data[far + 3], 255);
});
