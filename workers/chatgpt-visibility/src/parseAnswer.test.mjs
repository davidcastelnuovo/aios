import test from "node:test";
import assert from "node:assert/strict";
import { cleanAnswerText, extractCitations } from "./parseAnswer.mjs";
import { brandIsMentioned, listPosition, sentimentFromText } from "./mentions.mjs";

test("extractCitations drops chatgpt/openai hosts and keeps source URLs", () => {
  const urls = extractCitations("see https://reddit.com/r/saas and https://chatgpt.com/c/abc", [
    "https://g2.com/products/acme",
    "https://openai.com/blog",
  ]);
  assert.deepEqual(urls.sort(), ["https://g2.com/products/acme", "https://reddit.com/r/saas"].sort());
});

test("brand mention and list position", () => {
  const text = "1. Monday.com\n2. Asana\n3. ClickUp";
  assert.equal(brandIsMentioned(text, "monday.com", []), true);
  assert.equal(listPosition(text, "Asana"), 2);
  assert.equal(cleanAnswerText("  hello  \n\n\n  "), "hello");
});

test("Hebrew sentiment near the brand", () => {
  assert.equal(sentimentFromText("אני לא ממליץ על Acme, זה גרוע", "Acme"), "negative");
  assert.equal(sentimentFromText("הכי מומלץ: Acme", "Acme"), "positive");
});
