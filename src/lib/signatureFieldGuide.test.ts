import assert from "node:assert/strict";
import test from "node:test";
import type { DocumentField } from "../components/signatures/signatureFieldTypes.ts";
import {
  fieldFillLabel,
  hasAnySignature,
  isFieldFilled,
  isFieldRequired,
  missingRequiredForSubmit,
  nextFieldToFill,
  sortFieldsReadingOrder,
} from "./signatureFieldGuide.ts";

function field(
  partial: Partial<DocumentField> & Pick<DocumentField, "id" | "type">,
): DocumentField {
  return {
    label: "",
    required: false,
    recipient_index: 0,
    position: { x: 10, y: 10, width: 20, height: 5, page: 1 },
    ...partial,
    position: {
      x: 10,
      y: 10,
      width: 20,
      height: 5,
      page: 1,
      ...partial.position,
    },
  };
}

test("isFieldRequired follows the stored flag only", () => {
  assert.equal(isFieldRequired({ required: true }), true);
  assert.equal(isFieldRequired({ required: false }), false);
  assert.equal(isFieldRequired({}), false);
});

test("sortFieldsReadingOrder is page, then y, then right-to-left", () => {
  const fields = [
    field({ id: "left", type: "text", position: { x: 10, y: 20, width: 10, height: 4, page: 1 } }),
    field({ id: "right", type: "text", position: { x: 70, y: 20, width: 10, height: 4, page: 1 } }),
    field({ id: "page2", type: "text", position: { x: 70, y: 5, width: 10, height: 4, page: 2 } }),
    field({ id: "top", type: "text", position: { x: 10, y: 5, width: 10, height: 4, page: 1 } }),
  ];
  assert.deepEqual(
    sortFieldsReadingOrder(fields).map((item) => item.id),
    ["top", "right", "left", "page2"],
  );
});

test("nextFieldToFill walks required empties first, then optional, and wraps", () => {
  const fields = [
    field({ id: "opt", type: "text", required: false, position: { x: 10, y: 10, width: 10, height: 4, page: 1 } }),
    field({ id: "req-a", type: "full_name", required: true, position: { x: 10, y: 20, width: 10, height: 4, page: 1 } }),
    field({ id: "req-b", type: "date", required: true, position: { x: 10, y: 30, width: 10, height: 4, page: 1 } }),
  ];
  assert.equal(nextFieldToFill(fields, {})?.id, "req-a");
  assert.equal(nextFieldToFill(fields, { "req-a": "דוד" })?.id, "req-b");
  assert.equal(nextFieldToFill(fields, { "req-a": "דוד", "req-b": "2026-09-20" })?.id, "opt");
  assert.equal(nextFieldToFill(fields, { "req-a": "דוד", "req-b": "2026-09-20" }, "opt")?.id, "opt");
  assert.equal(
    nextFieldToFill(fields, { "req-a": "דוד" }, "req-b")?.id,
    "opt",
  );
  assert.equal(
    nextFieldToFill(fields, { "req-a": "דוד", "req-b": "2026-09-20", opt: "הערה" }),
    null,
  );
});

test("missingRequiredForSubmit lists required gaps and a signature if none exists", () => {
  const fields = [
    field({ id: "name", type: "full_name", required: true }),
    field({ id: "note", type: "text", required: false }),
    field({ id: "sig", type: "signature", required: false }),
  ];
  const missing = missingRequiredForSubmit(fields, {}, { name: "", companyId: "" });
  assert.deepEqual(missing.map((item) => item.id), ["name", "sig"]);
  assert.equal(hasAnySignature(fields, { sig: "data:image/png;base64,xx" }), true);
  assert.equal(
    missingRequiredForSubmit(fields, { name: "דוד", sig: "data:image/png;base64,xx" }, { name: "", companyId: "" }).length,
    0,
  );
});

test("filled stamp without company details stays missing", () => {
  const fields = [field({ id: "stamp", type: "signature_stamp", required: true })];
  const missing = missingRequiredForSubmit(
    fields,
    { stamp: "data:image/png;base64,xx" },
    { name: "", companyId: "" },
  );
  assert.deepEqual(missing.map((item) => item.id), ["stamp"]);
});

test("fieldFillLabel falls back to the placement label", () => {
  assert.equal(fieldFillLabel(field({ id: "t", type: "text" })), "מילוי");
  assert.equal(fieldFillLabel(field({ id: "n", type: "full_name", label: "שם מלא" })), "שם מלא");
});

test("isFieldFilled ignores whitespace", () => {
  assert.equal(isFieldFilled({ id: "a" }, { a: "  " }), false);
  assert.equal(isFieldFilled({ id: "a" }, { a: "כן" }), true);
});
