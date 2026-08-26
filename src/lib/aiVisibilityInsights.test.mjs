import test from "node:test";
import assert from "node:assert/strict";
import { buildVisibilitySummary, classifyPrompt, collectGeoQuestions } from "./aiVisibilityInsights.ts";

test("classifyPrompt marks competitor win when we are absent", () => {
  assert.equal(classifyPrompt([], ["Rival"]), "competitor_wins");
  assert.equal(classifyPrompt([{ prompt_id: "1", platform: "chatgpt", is_mentioned: true, position: 1, sentiment: "positive", response_snippet: "us", citations: [], scanned_at: "2026-01-01" }], []), "owned");
  assert.equal(classifyPrompt([{ prompt_id: "1", platform: "chatgpt", is_mentioned: true, position: 3, sentiment: "neutral", response_snippet: "us", citations: [], scanned_at: "2026-01-01" }], []), "present");
});

test("buildVisibilitySummary creates evidence-backed tips instead of generic advice", () => {
  const summary = buildVisibilitySummary({
    prompts: [
      { id: "p1", prompt: "מה סוכנות השיווק הכי טובה לעסקים קטנים?", category: "recommendation" },
      { id: "p2", prompt: "איך בוחרים קידום אתרים?", category: "how_to" },
    ],
    results: [
      { prompt_id: "p1", platform: "chatgpt", is_mentioned: false, position: null, sentiment: null, response_snippet: "Rival Agency מומלצת", citations: ["https://rival.com/guide"], scanned_at: "2026-08-01T10:00:00Z" },
      { prompt_id: "p2", platform: "chatgpt", is_mentioned: true, position: 1, sentiment: "positive", response_snippet: "המותג שלנו", citations: [], scanned_at: "2026-08-01T10:00:00Z" },
    ],
    competitorResults: [
      { competitor_name: "Rival Agency", prompt_id: "p1", platform: "chatgpt", is_mentioned: true },
    ],
    brandUrl: "https://ours.co.il",
  });

  assert.equal(summary.competitorWins, 1);
  assert.equal(summary.owned, 1);
  assert.equal(summary.shareOfVoice, 50);
  assert.ok(summary.tips.some((tip) => tip.promptId === "p1" && tip.type === "content"));
  assert.ok(summary.tips.some((tip) => tip.id === "no-cite"));
  assert.equal(summary.tips.some((tip) => tip.title.includes("G2")), false);
});

test("collectGeoQuestions pulls unique questions from seo_plan", () => {
  const questions = collectGeoQuestions([
    {
      payload: {
        seo_plan: {
          geo: { questions: ["מה כלי ה-CRM הכי טוב?", "  מה כלי ה-CRM הכי טוב? "] },
          contentPlan: [{ geoQuestions: ["איך בוחרים CRM לעסק קטן?", "מה כלי ה-CRM הכי טוב?"] }],
        },
      },
    },
    { payload: { seo_plan: { geo: { questions: ["איזה CRM מתאים לסוכנות?"] } } } },
  ]);
  assert.deepEqual(questions, [
    "מה כלי ה-CRM הכי טוב?",
    "איך בוחרים CRM לעסק קטן?",
    "איזה CRM מתאים לסוכנות?",
  ]);
});
