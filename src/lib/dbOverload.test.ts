import assert from "node:assert/strict";
import test from "node:test";
import { isDbOverloadError } from "./dbOverload.ts";

test("detects PostgREST schema-cache and storage timeouts", () => {
  assert.equal(isDbOverloadError({ code: "PGRST002", message: "Could not query the database for the schema cache" }), true);
  assert.equal(isDbOverloadError({ status: 544, error: "DatabaseTimeout" }), true);
  assert.equal(isDbOverloadError({ message: "Too many connections issued to the database" }), true);
  assert.equal(isDbOverloadError({ code: "PGRST205", message: "table not found" }), false);
  assert.equal(isDbOverloadError(null), false);
});
