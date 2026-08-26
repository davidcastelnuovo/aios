import assert from "node:assert/strict";
import test from "node:test";
import { copyConceptsGenerateGate, formatCopyConceptsForImagePrompt, findCopyConcept, isApprovedConceptPrompt, parseConceptsFromCarmen, pickConceptForBatchIndex, resolveVisualPrompt, type CopyConcept } from "./copyConcepts.ts";

const concept = (overrides: Partial<CopyConcept> = {}): CopyConcept => ({
  id: overrides.id ?? "c1",
  name: overrides.name ?? "הכיס הריק",
  bigIdea: overrides.bigIdea ?? "ארנק פעור מול מסך שחור",
  visualLanguage: overrides.visualLanguage ?? "צילום קולנועי, שחור-זהב",
  hook: overrides.hook ?? "כיס הפוך בשנייה הראשונה",
  copyAngle: overrides.copyAngle ?? "הכסף בורח בזמן שאתם גוללים",
  whyItWorks: overrides.whyItWorks ?? "סצנה במקום טקסט על רקע",
  reference: overrides.reference ?? "VW Think Small",
  copyId: overrides.copyId ?? "",
  copyKey: overrides.copyKey ?? "",
  approved: overrides.approved ?? true,
  approvedAt: overrides.approvedAt ?? "2026-08-24T00:00:00.000Z",
});

test("formatCopyConceptsForImagePrompt forbids restaging the slogan", () => {
  const prompt = formatCopyConceptsForImagePrompt([concept()]);
  assert.equal(prompt.startsWith("MUST FOLLOW THIS APPROVED VISUAL CONCEPT"), true);
  assert.match(prompt, /do NOT choose the scene/i);
  assert.match(prompt, /CONCEPT PHOTOGRAPH — HARD LOCK/);
  assert.match(prompt, /PHOTOGRAPH THIS SCENE/);
  assert.match(prompt, /words only — do not restage/);
  assert.match(prompt, /ארנק פעור/);
  assert.match(prompt, /literal illustration of the copy/);
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
  assert.equal(isApprovedConceptPrompt("KEEP THIS"), false);
  assert.equal(isApprovedConceptPrompt("MUST FOLLOW THIS APPROVED VISUAL CONCEPT\nPHOTOGRAPH THIS SCENE: locked door"), true);
});

test("formatCopyConceptsForImagePrompt with primaryId locks to that concept only", () => {
  const second = concept({ id: "c2", name: "הכיסא הריק", bigIdea: "כיסא מול דלת נעולה" });
  const prompt = formatCopyConceptsForImagePrompt(
    [concept(), second],
    { primaryId: "c2" },
  );
  assert.match(prompt, /Concept name: הכיסא הריק/);
  assert.match(prompt, /כיסא מול דלת נעולה/);
  assert.match(prompt, /ONLY concept for this still/);
  assert.doesNotMatch(prompt, /הכיס הריק/);
  assert.doesNotMatch(prompt, /Additional approved concepts/);
  assert.equal(findCopyConcept([concept(), second], "c2")?.name, "הכיסא הריק");
});

test("resolveVisualPrompt with primaryId photographs the chosen approved concept", () => {
  const prompt = resolveVisualPrompt(
    { visual_prompt: "OLD" },
    [concept(), concept({ id: "c2", name: "הקהל", bigIdea: "אולם ריק" })],
    { primaryId: "c2" },
  );
  assert.match(prompt, /אולם ריק/);
  assert.doesNotMatch(prompt, /ארנק פעור/);
  assert.doesNotMatch(prompt, /Additional approved concepts/);
});

test("pickConceptForBatchIndex prefers unused approved concepts then rotates", () => {
  const concepts = [
    concept({ id: "a", name: "א" }),
    concept({ id: "b", name: "ב" }),
    concept({ id: "c", name: "ג" }),
  ];
  assert.equal(pickConceptForBatchIndex(concepts, 0, ["a"])?.id, "b");
  assert.equal(pickConceptForBatchIndex(concepts, 1, ["a"])?.id, "c");
  assert.equal(pickConceptForBatchIndex(concepts, 2, ["a"])?.id, "b");
  assert.equal(pickConceptForBatchIndex(concepts, 0, ["a", "b", "c"])?.id, "a");
  assert.equal(pickConceptForBatchIndex(concepts, 1, ["a", "b", "c"])?.id, "b");
  assert.equal(pickConceptForBatchIndex([], 0)?.id, undefined);
});

test("parseConceptsFromCarmen reads copy variation number into copyKey", () => {
  const parsed = parseConceptsFromCarmen(`---CONCEPTS---
### 1 | המקום שלך בתשובה
רעיון: צ'אט ממליץ על מישהו אחר
ויזואל: מסך טלפון
הוק: תוצאות AI
קופי: 2
`);
  assert.equal(parsed[0]?.copyKey, "2");
  assert.equal(parsed[0]?.copyAngle, "2");
});

test("copyConceptsGenerateGate requires copy text, not just a brief", () => {
  assert.deepEqual(
    copyConceptsGenerateGate({ copyText: "", variationCount: 0, approvedCopyCount: 0 }),
    { canGenerate: false, block: "need_copy" },
  );
  assert.deepEqual(
    copyConceptsGenerateGate({ copyText: "   ", variationCount: 1, approvedCopyCount: 0 }),
    { canGenerate: false, block: "need_copy" },
  );
  assert.equal(
    copyConceptsGenerateGate({ copyText: "כותרת:\nאלפא", variationCount: 1, approvedCopyCount: 0 }).canGenerate,
    true,
  );
});

test("copyConceptsGenerateGate requires an approved variation when there are several", () => {
  assert.deepEqual(
    copyConceptsGenerateGate({ copyText: "כותרת:\nאלפא", variationCount: 3, approvedCopyCount: 0 }),
    { canGenerate: false, block: "need_approval" },
  );
  assert.equal(
    copyConceptsGenerateGate({ copyText: "כותרת:\nאלפא", variationCount: 3, approvedCopyCount: 1 }).canGenerate,
    true,
  );
});
