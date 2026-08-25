import assert from "node:assert/strict";
import test from "node:test";
import { inferLayerShadow } from "./layerShadow.ts";
import { EDITOR_FONT_WEIGHTS, safeFontWeight, safeHexColor, safeSelectValue } from "./layerEditorGuards.ts";
import { buildOfferBoardLayers } from "./offerBoard.ts";

test("offer headlines use a weight the editor Select can render", () => {
  const layers = buildOfferBoardLayers({
    headline: "הלקוח מחפש המלצה ב־AI",
    palette: {
      headline: "#111111",
      body: "#111111",
      pill: "#dc2626",
      pillText: "#ffffff",
      cta: "#dc2626",
      ctaText: "#ffffff",
      band: "#e11d48",
      extrude: "#111111",
    },
    format: "1:1",
  });
  const headline = layers.find((layer) => layer.role === "headline");
  assert.equal(headline?.fontWeight, "900");
  assert.ok(EDITOR_FONT_WEIGHTS.includes("900"));
  assert.equal(safeFontWeight(headline?.fontWeight), "900");
  assert.equal(safeHexColor(headline?.color), "#111111");
  assert.equal(inferLayerShadow(headline!).shadowStyle, "none");
});

test("safeFontWeight maps unknown weights instead of crashing Select", () => {
  assert.equal(safeFontWeight("500"), "800");
  assert.equal(safeFontWeight(undefined), "800");
  assert.equal(safeFontWeight("700"), "700");
});

test("safeHexColor only returns #rrggbb for color inputs", () => {
  assert.equal(safeHexColor("#fff"), "#ffffff");
  assert.equal(safeHexColor("rgba(0,0,0,0.4)"), "#111111");
  assert.equal(safeHexColor("#dc2626"), "#dc2626");
});

test("safeSelectValue falls back when an icon name is missing from the list", () => {
  assert.equal(safeSelectValue("nope", ["search", "shield"], "search"), "search");
  assert.equal(safeSelectValue("shield", ["search", "shield"], "search"), "shield");
});
