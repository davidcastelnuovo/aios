import assert from "node:assert/strict";
import test from "node:test";
import { buildOfferBoardLayers, fitCta, fitFontSize, footerModules, parseOfferBullets } from "./offerBoard.ts";

test("fitFontSize shrinks long lines and grows short ones", () => {
  assert.ok(fitFontSize("AI", 46, 40, 22) > fitFontSize("הלקוח עדיין מחפש המלצה בגוגל", 46, 40, 22));
  assert.equal(fitFontSize("הלקוח עדיין מחפש המלצה בגוגל ובפייסבוק בלי תוצאה", 46, 40, 22), 22);
});

test("parseOfferBullets reads marked lines only", () => {
  const bullets = parseOfferBullets(`כותרת: בדיקה
- חיפוש AI
- בדיקת אתר
* אסטרטגיה
גוף: משפט רגיל`);
  assert.deepEqual(bullets, ["חיפוש AI", "בדיקת אתר", "אסטרטגיה"]);
});

test("footer modules come from copy bullets, not Promo's default services", () => {
  assert.deepEqual(footerModules([]), []);
  assert.deepEqual(footerModules(["חיפוש AI"]), []);
  const modules = footerModules(["חיפוש AI", "בדיקת אתר", "אסטרטגיה", "ליווי"]);
  assert.deepEqual(modules.map((item) => item.label), ["חיפוש AI", "בדיקת אתר", "אסטרטגיה", "ליווי"]);
  assert.equal(modules.some((item) => item.label === "ליווי"), true);
});

test("offer board builds a clean column, black footer, and four icon objects", () => {
  const layers = buildOfferBoardLayers({
    headline: "הלקוח מחפש המלצה ב־AI",
    sub: "בזמן שאתה מתלבט, המתחרים כבר שם",
    bullets: ["חיפוש AI", "בדיקת אתר", "אסטרטגיה", "ליווי"],
    cta: "השאירו פרטים לבדיקת הנוכחות שלכם בצ'אט",
    footerTitle: "מה מקבלים איתנו?",
    palette: {
      headline: "#111111",
      body: "#111111",
      pill: "#dc2626",
      pillText: "#ffffff",
      cta: "#dc2626",
      ctaText: "#ffffff",
      band: "#e11d48",
      extrude: "#111111",
    },
    logoUrl: "https://example.com/logo.png",
    format: "1:1",
  });
  assert.ok(layers.some((layer) => layer.role === "type_field" && (layer.width ?? 0) <= 48));
  assert.ok(layers.some((layer) => layer.role === "divider"));
  assert.equal(layers.find((layer) => layer.role === "footer")?.fill, "#111111");
  assert.equal(layers.filter((layer) => layer.role === "icon" && (layer.y ?? 0) > 64).length, 4);
  assert.ok(layers.some((layer) => layer.role === "cta" && (layer.text?.length ?? 99) <= 28));
  assert.ok(layers.some((layer) => layer.role === "cta_fill" && layer.fill === "#dc2626"));
  assert.ok(layers.some((layer) => layer.role === "logo"));
});

test("offer board without copy bullets does not stamp Promo's four services", () => {
  const layers = buildOfferBoardLayers({
    headline: "הלקוח מחפש המלצה ב־AI",
    cta: "השאירו פרטים",
    palette: {
      headline: "#111111",
      body: "#111111",
      pill: "#dc2626",
      pillText: "#ffffff",
      cta: "#dc2626",
      ctaText: "#ffffff",
      band: "#e11d48",
      extrude: "#111111",
    },
    format: "1:1",
  });
  assert.equal(layers.filter((layer) => layer.role === "icon_label").length, 0);
  assert.equal(layers.some((layer) => layer.text === "חיפוש AI"), false);
  assert.equal(layers.some((layer) => layer.text === "מה מקבלים איתנו?"), false);
  assert.ok(layers.some((layer) => layer.role === "cta"));
});

test("fitCta shortens a long button label", () => {
  assert.equal(fitCta("השאירו פרטים"), "השאירו פרטים");
  assert.ok(fitCta("השאירו פרטים לבדיקת הנוכחות שלכם בצ'אט").length <= 27);
});
