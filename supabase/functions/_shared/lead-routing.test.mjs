import assert from "node:assert/strict";
import {
  buildFormQaSummary,
  filterScreeningAnswers,
  isScreeningQuestionKey,
  parseQaText,
} from "./lead-routing.ts";

assert.equal(isScreeningQuestionKey("client_name"), false);
assert.equal(isScreeningQuestionKey("lead_phone"), false);
assert.equal(isScreeningQuestionKey("details"), false);
assert.equal(isScreeningQuestionKey("שם"), false);
assert.equal(isScreeningQuestionKey("טלפון"), false);
assert.equal(isScreeningQuestionKey("הגעה לראשון לציון?"), true);
assert.equal(isScreeningQuestionKey("מספר טלפון"), false);
assert.equal(isScreeningQuestionKey("ליד חדש מקמפיין פייסבוק"), false);
assert.equal(isScreeningQuestionKey("מאיפה אתם בארץ"), true);

assert.deepEqual(
  parseQaText("הגעה לראשון לציון?: כן • ניסיון במכירות?: לא • שם: שאנאיה • טלפון: 0508266089"),
  {
    "הגעה לראשון לציון?": "כן",
    "ניסיון במכירות?": "לא",
  },
);

assert.deepEqual(
  parseQaText(
    "ליד חדש מקמפיין פייסבוק: מיטב שטרן\nשם: Ainzley Tiu\nמספר טלפון: +972544260275\nמאיפה אתם בארץ: Yes\nהאם מדובר ב: שיפוץ",
  ),
  {
    "מאיפה אתם בארץ": "Yes",
    "האם מדובר ב": "שיפוץ",
  },
);

assert.deepEqual(
  filterScreeningAnswers({
    client_name: "דרושים עובדים גוטשטיין",
    lead_name: "שאנאיה",
    lead_phone: "0508266089",
    details: "כל פרט נוסף על הליד",
    "הגעה לראשון לציון?": "כן",
    "ניסיון במכירות?": "לא",
  }),
  {
    "הגעה לראשון לציון?": "כן",
    "ניסיון במכירות?": "לא",
  },
);

assert.equal(
  buildFormQaSummary({
    client_name: "X",
    "כמות": "3+",
    "איסוף/משלוח": "משלוח",
    "כתובת משלוח": "ליויתן 5 חולון",
  }),
  "כמות: 3+ • איסוף/משלוח: משלוח • כתובת משלוח: ליויתן 5 חולון",
);

assert.equal(buildFormQaSummary({ client_name: "only routing" }), "");

console.log("lead-routing tests passed");
