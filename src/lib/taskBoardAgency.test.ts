import assert from "node:assert/strict";
import test from "node:test";
import { resolveBoardTaskAgency } from "./taskBoardAgency.ts";

test("header agency wins over the first-agency fallback", () => {
  assert.equal(resolveBoardTaskAgency("agency-dmm", "agency-first"), "agency-dmm");
});

test("all agencies falls back to the first loaded agency", () => {
  assert.equal(resolveBoardTaskAgency("all", "agency-first"), "agency-first");
});

test("empty / unset header also uses the fallback", () => {
  assert.equal(resolveBoardTaskAgency(null, "agency-first"), "agency-first");
  assert.equal(resolveBoardTaskAgency(undefined, "agency-first"), "agency-first");
});

test("returns null when neither source has an agency", () => {
  assert.equal(resolveBoardTaskAgency("all", null), null);
  assert.equal(resolveBoardTaskAgency(undefined, undefined), null);
});
