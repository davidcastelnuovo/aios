import assert from "node:assert/strict";
import test from "node:test";
import { coerceHumanTaskStatus, mapHumanTaskStatus } from "./taskStatus.ts";

test("maps completed to the DB enum value done", () => {
  assert.equal(mapHumanTaskStatus("completed"), "done");
  assert.equal(mapHumanTaskStatus("COMPLETED"), "done");
  assert.equal(mapHumanTaskStatus("done"), "done");
});

test("passes through open and in_progress", () => {
  assert.equal(mapHumanTaskStatus("open"), "open");
  assert.equal(mapHumanTaskStatus("in_progress"), "in_progress");
});

test("rejects cancelled and unknown values", () => {
  assert.throws(() => mapHumanTaskStatus("cancelled"), /לא תקין/);
  assert.throws(() => mapHumanTaskStatus(""), /לא תקין/);
});

test("coerceHumanTaskStatus never throws and defaults unknown to open", () => {
  assert.equal(coerceHumanTaskStatus("completed"), "done");
  assert.equal(coerceHumanTaskStatus("in_progress"), "in_progress");
  assert.equal(coerceHumanTaskStatus("cancelled"), "open");
  assert.equal(coerceHumanTaskStatus(""), "open");
  assert.equal(coerceHumanTaskStatus(null), "open");
});
