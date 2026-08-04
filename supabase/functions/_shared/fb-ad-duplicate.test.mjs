import assert from "node:assert/strict";
import test from "node:test";

import {
  applyVariantToObjectStorySpec,
  applyVariantToAssetFeedSpec,
  extractLeadFormId,
  normalizeAdCopyVariants,
  summarizeSourceAd,
} from "./fb-ad-duplicate.mjs";

const SOURCE_SPEC = {
  page_id: "111",
  link_data: {
    message: "old body",
    name: "old headline",
    link: "https://fb.me/111",
    image_hash: "abc123",
    call_to_action: {
      type: "SIGN_UP",
      value: { lead_gen_form_id: "999888" },
    },
  },
};

test("extractLeadFormId reads CTA lead form", () => {
  assert.equal(extractLeadFormId(SOURCE_SPEC), "999888");
  assert.equal(extractLeadFormId({ video_data: { call_to_action: { value: { lead_gen_form_id: "1" } } } }), "1");
  assert.equal(extractLeadFormId({}), null);
});

test("applyVariantToObjectStorySpec changes copy but keeps media + lead form", () => {
  const next = applyVariantToObjectStorySpec(SOURCE_SPEC, {
    primary_text: "חדש — האיום לא מחכה",
    headline: "כותרת חדשה",
  });
  assert.equal(next.page_id, "111");
  assert.equal(next.link_data.message, "חדש — האיום לא מחכה");
  assert.equal(next.link_data.name, "כותרת חדשה");
  assert.equal(next.link_data.image_hash, "abc123");
  assert.equal(next.link_data.call_to_action.value.lead_gen_form_id, "999888");
  // source untouched
  assert.equal(SOURCE_SPEC.link_data.message, "old body");
});

test("applyVariantToAssetFeedSpec updates first body/title", () => {
  const feed = applyVariantToAssetFeedSpec(
    { bodies: [{ text: "a" }], titles: [{ text: "t" }], images: [{ hash: "h" }] },
    { primary_text: "body2", headline: "title2" },
  );
  assert.equal(feed.bodies[0].text, "body2");
  assert.equal(feed.titles[0].text, "title2");
  assert.equal(feed.images[0].hash, "h");
});

test("normalizeAdCopyVariants validates count and primary_text", () => {
  const v = normalizeAdCopyVariants({
    count: 2,
    variants: [
      { primary_text: "one", headline: "h1" },
      { primary_text: "two", headline: "h2" },
      { primary_text: "three" },
    ],
  });
  assert.equal(v.length, 2);
  assert.equal(v[1].primary_text, "two");
  assert.throws(() => normalizeAdCopyVariants({ variants: [] }), /variants_required/);
  assert.throws(
    () => normalizeAdCopyVariants({ count: 3, variants: [{ primary_text: "a" }] }),
    /variants_count_mismatch/,
  );
});

test("summarizeSourceAd exposes adset/page/lead form for Carmen", () => {
  const summary = summarizeSourceAd(
    { id: "ad1", name: "win", adset_id: "as1", campaign_id: "c1", account_id: "act_55", status: "PAUSED" },
    { id: "cr1", object_story_spec: SOURCE_SPEC },
  );
  assert.equal(summary.adset_id, "as1");
  assert.equal(summary.page_id, "111");
  assert.equal(summary.lead_form_id, "999888");
  assert.equal(summary.creative_id, "cr1");
  assert.equal(summary.account_id, "55");
});
