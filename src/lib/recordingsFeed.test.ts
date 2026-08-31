import assert from "node:assert/strict";
import test from "node:test";
import { recordingsPollInterval } from "./recordingsPollInterval.ts";

test("recordingsPollInterval ignores non-array cache data", () => {
  assert.equal(recordingsPollInterval(undefined), false);
  assert.equal(recordingsPollInterval({}), false);
});

test("recordingsPollInterval polls while any row is processing", () => {
  assert.equal(
    recordingsPollInterval([
      { transcription_status: "completed" },
      { transcription_status: "processing" },
    ]),
    8000,
  );
  assert.equal(
    recordingsPollInterval([{ transcription_status: "completed" }]),
    false,
  );
});
