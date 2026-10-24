import assert from "node:assert/strict";
import test from "node:test";
import { roleForSlug, roleSkin, WORKSHOP_ROLES } from "./workshopRoles.ts";

const skins = [
  { slug: "copywriter", name: "קופי" },
  { slug: "creative_studio", name: "סטודיו", avatarUrl: "https://x/a.png" },
  { slug: "video_director", name: "וידאו" },
];

test("a seat uses the first matching skin and keeps its portrait", () => {
  const design = WORKSHOP_ROLES.find((role) => role.id === "design")!;
  assert.equal(roleSkin(design, skins)?.slug, "creative_studio");
  assert.equal(roleSkin(design, skins)?.avatarUrl, "https://x/a.png");
  assert.equal(roleSkin(WORKSHOP_ROLES[3], skins), null);
});

test("the active slug maps back to its workshop seat", () => {
  assert.equal(roleForSlug("video_director")?.id, "video");
  assert.equal(roleForSlug("site_builder")?.id, "sites");
  assert.equal(roleForSlug("unknown"), null);
  assert.equal(roleForSlug(null), null);
});
