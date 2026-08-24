import assert from "node:assert/strict";
import test from "node:test";

import {
  describesCompletedClientPhoneCall,
  resolveClientUpdateType,
} from "./clientUpdateType.ts";

test("recognizes affirmative client phone-call notes", () => {
  for (const content of [
    "דיברתי עם הלקוח ועדכנתי אותו בתוצאות",
    "דיברנו טלפונית עם הלקוחה על הקמפיין",
    "שוחחתי בטלפון עם הלקוח",
    "בוצעה שיחה עם הלקוח, הכל תקין",
    "שיחת טלפון עם הלקוחה בנושא הלידים",
  ]) {
    assert.equal(describesCompletedClientPhoneCall(content), true, content);
  }
});

test("rejects attempted, missing, and non-call contact", () => {
  for (const content of [
    "לא דיברתי עם הלקוח השבוע",
    "טרם הצלחתי לדבר עם הלקוחה",
    "אין מענה מהלקוח",
    "הלקוח לא ענה",
    "שלחתי ללקוח עדכון בוואטסאפ",
    "עדכון שבועי על ביצועי הקמפיין",
  ]) {
    assert.equal(describesCompletedClientPhoneCall(content), false, content);
  }
});

test("promotes only qualifying weekly updates to call", () => {
  assert.equal(
    resolveClientUpdateType("weekly_update", "דיברתי עם הלקוח על מצב הקמפיין"),
    "call",
  );
  assert.equal(
    resolveClientUpdateType("weekly_update", "שלחתי סיכום במייל"),
    "weekly_update",
  );
  assert.equal(
    resolveClientUpdateType("meeting", "דיברתי עם הלקוח"),
    "meeting",
  );
});
