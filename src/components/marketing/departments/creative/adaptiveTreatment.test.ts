import assert from "node:assert/strict";
import test from "node:test";
import { buildAdaptiveTreatment, detectCopyMood, isOptionalCostume } from "./adaptiveTreatment.ts";

test("detectCopyMood reads urgency, doubt, and screen life from the copy", () => {
  assert.equal(detectCopyMood("וריאציה 1 — פומו תחרותי\nהמתחרים כבר טסים"), "urgent");
  assert.equal(detectCopyMood("אתה עדיין לא יודע אם אתה שם? מתלבט"), "doubt");
  assert.equal(detectCopyMood("עדיין מגלגל בטיקטוק? תפתח צ'אט"), "screen");
  assert.equal(detectCopyMood("רק 99 ש״ח ללילה"), "offer");
});

test("adaptive treatment follows copy, logo colors, and topic — not the style boards", () => {
  const treatment = buildAdaptiveTreatment({
    copyText: `וריאציה 3 — מגולל לצ'אט

כותרת: עדיין מגלגל בטיקטוק?

גוף: תפתח צ'אט. נסגור לך טיסה.`,
    copyLabel: "וריאציה 3 · מגולל לצ'אט",
    title: "Smartair",
    brief: "טיסה ישירה לרודוס",
    brandColors: ["#e11d48", "#111111"],
  });
  assert.match(treatment, /ADAPTIVE STYLE/i);
  assert.match(treatment, /PALETTE IS THE LOGO/i);
  assert.match(treatment, /#e11d48/);
  assert.match(treatment, /מגולל לצ'אט|טיקטוק|צ'אט/);
  assert.match(treatment, /screen life/i);
  assert.match(treatment, /Forbidden default recipes/i);
  assert.match(treatment, /pink-cyan hologram/i);
  assert.doesNotMatch(treatment, /dress that same situation in a/);
  assert.doesNotMatch(treatment, /Swiss \/ international commercial/i);
});

test("optional costume is a material hint only", () => {
  assert.equal(isOptionalCostume("adaptive"), false);
  assert.equal(isOptionalCostume("bauhaus"), true);
  const treatment = buildAdaptiveTreatment({
    copyText: "כותרת: רודוס",
    brandColors: ["#111111"],
    costumeLabel: "באוהאוס",
  });
  assert.match(treatment, /Optional costume hint/i);
  assert.match(treatment, /באוהאוס/);
  assert.match(treatment, /never its palette/i);
});
