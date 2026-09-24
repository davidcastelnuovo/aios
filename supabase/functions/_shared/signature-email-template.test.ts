import assert from "node:assert/strict";
import test from "node:test";
import { signatureRequestBody, signatureRequestSubject } from "./signature-email-template.ts";

test("request subject fills the document title", () => {
  assert.equal(
    signatureRequestSubject({ subject: "לחתימה: {{title}}" }, { title: "הסכם" }),
    "לחתימה: הסכם",
  );
});

test("empty subject falls back to the default", () => {
  assert.equal(signatureRequestSubject({ subject: "  " }, { title: "הסכם" }), "בקשה לחתימה: הסכם");
});

test("body placeholders are replaced", () => {
  assert.equal(
    signatureRequestBody({ body: "שלום {{first_name}}, מ{{sender}}" }, { first_name: "רעיה", sender: "דוד" }),
    "שלום רעיה, מדוד",
  );
});
