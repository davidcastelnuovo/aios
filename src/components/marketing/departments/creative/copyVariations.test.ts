import assert from "node:assert/strict";
import test from "node:test";
import { copyBlockLabel, splitCopyVariations } from "./copyVariations.ts";

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
