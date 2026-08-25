import assert from "node:assert/strict";
import test from "node:test";
import {
  digitsOnly,
  leadMatchesPhoneSearch,
  leadSearchOrFilter,
  phoneSearchNeedle,
} from "./leadPhone.ts";

test("phoneSearchNeedle uses last 9 digits so 050 and 972 match", () => {
  assert.equal(phoneSearchNeedle("0507677613"), "507677613");
  assert.equal(phoneSearchNeedle("972507677613"), "507677613");
  assert.equal(phoneSearchNeedle("+972-50-767-7613"), "507677613");
  assert.equal(phoneSearchNeedle("דוד"), null);
});

test("leadMatchesPhoneSearch finds 972 storage from a local 050 query", () => {
  assert.equal(leadMatchesPhoneSearch("972507677613", "0507677613"), true);
  assert.equal(leadMatchesPhoneSearch("0507677613", "972507677613"), true);
  assert.equal(leadMatchesPhoneSearch("0501111111", "0507677613"), false);
});

test("leadSearchOrFilter searches last-9 digits on phone", () => {
  const clause = leadSearchOrFilter("0507677613");
  assert.match(clause, /phone\.ilike\.%507677613%/);
  assert.match(clause, /contact_name\.ilike\.%0507677613%/);
});

test("digitsOnly strips formatting", () => {
  assert.equal(digitsOnly("+972-50-767-7613"), "972507677613");
});
