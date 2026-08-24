import assert from "node:assert/strict";
import test from "node:test";
import { buildLayerTextShadow, inferLayerShadow, withLayerShadow } from "./layerShadow.ts";

test("extrude depth adds that many solid offset steps", () => {
  const css = buildLayerTextShadow({ shadowStyle: "extrude", shadowDepth: 6, shadowColor: "#1e3a8a", shadowBlur: 16 });
  assert.ok(css);
  const steps = css.match(/\d+px \d+px 0 #1e3a8a/g) ?? [];
  assert.equal(steps.length, 6);
});

test("none produces no shadow css", () => {
  assert.equal(buildLayerTextShadow({ shadowStyle: "none" }), undefined);
});

test("soft shadow keeps a single blur drop", () => {
  const css = buildLayerTextShadow({ shadowStyle: "soft", shadowDepth: 8, shadowColor: "#000000", shadowBlur: 18 });
  assert.equal(css, "0 4px 18px #000000");
});

test("halo is an outline glow, not a caption plate", () => {
  const css = buildLayerTextShadow({ shadowStyle: "halo", shadowDepth: 4, shadowColor: "#fde7ee", shadowBlur: 18 });
  assert.ok(css);
  assert.match(css ?? "", /0 0 18px #fde7ee/);
  assert.match(css ?? "", /-1px 0 0 #fde7ee/);
});

test("infer restores extrude depth from existing designed layers", () => {
  const layer = { id: "1", type: "text" as const, x: 0, y: 0, width: 10, height: 10, ...withLayerShadow({ shadowStyle: "extrude", shadowDepth: 8, shadowColor: "#1e3a8a", shadowBlur: 16 }) };
  const inferred = inferLayerShadow(layer);
  assert.equal(inferred.shadowStyle, "extrude");
  assert.equal(inferred.shadowDepth, 8);
  assert.equal(inferred.shadowColor, "#1e3a8a");
});
