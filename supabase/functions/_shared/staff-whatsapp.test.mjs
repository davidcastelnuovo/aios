import assert from "node:assert/strict";
import test from "node:test";

import {
  buildStaffWhatsappAcceptanceCases,
  formatStaffContact,
  normalizeStaffPhone,
  selectStaffMatch,
  scoreNameMatch,
} from "./staff-whatsapp.mjs";

const { ana, david } = buildStaffWhatsappAcceptanceCases();
const roster = [
  { ...ana, role: ["קמפיינר"] },
  { ...david, role: ["קמפיינר"] },
  {
    id: "sp-1",
    full_name: "ישראל ישראלי",
    phone: "0521112233",
    entity_type: "sales_person",
  },
];

test("normalize Israeli staff phones to 972…", () => {
  assert.equal(normalizeStaffPhone("0545612156"), "972545612156");
  assert.equal(normalizeStaffPhone("972545612156"), "972545612156");
  assert.equal(normalizeStaffPhone("545612156"), "972545612156");
  assert.equal(normalizeStaffPhone(""), null);
});

test("select Ana campaigner by id", () => {
  const { match, reason } = selectStaffMatch(roster, {
    id: ana.id,
    entityType: "campaigner",
  });
  assert.equal(reason, "id");
  assert.equal(match?.full_name, "אנה");
  assert.equal(formatStaffContact(match)?.phone, "972545612156");
});

test("select staff by Hebrew name", () => {
  const { match } = selectStaffMatch(roster, { name: "אנה" });
  assert.equal(match?.id, ana.id);
  assert.ok(scoreNameMatch("אנה", "אנה") >= 100);
});

test("ambiguous name returns candidates (no silent pick)", () => {
  const dupes = [
    { id: "a", full_name: "דני", phone: "0501111111", entity_type: "campaigner" },
    { id: "b", full_name: "דני", phone: "0502222222", entity_type: "sales_person" },
  ];
  const { match, ambiguous, reason } = selectStaffMatch(dupes, { name: "דני" });
  assert.equal(match, null);
  assert.equal(reason, "ambiguous_name");
  assert.equal(ambiguous?.length, 2);
});

test("sales_person filter works", () => {
  const { match } = selectStaffMatch(roster, {
    name: "ישראל",
    entityType: "sales_person",
  });
  assert.equal(match?.entity_type, "sales_person");
  assert.equal(formatStaffContact(match)?.phone, "972521112233");
});

test("formatStaffContact never invents a phone", () => {
  const formatted = formatStaffContact({
    id: "x",
    full_name: "בלי טלפון",
    phone: null,
    entity_type: "campaigner",
  });
  assert.equal(formatted.has_phone, false);
  assert.equal(formatted.phone, null);
});
