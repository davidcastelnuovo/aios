import assert from "node:assert/strict";
import test from "node:test";
import { formatCopyConceptsForImagePrompt, type CopyConcept } from "./copyConcepts.ts";
import {
  findExistingCreativeSibling,
  overlayCopyHandoffPayload,
  stampCopyPayloadAfterHandoff,
  listOpenCreativeProjects,
  suggestedCreativeTarget,
  copyPullSummary,
  type HandoffWorkItem,
} from "./copyHandoff.ts";
import { isCopyDepartmentItem } from "./departmentFilters.ts";

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

const item = (overrides: Partial<HandoffWorkItem> & { id: string }): HandoffWorkItem => ({
  title: "קמפיין קיץ",
  payload: {},
  client_id: "client-1",
  updated_at: "2026-08-24T10:00:00.000Z",
  ...overrides,
});

test("findExistingCreativeSibling prefers the copy item pointer", () => {
  const copy = item({
    id: "copy-1",
    payload: { handoff_to_creative_item_id: "creative-old" },
  });
  const hit = findExistingCreativeSibling(copy, [
    item({
      id: "creative-new",
      payload: { linked_copy_item_id: "copy-1" },
      updated_at: "2026-08-25T10:00:00.000Z",
    }),
    item({ id: "creative-old", title: "שם אחר", payload: { intake_source: "copy_link" } }),
  ]);
  assert.equal(hit?.id, "creative-old");
});

test("findExistingCreativeSibling falls back to linked_copy_item_id, newest first", () => {
  const copy = item({ id: "copy-1" });
  const hit = findExistingCreativeSibling(copy, [
    item({
      id: "older",
      payload: { linked_copy_item_id: "copy-1" },
      updated_at: "2026-08-20T00:00:00.000Z",
    }),
    item({
      id: "newer",
      payload: { linked_copy_item_id: "copy-1" },
      updated_at: "2026-08-24T00:00:00.000Z",
    }),
  ]);
  assert.equal(hit?.id, "newer");
});

test("findExistingCreativeSibling matches same title + copy_link on the same client", () => {
  const copy = item({ id: "copy-1", title: "קמפיין קיץ" });
  const hit = findExistingCreativeSibling(copy, [
    item({
      id: "creative-1",
      title: "קמפיין קיץ",
      payload: { intake_source: "copy_link", department: "creative" },
    }),
    item({
      id: "unrelated",
      title: "קמפיין קיץ",
      payload: { department: "creative" },
    }),
  ]);
  assert.equal(hit?.id, "creative-1");
});

test("findExistingCreativeSibling ignores a same-title manual creative", () => {
  const copy = item({ id: "copy-1" });
  const hit = findExistingCreativeSibling(copy, [
    item({ id: "manual", payload: { department: "creative", intake_source: "manual" } }),
  ]);
  assert.equal(hit, null);
});

test("overlayCopyHandoffPayload keeps existing variations and writes visual_prompt first", () => {
  const approved = [concept()];
  const payload = overlayCopyHandoffPayload({
    existingPayload: {
      department: "creative",
      project_type: "static",
      format: "4:5",
      variations: [{ id: "v1", imageUrl: "https://example.com/a.png" }],
      image_url: "https://example.com/a.png",
      intake_source: "copy_link",
    },
    copyPayload: { copy_text: "כותרת\nגוף", brief_text: "בריף" },
    copyItem: { id: "copy-1", title: "קמפיין קיץ" },
    concepts: approved,
    approved,
    at: "2026-08-25T09:00:00.000Z",
  });
  assert.equal(payload.department, "creative");
  assert.equal(payload.project_type, "static");
  assert.equal(payload.format, "4:5");
  assert.equal(payload.intake_source, "copy_link");
  assert.equal(payload.linked_copy_item_id, "copy-1");
  assert.deepEqual(payload.variations, [{ id: "v1", imageUrl: "https://example.com/a.png" }]);
  assert.match(String(payload.visual_prompt), /MUST FOLLOW THIS APPROVED VISUAL CONCEPT/);
  assert.match(String(payload.visual_prompt), /ארנק פעור/);
  assert.match(String(payload.visual_prompt), /PHOTOGRAPH THIS SCENE/);
  assert.equal((payload.approved_concepts as CopyConcept[])[0]?.name, "הכיס הריק");
});

test("stampCopyPayloadAfterHandoff keeps the item in copy", () => {
  const stamped = stampCopyPayloadAfterHandoff(
    { copy_text: "טקסט", department: "copy" },
    "creative-1",
    "2026-08-25T09:00:00.000Z",
  );
  assert.equal(stamped.department, "copy");
  assert.equal(stamped.handoff_to_creative_item_id, "creative-1");
  assert.equal(isCopyDepartmentItem({ payload: stamped }, "copy-stage"), true);
});

test("formatCopyConceptsForImagePrompt leads with the approved concept", () => {
  const prompt = formatCopyConceptsForImagePrompt([concept(), concept({ id: "c2", name: "וריאציה שנייה", bigIdea: "זווית אחרת" })]);
  assert.equal(prompt.startsWith("MUST FOLLOW THIS APPROVED VISUAL CONCEPT"), true);
  assert.match(prompt, /Concept name: הכיס הריק/);
  assert.match(prompt, /PHOTOGRAPH THIS SCENE/);
  assert.match(prompt, /2\. וריאציה שנייה/);
});

test("listOpenCreativeProjects returns every open creative for the client", () => {
  const copy = item({ id: "copy-1" });
  const open = listOpenCreativeProjects(copy, [
    item({ id: "linked", payload: { linked_copy_item_id: "copy-1", department: "creative" } }),
    item({ id: "manual", title: "באנר קיץ", payload: { department: "creative", intake_source: "manual" } }),
    item({ id: "archived", payload: { department: "creative" }, status: "archived" }),
    item({ id: "other-client", client_id: "client-2", payload: { department: "creative" } }),
    item({ id: "copy-self", payload: { department: "copy" } }),
  ]);
  assert.deepEqual(open.map((row) => row.id), ["linked", "manual"]);
});

test("overlayCopyHandoffPayload keeps existing concepts when the copy has none", () => {
  const existingConcept = concept({ id: "keep" });
  const payload = overlayCopyHandoffPayload({
    existingPayload: {
      department: "creative",
      copy_concepts: [existingConcept],
      approved_concepts: [existingConcept],
    },
    copyPayload: { copy_text: "כותרת חדשה", brief_text: "בריף" },
    copyItem: { id: "copy-2", title: "seo / geo" },
    concepts: [],
    approved: [],
    at: "2026-08-25T09:00:00.000Z",
  });
  assert.equal((payload.copy_concepts as CopyConcept[])[0]?.id, "keep");
  assert.equal((payload.approved_concepts as CopyConcept[])[0]?.id, "keep");
  assert.equal(payload.copy_text, "כותרת חדשה");
});

test("overlayCopyHandoffPayload keeps an existing visual_prompt when nothing is approved", () => {
  const payload = overlayCopyHandoffPayload({
    existingPayload: {
      department: "creative",
      visual_prompt: "KEEP THIS",
      notes: "הערת קריאייטיב",
    },
    copyPayload: { copy_text: "כותרת" },
    copyItem: { id: "copy-1", title: "seo / geo" },
    concepts: [concept({ approved: false, approvedAt: null })],
    approved: [],
    at: "2026-08-25T09:00:00.000Z",
  });
  assert.equal(payload.visual_prompt, "KEEP THIS");
  assert.equal(payload.copy_text, "כותרת");
  assert.equal(payload.linked_copy_item_id, "copy-1");
  assert.equal((payload.copy_concepts as CopyConcept[])[0]?.approved, false);
});

test("copyPullSummary marks items with copy or concepts as pullable", () => {
  assert.equal(copyPullSummary({ copy_text: "כותרת" }).pullable, true);
  assert.equal(copyPullSummary({ copy_concepts: [concept()] }).pullable, true);
  assert.equal(copyPullSummary({ copy_concepts: [concept()] }).approvedCount, 1);
  assert.equal(copyPullSummary({ brief_text: "בריף בלבד" }).pullable, true);
  assert.equal(copyPullSummary({}).pullable, false);
});

test("suggestedCreativeTarget prefers the linked sibling among open projects", () => {
  const copy = item({ id: "copy-1", payload: { handoff_to_creative_item_id: "pointed" } });
  const open = [
    item({ id: "newer-manual", payload: { department: "creative" }, updated_at: "2026-08-25T12:00:00.000Z" }),
    item({ id: "pointed", payload: { department: "creative" }, updated_at: "2026-08-24T10:00:00.000Z" }),
  ];
  assert.equal(suggestedCreativeTarget(copy, open)?.id, "pointed");
});
