import assert from "node:assert/strict";
import test from "node:test";
import { formatCopyConceptsForImagePrompt, resolveVisualPrompt, type CopyConcept } from "./copyConcepts.ts";

const concept = (overrides: Partial<CopyConcept> = {}): CopyConcept => ({
  id: overrides.id ?? "c1",
  name: overrides.name ?? "הכיס הריק",
  bigIdea: overrides.bigIdea ?? "ארנק פעור מול מסך שחור",
  visualLanguage: overrides.visualLanguage ?? "צילום קולנועי, שחור-זהב",
  hook: overrides.hook ?? "כיס הפוך בשנייה הראשונה",
  copyAngle: overrides.copyAngle ?? "הכסף בורח בזמן שאתם גוללים",
  whyItWorks: overrides.whyItWorks ?? "סצנה במקום טקסט על רקע",
  reference: overrides.reference ?? "VW Think Small",
  approved: overrides.approved ?? true,
  approvedAt: overrides.approvedAt ?? "2026-08-24T00:00:00.000Z",
});

test("formatCopyConceptsForImagePrompt forbids restaging the slogan", () => {
  const prompt = formatCopyConceptsForImagePrompt([concept()]);
  assert.equal(prompt.startsWith("MUST FOLLOW THIS APPROVED VISUAL CONCEPT"), true);
  assert.match(prompt, /do NOT choose the scene/i);
  assert.match(prompt, /ארנק פעור/);
});

test("resolveVisualPrompt prefers live approved concepts over a stale stored prompt", () => {
  const prompt = resolveVisualPrompt(
    { visual_prompt: "OLD STORED PROMPT ABOUT THE HEADLINE" },
    [concept()],
  );
  assert.match(prompt, /MUST FOLLOW THIS APPROVED VISUAL CONCEPT/);
  assert.match(prompt, /ארנק פעור/);
  assert.doesNotMatch(prompt, /OLD STORED PROMPT/);
});

test("resolveVisualPrompt falls back to stored visual_prompt when there are no concepts", () => {
  assert.equal(
    resolveVisualPrompt({ visual_prompt: "KEEP THIS" }, []),
    "KEEP THIS",
  );
});
