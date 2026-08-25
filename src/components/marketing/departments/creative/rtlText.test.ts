import assert from "node:assert/strict";
import test from "node:test";
import {
  hebrewTextAlign,
  hebrewTextDir,
  hebrewTextStyle,
  overlayBoxDir,
  overlayBoxStyle,
  overlayFlexJustify,
} from "./rtlText.ts";

test("Hebrew copy never uses auto direction", () => {
  assert.equal(hebrewTextDir, "rtl");
  assert.equal(overlayBoxDir, "ltr");
  assert.notEqual(hebrewTextDir, "auto");
});

test("default alignment is right and isolates bidi", () => {
  assert.equal(hebrewTextAlign(undefined), "right");
  assert.equal(overlayFlexJustify(undefined), "flex-end");
  const style = hebrewTextStyle();
  assert.equal(style.direction, "rtl");
  assert.equal(style.unicodeBidi, "isolate");
  assert.equal(style.textAlign, "right");
});

test("center and left stay available without flipping the box into RTL", () => {
  assert.equal(overlayFlexJustify("center"), "center");
  assert.equal(overlayFlexJustify("left"), "flex-start");
  const box = overlayBoxStyle("center");
  assert.equal(box.direction, "ltr");
  assert.equal(box.justifyContent, "center");
});
