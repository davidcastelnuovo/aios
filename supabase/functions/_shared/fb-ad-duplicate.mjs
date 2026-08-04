/** Pure helpers for cloning a Meta ad creative with new primary text / headline. */

export function deepClone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

/** Extract lead_gen_form_id from object_story_spec call_to_action values. */
export function extractLeadFormId(objectStorySpec) {
  if (!objectStorySpec || typeof objectStorySpec !== "object") return null;
  const paths = [
    objectStorySpec?.link_data?.call_to_action?.value?.lead_gen_form_id,
    objectStorySpec?.video_data?.call_to_action?.value?.lead_gen_form_id,
    objectStorySpec?.photo_data?.call_to_action?.value?.lead_gen_form_id,
    objectStorySpec?.template_data?.call_to_action?.value?.lead_gen_form_id,
  ];
  for (const id of paths) {
    if (id != null && String(id).trim()) return String(id);
  }
  return null;
}

export function extractPageId(objectStorySpec) {
  if (!objectStorySpec || typeof objectStorySpec !== "object") return null;
  return objectStorySpec.page_id ? String(objectStorySpec.page_id) : null;
}

/**
 * Apply primary_text / headline / description onto a cloned object_story_spec,
 * preserving media hashes, page_id, CTA / lead form, and link.
 */
export function applyVariantToObjectStorySpec(objectStorySpec, variant = {}) {
  if (!objectStorySpec || typeof objectStorySpec !== "object") {
    throw new Error("source_creative_missing_object_story_spec");
  }
  const spec = deepClone(objectStorySpec);
  const primary = variant.primary_text != null ? String(variant.primary_text) : null;
  const headline = variant.headline != null ? String(variant.headline) : null;
  const description = variant.description != null ? String(variant.description) : null;

  const patchStoryBlock = (block) => {
    if (!block || typeof block !== "object") return block;
    if (primary != null) block.message = primary;
    if (headline != null) block.name = headline;
    if (description != null) block.description = description;
    return block;
  };

  if (spec.link_data) spec.link_data = patchStoryBlock(spec.link_data);
  if (spec.video_data) {
    spec.video_data = patchStoryBlock(spec.video_data);
    // video_data uses title in some creatives
    if (headline != null && spec.video_data && spec.video_data.title != null) {
      spec.video_data.title = headline;
    } else if (headline != null && spec.video_data && !spec.video_data.name) {
      spec.video_data.title = headline;
    }
  }
  if (spec.photo_data) spec.photo_data = patchStoryBlock(spec.photo_data);
  if (spec.template_data) spec.template_data = patchStoryBlock(spec.template_data);

  if (!spec.link_data && !spec.video_data && !spec.photo_data && !spec.template_data) {
    throw new Error("source_creative_unsupported_story_spec");
  }
  return spec;
}

/**
 * For Advantage+/asset_feed creatives: replace first body/title (or append) with variant copy.
 */
export function applyVariantToAssetFeedSpec(assetFeedSpec, variant = {}) {
  if (!assetFeedSpec || typeof assetFeedSpec !== "object") {
    throw new Error("source_creative_missing_asset_feed_spec");
  }
  const feed = deepClone(assetFeedSpec);
  const primary = variant.primary_text != null ? String(variant.primary_text) : null;
  const headline = variant.headline != null ? String(variant.headline) : null;

  if (primary != null) {
    const bodies = Array.isArray(feed.bodies) ? feed.bodies : [];
    if (bodies.length && typeof bodies[0] === "object") {
      bodies[0] = { ...bodies[0], text: primary };
    } else {
      bodies[0] = { text: primary };
    }
    feed.bodies = bodies;
  }
  if (headline != null) {
    const titles = Array.isArray(feed.titles) ? feed.titles : [];
    if (titles.length && typeof titles[0] === "object") {
      titles[0] = { ...titles[0], text: headline };
    } else {
      titles[0] = { text: headline };
    }
    feed.titles = titles;
  }
  return feed;
}

/** Normalize Carmen tool args into a clean variants array (max 8). */
export function normalizeAdCopyVariants(args = {}) {
  const MAX = 8;
  let raw = Array.isArray(args.variants) ? args.variants : null;
  if (!raw && Array.isArray(args.primary_texts)) {
    raw = args.primary_texts.map((text, i) => ({
      primary_text: text,
      headline: Array.isArray(args.headlines) ? args.headlines[i] : undefined,
      name: Array.isArray(args.names) ? args.names[i] : undefined,
      description: Array.isArray(args.descriptions) ? args.descriptions[i] : undefined,
    }));
  }
  if (!raw || !raw.length) {
    throw new Error("variants_required");
  }
  const count = args.count != null ? Number(args.count) : raw.length;
  if (!Number.isFinite(count) || count < 1) throw new Error("invalid_count");
  if (count > MAX) throw new Error(`max_variants_${MAX}`);
  if (raw.length < count) throw new Error("variants_count_mismatch");

  const variants = raw.slice(0, count).map((v, i) => {
    const primary_text = v?.primary_text ?? v?.message ?? v?.body ?? v?.text;
    if (primary_text == null || !String(primary_text).trim()) {
      throw new Error(`variant_${i}_missing_primary_text`);
    }
    return {
      primary_text: String(primary_text).trim(),
      headline: v?.headline != null ? String(v.headline).trim() : (v?.title != null ? String(v.title).trim() : null),
      description: v?.description != null ? String(v.description).trim() : null,
      name: v?.name != null ? String(v.name).trim() : null,
    };
  });
  return variants;
}

/** Build a compact source-ad summary for Carmen / approval UI. */
export function summarizeSourceAd(ad, creative) {
  const spec = creative?.object_story_spec || null;
  const feed = creative?.asset_feed_spec || null;
  const linkData = spec?.link_data || spec?.video_data || spec?.photo_data || null;
  return {
    ad_id: ad?.id || null,
    ad_name: ad?.name || null,
    adset_id: ad?.adset_id || null,
    campaign_id: ad?.campaign_id || null,
    account_id: ad?.account_id ? String(ad.account_id).replace(/^act_/, "") : null,
    status: ad?.status || null,
    effective_status: ad?.effective_status || null,
    creative_id: creative?.id || ad?.creative?.id || null,
    page_id: extractPageId(spec),
    lead_form_id: extractLeadFormId(spec),
    current_primary_text: linkData?.message || feed?.bodies?.[0]?.text || null,
    current_headline: linkData?.name || linkData?.title || feed?.titles?.[0]?.text || null,
    has_object_story_spec: !!spec,
    has_asset_feed_spec: !!feed,
    image_hash: linkData?.image_hash || null,
    video_id: linkData?.video_id || null,
  };
}
