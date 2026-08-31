import assert from "node:assert/strict";
import test from "node:test";
import { tabIdForRoute } from "./menuStructure.ts";

test("recordings route maps to marketing sidebar tab", () => {
  assert.equal(tabIdForRoute("/recordings"), "marketing");
});

test("clients route maps to daily sidebar tab", () => {
  assert.equal(tabIdForRoute("/clients"), "daily");
});
