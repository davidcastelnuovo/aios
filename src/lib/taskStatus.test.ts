import assert from "node:assert/strict";
import test from "node:test";
import { mapHumanTaskStatus } from "./taskStatus.ts";

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
