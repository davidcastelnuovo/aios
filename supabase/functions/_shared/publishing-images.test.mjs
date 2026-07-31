import assert from "node:assert/strict";
import test from "node:test";

import {
  extractEntityAttachmentPath,
  isAbsoluteHttpUrl,
  publishingImageProxyUrl,
  publishingImageStoragePath,
  resolveArticleImageFields,
  resolveMagazineImageUrl,
} from "./publishing-images.ts";

const SUPABASE_URL = "https://zvoijyneresvkadpprel.supabase.co";
const TENANT = "2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019";
const ARTICLE = "c3ee1a9c-1111-2222-3333-444455556666";
const proxyFor = (kind) => publishingImageProxyUrl(SUPABASE_URL, ARTICLE, kind);

test("builds deterministic storage paths and stable proxy URLs", () => {
  assert.equal(
    publishingImageStoragePath(TENANT, ARTICLE, "hero"),
    `${TENANT}/publishing/${ARTICLE}/hero.webp`,
  );
  assert.equal(
    publishingImageProxyUrl(SUPABASE_URL, ARTICLE, "inline"),
    `${SUPABASE_URL}/functions/v1/publishing-image?article_id=${ARTICLE}&kind=inline`,
  );
  assert.equal(
    publishingImageProxyUrl(`${SUPABASE_URL}/`, ARTICLE, "hero"),
    `${SUPABASE_URL}/functions/v1/publishing-image?article_id=${ARTICLE}&kind=hero`,
  );
});

test("rejects relative and empty magazine image URLs", () => {
  assert.equal(isAbsoluteHttpUrl("/images/gold-appraisal-hero.webp"), false);
  assert.equal(resolveMagazineImageUrl("/images/gold-appraisal-hero.webp", "hero", proxyFor), null);
  assert.equal(resolveMagazineImageUrl("/images/gold-appraisal-process.webp", "inline", proxyFor), null);
  assert.equal(resolveMagazineImageUrl("", "hero", proxyFor), null);
  assert.equal(resolveMagazineImageUrl(null, "hero", proxyFor), null);
});

test("extracts entity-attachments paths from public and signed URLs", () => {
  const path = `${TENANT}/publishing/${ARTICLE}/hero.webp`;
  assert.equal(
    extractEntityAttachmentPath(`${SUPABASE_URL}/storage/v1/object/public/entity-attachments/${path}`),
    path,
  );
  assert.equal(
    extractEntityAttachmentPath(`${SUPABASE_URL}/storage/v1/object/sign/entity-attachments/${path}?token=abc`),
    path,
  );
  assert.equal(extractEntityAttachmentPath(path), path);
  assert.equal(extractEntityAttachmentPath(`entity-attachments/${path}`), path);
  assert.equal(extractEntityAttachmentPath("https://images.pexels.com/photo.jpg"), null);
});

test("rewrites private storage URLs to the stable image proxy", () => {
  const path = `${TENANT}/publishing/${ARTICLE}/hero.webp`;
  assert.equal(
    resolveMagazineImageUrl(`${SUPABASE_URL}/storage/v1/object/public/entity-attachments/${path}`, "hero", proxyFor),
    proxyFor("hero"),
  );
  assert.equal(
    resolveMagazineImageUrl(`${SUPABASE_URL}/storage/v1/object/sign/entity-attachments/${path}?token=x`, "hero", proxyFor),
    proxyFor("hero"),
  );
});

test("passes through proxy and external absolute URLs unchanged", () => {
  const external = "https://images.pexels.com/photos/31428953/pexels-photo-31428953.jpeg";
  assert.equal(resolveMagazineImageUrl(external, "hero", proxyFor), external);
  assert.equal(resolveMagazineImageUrl(proxyFor("hero"), "hero", proxyFor), proxyFor("hero"));
});

test("resolves hero and inline fields with their own kinds", () => {
  const article = resolveArticleImageFields(
    {
      hero_image_url: "/images/gold-appraisal-hero.webp",
      inline_image_url:
        `${SUPABASE_URL}/storage/v1/object/public/entity-attachments/${TENANT}/publishing/${ARTICLE}/inline.webp`,
    },
    proxyFor,
  );
  assert.equal(article.hero_image_url, null);
  assert.equal(article.inline_image_url, proxyFor("inline"));
});
