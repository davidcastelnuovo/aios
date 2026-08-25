import assert from "node:assert/strict";
import test from "node:test";
import { isChunkLoadError } from "./chunkErrors.ts";

test("detects Vite dynamic import failures", () => {
  assert.equal(
    isChunkLoadError(new Error("Failed to fetch dynamically imported module: /assets/LeadIntegrations.js")),
    true,
  );
  assert.equal(isChunkLoadError(new Error("ChunkLoadError: Loading chunk 12 failed")), true);
  assert.equal(isChunkLoadError(new Error("something else")), false);
});
