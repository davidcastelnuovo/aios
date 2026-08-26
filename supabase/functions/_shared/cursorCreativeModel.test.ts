import assert from "node:assert/strict";
import test from "node:test";
import {
  isInvalidCursorModelError,
  pickCreativeModelFromCatalog,
  resolveCreativeCursorModel,
} from "./cursorCreativeModel.ts";

test("composer-2.5-fast is an alias, not a model id", () => {
  assert.deepEqual(resolveCreativeCursorModel("composer-2.5-fast"), {
    id: "composer-2.5",
    params: [{ id: "fast", value: "true" }],
  });
  assert.deepEqual(resolveCreativeCursorModel(""), {
    id: "composer-2.5",
    params: [{ id: "fast", value: "true" }],
  });
  assert.equal(resolveCreativeCursorModel("claude-4.6-sonnet-thinking").id, "claude-4.6-sonnet-thinking");
});

test("catalog pick uses the live composer id and fast param", () => {
  const picked = pickCreativeModelFromCatalog(
    [{ id: "composer-2.5", aliases: ["composer"], parameters: [{ id: "fast", values: [{ value: "true" }] }] }],
    { id: "composer-2.5", params: [{ id: "fast", value: "true" }] },
  );
  assert.equal(picked.id, "composer-2.5");
  assert.deepEqual(picked.params, [{ id: "fast", value: "true" }]);
});

test("invalid model errors are detected for retry-without-model", () => {
  assert.equal(isInvalidCursorModelError("Model 'composer-2.5-fast' is not available or invalid"), true);
  assert.equal(isInvalidCursorModelError("unauthorized"), false);
});
