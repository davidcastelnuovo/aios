import assert from "node:assert/strict";
import test from "node:test";
import { CREATIVE_DIRECT_SKIN, CREATIVE_DIRECT_SKIN_SLUG } from "./creativeDirectStanding.ts";

test("Carmen creative-person skin is creative_direct / איש קריאייטיב", () => {
  assert.equal(CREATIVE_DIRECT_SKIN_SLUG, "creative_direct");
  assert.equal(CREATIVE_DIRECT_SKIN.name, "איש קריאייטיב");
  assert.match(CREATIVE_DIRECT_SKIN.system_prompt, /mcp_Cursor__generate_creative/);
  assert.match(CREATIVE_DIRECT_SKIN.constraints, /TYPE בלבד/);
  assert.match(CREATIVE_DIRECT_SKIN.constraints, /STYLE CHANGE/);
  assert.match(CREATIVE_DIRECT_SKIN.system_prompt, /צבעי מותג/);
  assert.match(CREATIVE_DIRECT_SKIN.system_prompt, /סגנון שנבחר/);
  assert.ok(CREATIVE_DIRECT_SKIN.triggers.includes("קריאייטיב דיירקט"));
});
