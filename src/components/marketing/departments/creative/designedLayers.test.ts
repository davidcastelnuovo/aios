import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCampaignVisualBrief,
  buildDesignedCopyLayers,
  heroWord,
  isInternalCopyLine,
  parseCreativeCopy,
  shouldRebuildDesignedLayers,
} from "./designedLayers.ts";

const AIDA_DOC = `
וריאציה 1 — AIDA — פומו תחרותי
כותרת:
טסים לרודוס
גוף:
רק 99 ש״ח ללילה, כולל טיסה
CTA:
להזמנה
רציונל: בודקים FOMO מול מחיר. רפרנס: Smartair — destination as hero.
`;

test("skips Copy-department AIDA headers and labels", () => {
  assert.equal(isInternalCopyLine("וריאציה 1 — AIDA — פומו תחרותי"), true);
  assert.equal(isInternalCopyLine("כותרת:"), true);
  assert.equal(isInternalCopyLine("CTA:"), true);
  assert.equal(isInternalCopyLine("טסים לרודוס"), false);
});

test("parseCreativeCopy reads the line after כותרת, not the variation title", () => {
  const parts = parseCreativeCopy(AIDA_DOC, "וריאציה 1 — AIDA — פומו תחרותי");
  assert.equal(parts.headline, "טסים לרודוס");
  assert.equal(parts.body, "רק 99 ש״ח ללילה, כולל טיסה");
  assert.equal(parts.cta, "להזמנה");
  assert.notEqual(parts.headline, "וריאציה 1 — AIDA — פומו תחרותי");
});

test("parseCreativeCopy never falls back to an AIDA project title", () => {
  const parts = parseCreativeCopy("כותרת:\n\nגוף:\n", "וריאציה 2 — PAS — כאב");
  assert.equal(parts.headline, undefined);
});

test("parseCreativeCopy supports inline labels", () => {
  const parts = parseCreativeCopy("כותרת: רודוס\nהצעה: 99₪ ללילה\nCTA: הזמינו עכשיו");
  assert.equal(parts.headline, "רודוס");
  assert.equal(parts.offer, "99₪ ללילה");
  assert.equal(parts.cta, "הזמינו עכשיו");
});

test("heroWord keeps a short destination and picks a punchy token from a long line", () => {
  assert.equal(heroWord("רודוס"), "רודוס");
  assert.equal(heroWord("טסים לרודוס עכשיו במחיר מטורף"), "טסים");
});

test("visual brief uses real offer copy, never the AIDA header", () => {
  const brief = buildCampaignVisualBrief({
    copyText: AIDA_DOC,
    title: "וריאציה 1 — AIDA — פומו תחרותי",
    brief: "טיסה לרודוס במחיר מבצע",
  });
  assert.match(brief, /רודוס/);
  assert.doesNotMatch(brief, /AIDA/);
  assert.doesNotMatch(brief, /וריאציה 1/);
  assert.doesNotMatch(brief, /פומו תחרותי/);
});

test("headline sits in the top band, not over the face", () => {
  const layers = buildDesignedCopyLayers({
    copyText: "כותרת:\nהמתחרים\nגוף:\nלקוחות כבר לא מחפשים רק בגוגל\nCTA:\nהשאירו פרטים",
    format: "1:1",
    styleId: "swiss",
  });
  const headline = layers.find((layer) => layer.text === "המתחרים");
  assert.ok(headline);
  assert.ok((headline?.y ?? 99) <= 8);
  const cta = layers.find((layer) => layer.text === "השאירו פרטים");
  assert.ok((cta?.y ?? 0) >= 80);
});

test("designed layers never paint AIDA labels or a bottom caption plate", () => {
  const layers = buildDesignedCopyLayers({
    copyText: AIDA_DOC,
    format: "1:1",
    styleId: "photoreal",
    title: "וריאציה 1 — AIDA — פומו תחרותי",
  });
  const texts = layers.map((layer) => layer.text).filter(Boolean);
  assert.ok(texts.includes("טסים לרודוס") || texts.includes("טסים"));
  assert.ok(texts.includes("להזמנה"));
  assert.ok(!texts.some((text) => /AIDA|וריאציה|כותרת:/.test(text ?? "")));
  assert.ok(!layers.some((layer) => layer.type === "shape" && layer.y >= 52 && layer.height >= 18 && layer.width >= 70));
});

test("shouldRebuildDesignedLayers catches leftover AIDA overlays", () => {
  assert.equal(shouldRebuildDesignedLayers([
    { id: "1", type: "text", x: 8, y: 60, width: 84, height: 16, text: "וריאציה 1 — AIDA — פומו תחרותי" },
  ]), true);
  assert.equal(shouldRebuildDesignedLayers([
    { id: "1", type: "shape", x: 4, y: 62, width: 92, height: 28, fill: "#ffffffcc" },
  ]), true);
  assert.equal(shouldRebuildDesignedLayers([
    { id: "1", type: "text", x: 8, y: 30, width: 80, height: 14, text: "רודוס" },
  ]), false);
});
