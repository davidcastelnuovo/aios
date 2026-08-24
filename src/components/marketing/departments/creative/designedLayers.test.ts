import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCampaignVisualBrief,
  buildCopySceneBrief,
  buildDesignedCopyLayers,
  ensureLogoLayer,
  extractCopyAngle,
  heroWord,
  isInternalCopyLine,
  isLegacyHeadlineBand,
  parseCreativeCopy,
  punchScore,
  shouldRebuildDesignedLayers,
  strongestLine,
  wrapPosterLine,
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

test("extractCopyAngle reads the variation idea from em-dash or bullet labels", () => {
  assert.equal(extractCopyAngle(AIDA_DOC), "פומו תחרותי");
  assert.equal(extractCopyAngle(undefined, "וריאציה 3 • מגולל לצ'אט"), "מגולל לצ'אט");
  assert.equal(extractCopyAngle("כותרת: רודוס", "פומו תחרותי"), "פומו תחרותי");
  assert.equal(
    extractCopyAngle(`וריאציה 2 — בעיית "אני לא יודע אם אני שם"`),
    `בעיית "אני לא יודע אם אני שם"`,
  );
});

test("copy scene brief stages chat-scroll copy, not a style postcard", () => {
  const scene = buildCopySceneBrief({
    title: "Smartair",
    brief: "טיסה ישירה לרודוס",
    copyLabel: "וריאציה 3 • מגולל לצ'אט",
    copyText: `וריאציה 3 — מגולל לצ'אט

כותרת: עדיין מגלגל בטיקטוק?

גוף: תפתח צ'אט. נסגור לך טיסה בלי עוד שעה של סרטונים.

הנעה לפעולה: כתבו "רודוס" בוואטסאפ`,
  });
  assert.match(scene, /STAGE THIS IDEA/);
  assert.match(scene, /NEVER draw these characters/);
  assert.match(scene, /מגולל לצ'אט/);
  assert.match(scene, /צ'אט/);
  assert.match(scene, /FORBIDDEN SUBSTITUTION/i);
  assert.match(scene, /vacation postcard|Santorini|airplane wing/i);
});

test("copy scene brief stages the doubt problem, not a sea arch", () => {
  const scene = buildCopySceneBrief({
    title: "Smartair",
    brief: "טיסה ישירה לרודוס",
    copyText: `וריאציה 2 — בעיית "אני לא יודע אם אני שם"

כותרת: אתה עדיין לא יודע אם אתה שם?

גוף: בזמן שאתה מתלבט, הטיסות נסגרות.

הנעה לפעולה: בדוק זמינות`,
  });
  assert.match(scene, /אני לא יודע אם אני שם/);
  assert.match(scene, /מתלבט/);
  assert.match(scene, /Santorini|sea arch/i);
});

test("copy scene brief stages competitive FOMO, not an airplane wing", () => {
  const scene = buildCopySceneBrief({
    title: "Smartair Rhodes",
    brief: "טיסה לרודוס במחיר מבצע",
    copyLabel: "וריאציה 1 • פומו תחרותי",
    copyText: AIDA_DOC,
  });
  assert.match(scene, /פומו תחרותי/);
  assert.match(scene, /רודוס|99/);
  assert.match(scene, /THIS variation/i);
  assert.doesNotMatch(scene, /\bAIDA\b/);
});

test("strongestLine prefers a punchy sentence over a weak one-word headline", () => {
  assert.equal(strongestLine(AIDA_DOC), "רק 99 ש״ח ללילה, כולל טיסה");
  assert.equal(
    strongestLine("כותרת:\nהמתחרים\nגוף:\nלקוחות כבר לא מחפשים רק בגוגל\nCTA:\nהשאירו פרטים"),
    "לקוחות כבר לא מחפשים רק בגוגל",
  );
  assert.ok(punchScore("רק 99 ש״ח ללילה") > punchScore("המתחרים"));
});

test("wrapPosterLine splits a long lockup into two poster lines", () => {
  assert.equal(wrapPosterLine("רודוס", 14), "רודוס");
  const wrapped = wrapPosterLine("לקוחות כבר לא מחפשים רק בגוגל", 13);
  assert.match(wrapped, /\n/);
  assert.equal(wrapped.split("\n").length, 2);
});

test("flush lockup is fat type without a full-width headline rectangle", () => {
  const layers = buildDesignedCopyLayers({
    copyText: "כותרת:\nהמתחרים\nגוף:\nלקוחות כבר לא מחפשים רק בגוגל\nCTA:\nהשאירו פרטים",
    format: "1:1",
    styleId: "cinematic",
    compositionId: "flush",
  });
  const poster = layers.find((layer) => layer.type === "text" && (layer.text ?? "").includes("לקוחות"));
  assert.ok(poster);
  assert.equal(poster?.fontFamily, "Suez One");
  assert.ok((poster?.fontSize ?? 0) >= 32);
  assert.ok(!layers.some((layer) => layer.text === "המתחרים"));
  assert.ok(!layers.some((layer) => isLegacyHeadlineBand(layer)));
  assert.equal(poster?.shadowStyle, "halo");
  const cta = layers.find((layer) => layer.text === "השאירו פרטים");
  assert.ok(cta);
  assert.equal(layers.some((layer) => layer.type === "shape" && (layer.y ?? 0) >= 80 && (layer.width ?? 0) >= 50), false);
});

test("designed layers never paint AIDA labels or a bottom caption plate", () => {
  const layers = buildDesignedCopyLayers({
    copyText: AIDA_DOC,
    format: "1:1",
    styleId: "photoreal",
    title: "וריאציה 1 — AIDA — פומו תחרותי",
    compositionId: "flush",
  });
  const texts = layers.map((layer) => layer.text).filter(Boolean);
  assert.ok(texts.some((text) => (text ?? "").includes("99")));
  assert.ok(!texts.includes("טסים"));
  assert.ok(texts.includes("להזמנה"));
  assert.ok(!texts.some((text) => /AIDA|וריאציה|כותרת:/.test(text ?? "")));
  assert.ok(!layers.some((layer) => layer.type === "shape" && layer.y >= 58 && layer.height >= 18 && layer.height <= 36 && layer.width >= 70));
});

test("logo is composited as an image layer and shrinks the headline band", () => {
  const layers = buildDesignedCopyLayers({
    copyText: "כותרת:\nרודוס\nCTA:\nלהזמנה",
    format: "1:1",
    styleId: "swiss",
    logoUrl: "https://example.com/logo.png",
    compositionId: "flag",
  });
  const logo = layers.find((layer) => layer.type === "image");
  const headline = layers.find((layer) => layer.text === "רודוס");
  assert.ok(logo);
  assert.equal(logo?.src, "https://example.com/logo.png");
  assert.ok((logo?.x ?? 99) <= 20);
  assert.ok(headline);
});

test("ensureLogoLayer updates or removes the logo without touching copy", () => {
  const withLogo = ensureLogoLayer([
    { id: "1", type: "text", x: 8, y: 8, width: 60, height: 10, text: "רודוס" },
  ], "https://example.com/a.png");
  assert.equal(withLogo.filter((layer) => layer.type === "image").length, 1);
  const updated = ensureLogoLayer(withLogo, "https://example.com/b.png");
  assert.equal(updated.find((layer) => layer.type === "image")?.src, "https://example.com/b.png");
  assert.equal(updated.find((layer) => layer.text === "רודוס")?.text, "רודוס");
  assert.equal(ensureLogoLayer(updated).some((layer) => layer.type === "image"), false);
});

test("shouldRebuildDesignedLayers catches leftover AIDA overlays and weak auto type", () => {
  assert.equal(shouldRebuildDesignedLayers([
    { id: "1", type: "text", x: 8, y: 60, width: 84, height: 16, text: "וריאציה 1 — AIDA — פומו תחרותי" },
  ]), true);
  assert.equal(shouldRebuildDesignedLayers([
    { id: "1", type: "shape", x: 4, y: 62, width: 92, height: 28, fill: "#ffffffcc" },
  ]), true);
  assert.equal(shouldRebuildDesignedLayers([
    { id: "1", type: "text", x: 8, y: 30, width: 80, height: 14, text: "רודוס" },
  ]), false);
  assert.equal(shouldRebuildDesignedLayers([
    { id: "1", type: "text", x: 6, y: 5, width: 80, height: 10, text: "טסים", fontFamily: "Rubik", fontSize: 28 },
  ], AIDA_DOC), true);
  assert.equal(shouldRebuildDesignedLayers([
    { id: "1", type: "text", x: 4, y: 4, width: 90, height: 16, text: "טסים לרודוס", fontFamily: "Suez One", fontSize: 52 },
  ], AIDA_DOC), false);
  assert.equal(shouldRebuildDesignedLayers([
    { id: "1", type: "shape", x: 0, y: 0, width: 100, height: 22, fill: "#f8fafccc" },
    { id: "2", type: "text", x: 4, y: 4, width: 90, height: 16, text: "רק 99 ש״ח ללילה, כולל טיסה", fontFamily: "Suez One", fontSize: 52 },
  ], AIDA_DOC), true);
});

test("brand colors from the logo override the style palette", () => {
  const layers = buildDesignedCopyLayers({
    copyText: "כותרת:\nרודוס\nCTA:\nלהזמנה",
    format: "1:1",
    styleId: "swiss",
    compositionId: "flush",
    brandColors: ["#111111", "#e11d48"],
  });
  const poster = layers.find((layer) => layer.text === "רודוס");
  assert.ok(poster?.color === "#111111" || poster?.color === "#e11d48");
});

test("rail composition is a vertical field, not a top strip", () => {
  const layers = buildDesignedCopyLayers({
    copyText: "כותרת:\nרודוס\nCTA:\nלהזמנה",
    format: "1:1",
    styleId: "bauhaus",
    compositionId: "rail",
  });
  const field = layers.find((layer) => layer.type === "shape" && (layer.height ?? 0) >= 80);
  assert.ok(field);
  assert.ok((field?.x ?? 0) >= 60);
  assert.ok(!layers.some((layer) => isLegacyHeadlineBand(layer)));
  assert.equal(shouldRebuildDesignedLayers(layers, "כותרת:\nרודוס\nCTA:\nלהזמנה"), false);
});

test("split field is architecture, not a leftover caption plate", () => {
  const layers = buildDesignedCopyLayers({
    copyText: "כותרת:\nרודוס\nCTA:\nלהזמנה",
    format: "1:1",
    styleId: "industrial",
    compositionId: "split",
  });
  const field = layers.find((layer) => layer.type === "shape" && (layer.height ?? 0) >= 40);
  assert.ok(field);
  assert.ok((field?.y ?? 0) >= 50);
  assert.equal(shouldRebuildDesignedLayers(layers, "כותרת:\nרודוס\nCTA:\nלהזמנה"), false);
});

test("slash field is rotated instead of a horizontal caption bar", () => {
  const layers = buildDesignedCopyLayers({
    copyText: "כותרת:\nרודוס\nCTA:\nלהזמנה",
    format: "1:1",
    styleId: "kinetic",
    compositionId: "slash",
  });
  const slash = layers.find((layer) => typeof layer.rotation === "number" && layer.rotation < 0);
  assert.ok(slash);
  assert.ok(!layers.some((layer) => isLegacyHeadlineBand(layer)));
});
