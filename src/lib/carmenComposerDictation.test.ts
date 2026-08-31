import assert from "node:assert/strict";
import test from "node:test";
import { mergeTranscriptionIntoComposer } from "./carmenComposerDictation.ts";

test("mergeTranscriptionIntoComposer appends to existing draft", () => {
  assert.equal(mergeTranscriptionIntoComposer("", "שלום"), "שלום");
  assert.equal(mergeTranscriptionIntoComposer("היי", "עולם"), "היי עולם");
  assert.equal(mergeTranscriptionIntoComposer("טקסט קיים ", "  חדש  "), "טקסט קיים חדש");
});
