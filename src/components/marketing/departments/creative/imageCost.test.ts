import assert from "node:assert/strict";
import test from "node:test";
import {
  addCost,
  costFromApiUsage,
  emptyCostTotals,
  estimateGptImage1,
  estimateTextTokens,
  imageOutputTokens,
  inferImageCost,
  summarizeStoredImageCosts,
  usdFromImageTokens,
} from "./imageCost.ts";

test("official high square output is 4160 tokens / $0.1664", () => {
  assert.equal(imageOutputTokens("high", "1024x1024"), 4160);
  assert.equal(usdFromImageTokens(0, 0, 4160), 0.1664);
});

test("official high portrait output is 6240 tokens / $0.25", () => {
  assert.equal(imageOutputTokens("high", "1024x1536"), 6240);
  assert.equal(usdFromImageTokens(0, 0, 6240), 0.2496);
});

test("medium square matches the published $0.042 ladder", () => {
  assert.equal(imageOutputTokens("medium", "1024x1024"), 1056);
  assert.equal(usdFromImageTokens(0, 0, 1056), 0.04224);
});

test("estimate includes prompt tokens and reference image tokens", () => {
  const cost = estimateGptImage1({
    prompt: "תפתח צ'אט. נסגור לך טיסה.",
    quality: "high",
    size: "1024x1024",
    referenceCount: 1,
  });
  assert.equal(cost.outputTokens, 4160);
  assert.equal(cost.imageInTokens, 1440);
  assert.ok(cost.textTokens > 8);
  assert.ok(cost.costUsd > 0.1664);
  assert.equal(cost.source, "official_table");
  assert.equal(cost.totalTokens, cost.textTokens + cost.imageInTokens + cost.outputTokens);
});

test("API usage with details is treated as exact", () => {
  const cost = costFromApiUsage({
    input_tokens: 2000,
    output_tokens: 4160,
    input_tokens_details: { text_tokens: 560, image_tokens: 1440 },
  }, "high", "1024x1024", 1);
  assert.ok(cost);
  assert.equal(cost?.source, "api");
  assert.equal(cost?.textTokens, 560);
  assert.equal(cost?.imageInTokens, 1440);
  assert.equal(cost?.outputTokens, 4160);
  assert.equal(cost?.costUsd, usdFromImageTokens(560, 1440, 4160));
});

test("API usage without details uses input_tokens as text only", () => {
  const cost = costFromApiUsage({ input_tokens: 800, output_tokens: 4160 }, "high", "1024x1024");
  assert.equal(cost?.textTokens, 800);
  assert.equal(cost?.imageInTokens, 0);
});

test("empty API usage is ignored so the official table can be used", () => {
  assert.equal(costFromApiUsage({}, "high", "1024x1024"), null);
  assert.equal(costFromApiUsage(null, "high", "1024x1024"), null);
});

test("Hebrew prompt estimates more tokens than the same Latin length", () => {
  assert.ok(estimateTextTokens("רודוס עכשיו") > estimateTextTokens("Rhodes now"));
});

test("inferred leftover images count as official output only", () => {
  const totals = addCost(emptyCostTotals(), inferImageCost("high", "1024x1024"));
  assert.equal(totals.images, 1);
  assert.equal(totals.exactImages, 0);
  assert.equal(totals.estimatedImages, 1);
  assert.equal(totals.costUsd, 0.1664);
});

test("project summary falls back to marketing_runs when no stored image cost exists", () => {
  const totals = summarizeStoredImageCosts(
    [{ imageUrl: "https://example.com/a.png" }],
    "high",
    [{ tokens_in: 200, tokens_out: 4160, cost_usd: 0.18, model: "gpt-image-1" }],
  );
  assert.equal(totals.images, 1);
  assert.equal(totals.tokens, 4360);
  assert.equal(totals.costUsd, 0.18);
});

test("project summary prefers stored costs and fills gaps from the official table", () => {
  const stored = costFromApiUsage({ input_tokens: 100, output_tokens: 4160 }, "high", "1024x1024");
  assert.ok(stored);
  const totals = summarizeStoredImageCosts([
    { generationCost: stored, imageUrl: "https://example.com/a.png", format: "1:1" },
    { imageUrl: "https://example.com/b.png", format: "1:1" },
  ], "high");
  assert.equal(totals.images, 2);
  assert.equal(totals.exactImages, 1);
  assert.equal(totals.estimatedImages, 1);
});
