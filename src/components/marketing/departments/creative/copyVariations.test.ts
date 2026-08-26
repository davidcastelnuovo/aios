import assert from "node:assert/strict";
import test from "node:test";
import {
  copyBlockLabel,
  copyBlocksForGeneration,
  conceptCopyJobsForGeneration,
  hydrateCopyVariations,
  joinCopyVariations,
  linkApprovedConceptsToCopy,
  pairConceptsToCopyVariations,
  remapCopyVariationKeys,
  replaceCopyVariationText,
  applyVariationText,
  splitCopyVariations,
  stripVariationHeader,
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

test("applyVariationText edits one variation without swallowing siblings", () => {
  const item = stored({
    id: "keep-1",
    key: "1",
    approved: true,
    approvedAt: "2026-08-26T00:00:00.000Z",
    angle: "פומו",
    text: "וריאציה 1 — פומו\nכותרת:\nישן\nCTA:\nישן",
  });
  const next = applyVariationText(item, "כותרת:\nחדש\nCTA:\nלחצו");
  assert.equal(next.id, "keep-1");
  assert.equal(next.key, "1");
  assert.equal(next.approved, true);
  assert.equal(next.approvedAt, "2026-08-26T00:00:00.000Z");
  assert.equal(next.headline, "חדש");
  assert.equal(next.cta, "לחצו");
  assert.match(next.text, /^וריאציה 1/);
  assert.equal(next.text.includes("וריאציה 2"), false);
  assert.equal(stripVariationHeader(next.text).includes("חדש"), true);
});

test("applyVariationText ignores a pasted sibling variation header", () => {
  const item = stored({ id: "b", key: "2", angle: "כאב" });
  const next = applyVariationText(item, "וריאציה 9 — גנוב\nכותרת:\nרק זה\nCTA:\nכאן");
  assert.equal(next.id, "b");
  assert.equal(next.key, "2");
  assert.match(next.text, /^וריאציה 2/);
  assert.equal(next.text.includes("וריאציה 9"), false);
  assert.equal(next.headline, "רק זה");
});

test("applyVariationText keeps only the first pasted chunk when a full document is dropped in", () => {
  const item = stored({ id: "a", key: "1", angle: "פומו" });
  const next = applyVariationText(item, [
    "כותרת:",
    "שלי",
    "CTA:",
    "כאן",
    "",
    "וריאציה 2 — כאב",
    "כותרת:",
    "של אחר",
  ].join("\n"));
  assert.equal(next.key, "1");
  assert.equal(next.headline, "שלי");
  assert.equal(next.text.includes("וריאציה 2"), false);
  assert.equal(next.text.includes("של אחר"), false);
});

test("replaceCopyVariationText leaves sibling copy untouched", () => {
  const variations = [
    stored({ id: "a", key: "1", text: "וריאציה 1 — A\nכותרת:\nאלפא" }),
    stored({ id: "b", key: "2", text: "וריאציה 2 — B\nכותרת:\nבטא" }),
  ];
  const next = replaceCopyVariationText(variations, "a", "כותרת:\nגמא");
  assert.match(next[0].text, /גמא/);
  assert.equal(next[1].text, variations[1].text);
  assert.equal(next[0].id, "a");
  assert.equal(next[1].id, "b");
  const joined = joinCopyVariations(next);
  assert.match(joined, /גמא/);
  assert.match(joined, /בטא/);
  assert.equal(joined.includes("אלפא"), false);
});

test("remapCopyVariationKeys appends after existing keys with new ids", () => {
  const existing = [stored({ id: "keep", key: "2" })];
  const remapped = remapCopyVariationKeys(
    [stored({ id: "old", key: "1", text: "כותרת:\nחדש", angle: "כאב" })],
    existing,
  );
  assert.equal(remapped.length, 1);
  assert.equal(remapped[0].key, "3");
  assert.notEqual(remapped[0].id, "old");
  assert.match(remapped[0].text, /^וריאציה 3/);
});

test("linkApprovedConceptsToCopy fills only approved concepts that have no copy yet", () => {
  const copies = [
    stored({ id: "n1", key: "3", headline: "חדש" }),
    stored({ id: "n2", key: "4" }),
  ];
  const linked = linkApprovedConceptsToCopy(
    [
      concept({ id: "has", approved: true, copyId: "keep", copyKey: "1" }),
      concept({ id: "need", name: "שני", approved: true, copyId: "", copyKey: "" }),
      concept({ id: "skip", name: "שלוש", approved: false, copyId: "" }),
    ],
    copies,
  );
  assert.equal(linked[0].copyId, "keep");
  assert.equal(linked[1].copyId, "n1");
  assert.equal(linked[1].copyKey, "3");
  assert.equal(linked[2].copyId, "");
});
