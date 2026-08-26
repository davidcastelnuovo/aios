import assert from "node:assert/strict";
import test from "node:test";
import {
  copyBlockLabel,
  copyBlocksForGeneration,
  conceptCopyJobsForGeneration,
  hydrateCopyVariations,
  pairConceptsToCopyVariations,
  splitCopyVariations,
  type StoredCopyVariation,
} from "./copyVariations.ts";
import type { CopyConcept } from "../../../copyConcepts.ts";

const DOC = `
וריאציה 1 — AIDA — פומו תחרותי
כותרת:
המתחרים
גוף:
לקוחות כבר לא מחפשים רק בגוגל
CTA:
השאירו פרטים לבדיקת הנוכחות שלכם

וריאציה 2 — PAS — כאב
כותרת:
רודוס
הצעה:
כולל מזוודה וטרולי
CTA:
לצפייה בכל הטיסות
`;

test("splits a Copy-department document into one block per וריאציה", () => {
  const blocks = splitCopyVariations(DOC);
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].key, "1");
  assert.equal(blocks[0].parts.headline, "המתחרים");
  assert.equal(blocks[0].parts.cta, "השאירו פרטים לבדיקת הנוכחות שלכם");
  assert.equal(blocks[1].key, "2");
  assert.equal(blocks[1].parts.headline, "רודוס");
  assert.equal(blocks[1].parts.offer, "כולל מזוודה וטרולי");
  assert.match(copyBlockLabel(blocks[0]), /פומו תחרותי/);
});

test("bullet variation headers keep the copy angle", () => {
  const [block] = splitCopyVariations("וריאציה 3 • מגולל לצ'אט\nכותרת: תפתח צ'אט");
  assert.equal(block?.angle, "מגולל לצ'אט");
  assert.match(copyBlockLabel(block!), /מגולל לצ'אט/);
});

test("a document without headers is a single copy block", () => {
  const blocks = splitCopyVariations("כותרת: רודוס\nCTA: הזמינו");
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].parts.headline, "רודוס");
});

test("multiple כותרת blocks split when there is no וריאציה header", () => {
  const blocks = splitCopyVariations("כותרת:\nאלפא\nCTA: אחד\n\nכותרת:\nבטא\nCTA: שתיים");
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].parts.headline, "אלפא");
  assert.equal(blocks[1].parts.headline, "בטא");
});

const stored = (overrides: Partial<StoredCopyVariation> = {}): StoredCopyVariation => ({
  id: overrides.id ?? "copy-1",
  key: overrides.key ?? "1",
  label: overrides.label ?? "וריאציה 1",
  angle: overrides.angle,
  text: overrides.text ?? "כותרת:\nאלפא\nCTA: אחד",
  headline: overrides.headline ?? "אלפא",
  cta: overrides.cta ?? "אחד",
  approved: overrides.approved ?? false,
  approvedAt: overrides.approvedAt ?? null,
});

const concept = (overrides: Partial<CopyConcept> = {}): CopyConcept => ({
  id: overrides.id ?? "c1",
  name: overrides.name ?? "הכיס הריק",
  bigIdea: overrides.bigIdea ?? "ארנק פעור",
  visualLanguage: overrides.visualLanguage ?? "",
  hook: overrides.hook ?? "",
  copyAngle: overrides.copyAngle ?? "",
  whyItWorks: overrides.whyItWorks ?? "",
  reference: overrides.reference ?? "",
  copyId: overrides.copyId ?? "",
  copyKey: overrides.copyKey ?? "",
  approved: overrides.approved ?? true,
  approvedAt: overrides.approvedAt ?? "2026-08-26T00:00:00.000Z",
});

test("hydrateCopyVariations preserves approval by variation key", () => {
  const next = hydrateCopyVariations(DOC, [
    stored({ key: "1", approved: true, approvedAt: "2026-08-26T00:00:00.000Z", id: "keep-1" }),
    stored({ key: "2", approved: false, id: "keep-2" }),
  ]);
  assert.equal(next.length, 2);
  assert.equal(next[0].id, "keep-1");
  assert.equal(next[0].approved, true);
  assert.equal(next[0].headline, "המתחרים");
  assert.equal(next[1].id, "keep-2");
  assert.equal(next[1].approved, false);
});

test("copyBlocksForGeneration prefers approved copies", () => {
  const blocks = copyBlocksForGeneration({
    copy_text: DOC,
    copy_variations: [
      stored({ key: "1", approved: true }),
      stored({ key: "2", approved: false }),
    ],
  });
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].key, "1");
  assert.equal(blocks[0].parts.headline, "המתחרים");
});

test("pairConceptsToCopyVariations links by copyKey then by index", () => {
  const copies = [
    stored({ id: "a", key: "1", headline: "אלפא" }),
    stored({ id: "b", key: "2", label: "וריאציה 2", headline: "בטא" }),
  ];
  const paired = pairConceptsToCopyVariations(
    [concept({ copyKey: "2" }), concept({ id: "c2", name: "שני", copyKey: "" })],
    copies,
  );
  assert.equal(paired[0].copyId, "b");
  assert.equal(paired[0].copyKey, "2");
  assert.equal(paired[1].copyId, "a");
  assert.equal(paired[1].copyKey, "1");
});

test("conceptCopyJobsForGeneration yields one job per approved concept with its copy", () => {
  const jobs = conceptCopyJobsForGeneration({
    copy_text: DOC,
    copy_variations: [
      stored({ id: "a", key: "1", approved: true, text: "כותרת:\nהמתחרים" }),
      stored({ id: "b", key: "2", approved: true, text: "כותרת:\nרודוס" }),
    ],
    approved_concepts: [
      concept({ id: "c1", name: "Think Small", copyKey: "2" }),
      concept({ id: "c2", name: "Old Spice", copyKey: "1" }),
    ],
  });
  assert.equal(jobs.length, 2);
  assert.equal(jobs[0].concept?.name, "Think Small");
  assert.equal(jobs[0].copy.key, "2");
  assert.match(jobs[0].copy.text, /רודוס/);
  assert.equal(jobs[1].concept?.name, "Old Spice");
  assert.equal(jobs[1].copy.key, "1");
});

test("conceptCopyJobsForGeneration falls back to copy blocks when there are no concepts", () => {
  const jobs = conceptCopyJobsForGeneration({ copy_text: DOC });
  assert.equal(jobs.length, 2);
  assert.equal(jobs[0].concept, undefined);
  assert.equal(jobs[0].copy.key, "1");
});
