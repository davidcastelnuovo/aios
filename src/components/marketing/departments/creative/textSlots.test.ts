import assert from "node:assert/strict";
import test from "node:test";
import {
  applySlotsToLayers,
  inkOnLuma,
  proposeAndApplySlots,
  proposeTextSlotsFromPixels,
  slotsFromComposition,
} from "./textSlots.ts";
import type { CreativeLayer } from "./types.ts";

const paintRect = (
  data: Uint8ClampedArray,
  width: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  r: number,
  g: number,
  b: number,
) => {
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const i = (y * width + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
};

test("inkOnLuma picks contrast for a quiet pocket", () => {
  assert.equal(inkOnLuma(0.2), "#ffffff");
  assert.equal(inkOnLuma(0.8), "#111111");
});

test("pixel slots land on the uniform quiet half, not the busy half", () => {
  const width = 60;
  const height = 60;
  const data = new Uint8ClampedArray(width * height * 4);
  paintRect(data, width, 0, 0, 30, 60, 20, 20, 20);
  for (let y = 0; y < height; y += 1) {
    for (let x = 30; x < width; x += 1) {
      const i = (y * width + x) * 4;
      data[i] = (x * 17 + y * 13) % 255;
      data[i + 1] = (x * 9) % 255;
      data[i + 2] = (y * 11) % 255;
      data[i + 3] = 255;
    }
  }
  const slots = proposeTextSlotsFromPixels({ data, width, height });
  assert.ok(slots.length >= 1);
  const headline = slots.find((slot) => slot.role === "headline");
  assert.ok(headline);
  assert.ok((headline?.x ?? 99) < 50, "headline should sit in the calm left pocket");
  assert.equal(headline?.textColor, "#ffffff");
  assert.equal(headline?.source, "pixels");
});

test("noisy frames fall back to the composition slots", () => {
  const width = 24;
  const height = 24;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const v = (x + y) % 2 === 0 ? 0 : 255;
      data[i] = v;
      data[i + 1] = 255 - v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  assert.equal(proposeTextSlotsFromPixels({ data, width, height }).length, 0);
  const fallback = slotsFromComposition("offer");
  assert.ok(fallback.some((slot) => slot.role === "headline" && slot.source === "composition"));
});

test("applySlotsToLayers moves headline and CTA without touching footer chrome", () => {
  const layers: CreativeLayer[] = [
    { id: "field", type: "shape", role: "type_field", x: 0, y: 0, width: 46, height: 64, fill: "#fff" },
    { id: "h", type: "text", role: "headline", x: 4, y: 13, width: 40, height: 20, text: "כותרת", color: "#111111" },
    { id: "cta", type: "text", role: "cta", x: 22, y: 87, width: 56, height: 6, text: "שלח", color: "#fff" },
    { id: "foot", type: "shape", role: "footer", x: 0, y: 64, width: 100, height: 36, fill: "#111" },
  ];
  const next = applySlotsToLayers(layers, [
    { role: "headline", x: 8, y: 10, width: 36, height: 18, textColor: "#ffffff", source: "pixels" },
    { role: "cta", x: 20, y: 80, width: 40, height: 8, textColor: "#111111", source: "pixels" },
  ]);
  assert.equal(next[0].x, 0);
  assert.equal(next[1].x, 8);
  assert.equal(next[1].color, "#ffffff");
  assert.equal(next[2].y, 80);
  assert.equal(next[3].role, "footer");
});

test("proposeAndApplySlots uses composition when pixels are missing", () => {
  const result = proposeAndApplySlots({
    id: "v1",
    name: "t",
    imageUrl: "https://example.com/x.png",
    format: "1:1",
    layers: [{ id: "h", type: "text", role: "headline", x: 1, y: 1, width: 10, height: 10, text: "היי" }],
    comments: [],
    createdAt: "",
    compositionId: "offer",
  });
  assert.equal(result.slots[0].source, "composition");
  assert.ok((result.variation.layers[0].width ?? 0) > 10);
});
