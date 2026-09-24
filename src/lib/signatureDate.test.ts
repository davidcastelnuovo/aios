import assert from "node:assert/strict";
import test from "node:test";
import { formatSignatureDate, parseSignatureDate } from "./signatureDate.ts";

test("iso date becomes day/month/year", () => {
  assert.equal(formatSignatureDate("2026-09-24"), "24/09/2026");
});

test("dotted and single-digit dates normalize", () => {
  assert.equal(formatSignatureDate("4.9.2026"), "04/09/2026");
});

test("invalid calendar dates stay unparsed", () => {
  assert.equal(parseSignatureDate("31/02/2026"), undefined);
  assert.equal(parseSignatureDate("24/09/2026")?.getDate(), 24);
});
