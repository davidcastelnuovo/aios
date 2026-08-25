import assert from "node:assert/strict";
import test from "node:test";
import { buildOfferBoardLayers, fitFontSize, parseOfferBullets } from "./offerBoard.ts";

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

test("offer board builds separate icon, footer, and brand CTA layers", () => {
  const layers = buildOfferBoardLayers({
    headline: "הלקוח מחפש המלצה ב־AI",
    sub: "בזמן שאתה מתלבט, המתחרים כבר שם",
    bullets: ["חיפוש AI", "בדיקת אתר", "ליווי"],
    cta: "השאירו פרטים",
    footerTitle: "מה מקבלים איתנו?",
    palette: {
      headline: "#111111",
      body: "#111111",
      pill: "#dc2626",
      pillText: "#ffffff",
      cta: "#dc2626",
      ctaText: "#ffffff",
      band: "#111111",
      extrude: "#111111",
    },
    logoUrl: "https://example.com/logo.png",
    format: "1:1",
  });
  assert.ok(layers.some((layer) => layer.role === "type_field"));
  assert.ok(layers.some((layer) => layer.role === "footer"));
  assert.ok(layers.some((layer) => layer.role === "cta_fill" && layer.fill === "#dc2626"));
  assert.ok(layers.some((layer) => layer.role === "cta" && layer.text === "השאירו פרטים"));
  assert.equal(layers.filter((layer) => layer.role === "icon").length >= 3, true);
  assert.ok(layers.some((layer) => layer.role === "logo"));
  assert.ok(layers.every((layer) => layer.role));
});
