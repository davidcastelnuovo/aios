import assert from "node:assert/strict";
import test from "node:test";
import { signatureFieldTextLayout } from "./signature-field-text.ts";

test("field text starts at the right edge of the box", () => {
  const layout = signatureFieldTextLayout(200, 40);
  assert.equal(layout.textAnchor, "end");
  assert.equal(layout.direction, "rtl");
  assert.equal(layout.x, 196);
});

test("optional left align stays at the start of the box", () => {
  const layout = signatureFieldTextLayout(200, 40, "left");
  assert.equal(layout.textAnchor, "start");
  assert.equal(layout.direction, "ltr");
  assert.equal(layout.x, 4);
});
