import assert from "node:assert/strict";
import test from "node:test";
import { assembleStaticCreativePrompt } from "./creativeGenerationPrompt.ts";

const kit = {
  logoUrl: "https://example.com/logo.png",
  styleReferences: [],
  brandBook: { name: "פרומו", colors: ["#c00000"], notes: "", source: "auto" as const },
};

const base = {
  copyText: "כותרת: המתחרים שלך כבר נכנסים לתשובות של הצ׳אט?\nCTA: השאירו פרטים",
  copyLabel: "וריאציה 1",
  title: "geo",
  format: "1:1",
  styleId: "cinematic" as const,
  kit,
  payload: {},
  compositionId: "flush" as const,
  variationIndex: 0,
};

test("default static prompt paints quoted Hebrew instead of overlay-only", () => {
  const prompt = assembleStaticCreativePrompt({
    ...base,
    visualPrompt: "MUST FOLLOW THIS APPROVED VISUAL CONCEPT\nChat already recommending three competitors.",
  });
  assert.match(prompt, /FINISHED AD/);
  assert.match(prompt, /המתחרים שלך/);
  assert.match(prompt, /paint the quoted Hebrew/i);
  assert.doesNotMatch(prompt, /COPY IS OVERLAY ONLY/);
  assert.doesNotMatch(prompt, /ZERO GLYPHS/);
});

test("live-text static prompt keeps overlay-only and no glyphs", () => {
  const prompt = assembleStaticCreativePrompt({
    ...base,
    visualPrompt: "MUST FOLLOW THIS APPROVED VISUAL CONCEPT\nChat already recommending three competitors.",
    liveTextLayers: true,
  });
  assert.match(prompt, /COPY IS OVERLAY ONLY/);
  assert.match(prompt, /ZERO GLYPHS/);
  assert.doesNotMatch(prompt, /FINISHED AD — paint/);
});
