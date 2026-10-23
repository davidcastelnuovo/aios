import assert from "node:assert/strict";
import test from "node:test";
import { joinNarration } from "../src/narration.mjs";

test("joinNarration makes one continuous script and skips blank lines", () => {
  assert.equal(
    joinNarration(["  כרמן יושבת  ", "", "   ", "ועובדת ליד המחשב"]),
    "כרמן יושבת ועובדת ליד המחשב",
  );
  assert.equal(joinNarration(["רק משפט אחד"]), "רק משפט אחד");
  assert.equal(joinNarration([null, "  "]), "");
});
