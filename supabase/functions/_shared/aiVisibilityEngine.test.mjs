import test from "node:test";
import assert from "node:assert/strict";
import { brandIsMentioned, mentionRateScore, parseResponsesWebSearch } from "./aiVisibilityEngine.ts";

test("mentionRateScore is mentioned queries / all queries", () => {
  assert.equal(mentionRateScore(15, 100), 15);
  assert.equal(mentionRateScore(0, 12), 0);
  assert.equal(mentionRateScore(3, 0), 0);
});

test("parseResponsesWebSearch reads ChatGPT search citations and queries", () => {
  const parsed = parseResponsesWebSearch({
    output_text: "Monday.com מומלץ לעסקים קטנים",
    output: [
      { type: "web_search_call", action: { type: "search", query: "best project management software small business" } },
      {
        type: "message",
        content: [{
          type: "output_text",
          text: "Monday.com מומלץ. https://example.com/guide",
          annotations: [{ type: "url_citation", url: "https://reddit.com/r/saas", title: "thread" }],
        }],
      },
    ],
  });
  assert.match(parsed.text, /Monday/);
  assert.ok(parsed.citations.includes("https://reddit.com/r/saas"));
  assert.ok(parsed.citations.includes("https://example.com/guide"));
  assert.deepEqual(parsed.searchQueries, ["best project management software small business"]);
  assert.equal(parsed.engine, "chatgpt_web_search");
});

test("brandIsMentioned is case-insensitive on brand and keywords", () => {
  assert.equal(brandIsMentioned("I like Monday.com for PM", "monday.com", []), true);
  assert.equal(brandIsMentioned("try Asana instead", "monday.com", ["monday"]), false);
  assert.equal(brandIsMentioned("try Asana instead", "Acme", ["asana"]), true);
});
