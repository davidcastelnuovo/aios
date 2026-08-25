import assert from "node:assert/strict";
import test from "node:test";
import { CREATIVE_ICONS, isCreativeIconId, searchCreativeIcons } from "./iconLibrary.ts";
import { OFFER_ICON_NAMES } from "./offerBoard.ts";

test("library includes the offer-board icons and extra marketing marks", () => {
  for (const name of OFFER_ICON_NAMES) {
    assert.ok(isCreativeIconId(name), name);
  }
  assert.ok(CREATIVE_ICONS.length >= 24);
});

test("icon search matches Hebrew labels and English keywords", () => {
  assert.ok(searchCreativeIcons("מגפון").some((item) => item.id === "megaphone"));
  assert.ok(searchCreativeIcons("whatsapp").some((item) => item.id === "message-circle"));
  assert.equal(searchCreativeIcons("").length, CREATIVE_ICONS.length);
});
