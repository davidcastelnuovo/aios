import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCreativeAgentPrompt,
  buildCreativeJobBrief,
  formatBrandColorJobBrief,
  formatConceptJobBrief,
  formatReferenceJobBrief,
  formatStyleJobBrief,
  resolvePreviousStyleId,
} from "./cursorCreativeAgent.ts";
import type { CreativeBrandKit } from "./brandKit.ts";

const kit = (overrides: Partial<CreativeBrandKit> = {}): CreativeBrandKit => ({
  logoUrl: "https://cdn.example/logo.png",
  styleReferences: [{ url: "https://cdn.example/ref.jpg", name: "grade" }],
  brandBook: { name: "פרומו", colors: ["#c00000", "#111111"], notes: "", source: "auto" },
  ...overrides,
});

test("formatConceptJobBrief uses the approved concept fields", () => {
  const block = formatConceptJobBrief({
    name: "הכיס הריק",
    bigIdea: "ארנק פעור מול מסך",
    visualLanguage: "שחור-זהב קולנועי",
    hook: "כיס הפוך",
    copyAngle: "הכסף בורח",
    whyItWorks: "סצנה במקום טקסט",
    reference: "Think Small",
  });
  assert.match(block, /^1\. CONCEPT/);
  assert.match(block, /הכיס הריק/);
  assert.match(block, /ארנק פעור/);
  assert.match(block, /שחור-זהב/);
  assert.match(block, /TYPE only/);
});

test("formatBrandColorJobBrief locks hex colors and admits when none exist", () => {
  assert.match(formatBrandColorJobBrief(kit()), /#c00000/);
  assert.match(formatBrandColorJobBrief(kit()), /hard lock/);
  assert.match(formatBrandColorJobBrief(kit({ brandBook: undefined })), /none on file/);
});

test("formatReferenceJobBrief lists download URLs as a fail-if-skipped block", () => {
  const block = formatReferenceJobBrief([
    { url: "https://cdn.example/ref.jpg", kind: "style" },
    { url: "https://cdn.example/logo.png", kind: "logo" },
  ]);
  assert.match(block, /^3\. CRITICAL REFERENCE URLS/);
  assert.match(block, /https:\/\/cdn\.example\/ref\.jpg/);
  assert.match(block, /https:\/\/cdn\.example\/logo\.png/);
  assert.match(block, /Skipping these is a fail/);
  assert.match(block, /DESIGN SYSTEM LOCK/);
  assert.match(formatReferenceJobBrief([]), /none on file/);
});

test("formatStyleJobBrief names the selected dropdown style and calls out a change", () => {
  const selected = formatStyleJobBrief("swiss");
  assert.match(selected, /מסחרי נקי/);
  assert.match(selected, /swiss/);
  assert.match(selected, /SELECTED STYLE/);
  assert.doesNotMatch(selected, /STYLE CHANGE/);
  const changed = formatStyleJobBrief("cinematic", "swiss");
  assert.match(changed, /STYLE CHANGE/);
  assert.match(changed, /מסחרי נקי/);
  assert.match(changed, /קולנועי/);
  assert.match(changed, /Do not keep the old look/);
  assert.doesNotMatch(formatStyleJobBrief("swiss", "swiss"), /STYLE CHANGE/);
});

test("resolvePreviousStyleId prefers the replaced card, then sibling source, then last live", () => {
  const live = [
    { visualStyle: "swiss" as const },
    { visualStyle: "cinematic" as const, rejected: true },
    { visualStyle: "industrial" as const },
  ];
  assert.equal(resolvePreviousStyleId({ visualStyle: "collage" }, { visualStyle: "swiss" }, live), "collage");
  assert.equal(resolvePreviousStyleId(undefined, { visualStyle: "swiss" }, live), "swiss");
  assert.equal(resolvePreviousStyleId(undefined, undefined, live), "industrial");
  assert.equal(resolvePreviousStyleId({ visualStyle: undefined }, undefined, live), undefined);
});

test("buildCreativeJobBrief includes concept, colors, refs, and style", () => {
  const brief = buildCreativeJobBrief({
    concept: { name: "הכיס הריק", bigIdea: "ארנק פעור", visualLanguage: "", hook: "כיס", copyAngle: "", whyItWorks: "", reference: "" },
    kit: kit(),
    refs: [{ url: "https://cdn.example/ref.jpg", kind: "style" }],
    styleId: "swiss",
    previousStyleId: "cinematic",
  });
  assert.match(brief, /JOB BRIEF/);
  assert.match(brief, /הכיס הריק/);
  assert.match(brief, /#c00000/);
  assert.match(brief, /https:\/\/cdn\.example\/ref\.jpg/);
  assert.match(brief, /מסחרי נקי/);
  assert.match(brief, /STYLE CHANGE/);
});

test("buildCreativeAgentPrompt leads with the job brief then the photograph lock", () => {
  const prompt = buildCreativeAgentPrompt({
    format: "1:1",
    copyText: "כותרת:\nפעם חיפשו אותך.\nCTA:\nהשאירו פרטים",
    visualPrompt: "MUST FOLLOW THIS APPROVED VISUAL CONCEPT\nPhotograph a hollow pocket",
    kit: kit(),
    refs: [{ url: "https://cdn.example/ref.jpg", kind: "style" }],
    concept: { name: "הכיס הריק", bigIdea: "ארנק פעור", visualLanguage: "שחור-זהב", hook: "כיס הפוך", copyAngle: "", whyItWorks: "", reference: "" },
    styleId: "swiss",
    previousStyleId: "cinematic",
  });
  assert.match(prompt, /JOB BRIEF/);
  assert.match(prompt, /הכיס הריק/);
  assert.match(prompt, /BRAND COLORS/);
  assert.match(prompt, /CRITICAL REFERENCE URLS/);
  assert.match(prompt, /https:\/\/cdn\.example\/ref\.jpg/);
  assert.match(prompt, /https:\/\/cdn\.example\/logo\.png/);
  assert.match(prompt, /PROJECT STYLE[\s\S]*מסחרי נקי/);
  assert.match(prompt, /STYLE CHANGE/);
  assert.match(prompt, /CONCEPT PHOTOGRAPH/);
  assert.match(prompt, /פעם חיפשו אותך/);
  const briefAt = prompt.indexOf("JOB BRIEF");
  const photoAt = prompt.indexOf("CONCEPT PHOTOGRAPH");
  assert.ok(briefAt >= 0 && photoAt > briefAt);
});
