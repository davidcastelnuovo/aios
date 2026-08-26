import assert from "node:assert/strict";
import test from "node:test";
import { buildLayersForComplete } from "./completeVariation.ts";

const COPY = `
וריאציה 5 — AIDA
כותרת:
הלקוח מבקש מהצ'אט המלצה
גוף:
3 עסקים מומלצים — אתם לא ביניהם
CTA:
תפסו את המקום שלכם
`;

test("buildLayersForComplete returns RTL text layers when live text is on", () => {
  const layers = buildLayersForComplete({
    copyText: COPY,
    format: "1:1",
    visualStyle: "animation",
    brandColors: ["#c00000", "#400000"],
    liveTextLayers: true,
    compositionSeed: "var5|promo",
  }).layers;
  assert.ok(layers.length > 0);
  assert.ok(layers.some((layer) => layer.type === "text" && (layer.text?.length ?? 0) > 0));
});

test("buildLayersForComplete skips layers when live text is off", () => {
  const layers = buildLayersForComplete({
    copyText: COPY,
    format: "1:1",
    brandColors: ["#c00000"],
    liveTextLayers: false,
  }).layers;
  assert.deepEqual(layers, []);
});
