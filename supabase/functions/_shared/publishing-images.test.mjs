import assert from "node:assert/strict";
import test from "node:test";

import {
  extractEntityAttachmentPath,
  isAbsoluteHttpUrl,
  resolveArticleImageFields,
  resolveMagazineImageUrl,
} from "./publishing-images.ts";

test("rejects relative and empty magazine image URLs", async () => {
  const signer = async () => {
    throw new Error("signer should not run for relative urls");
  };
  assert.equal(isAbsoluteHttpUrl("/images/gold-appraisal-hero.webp"), false);
  assert.equal(await resolveMagazineImageUrl("/images/gold-appraisal-hero.webp", signer), null);
  assert.equal(await resolveMagazineImageUrl("/images/gold-appraisal-process.webp", signer), null);
  assert.equal(await resolveMagazineImageUrl("", signer), null);
  assert.equal(await resolveMagazineImageUrl(null, signer), null);
});

test("extracts entity-attachments paths from public and signed URLs", () => {
  const path = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/publishing/article-1/hero.webp";
  const publicUrl =
    `https://zvoijyneresvkadpprel.supabase.co/storage/v1/object/public/entity-attachments/${path}`;
  const signedUrl =
    `https://zvoijyneresvkadpprel.supabase.co/storage/v1/object/sign/entity-attachments/${path}?token=abc`;
  assert.equal(extractEntityAttachmentPath(publicUrl), path);
  assert.equal(extractEntityAttachmentPath(signedUrl), path);
  assert.equal(extractEntityAttachmentPath(path), path);
  assert.equal(extractEntityAttachmentPath(`entity-attachments/${path}`), path);
  assert.equal(extractEntityAttachmentPath("https://images.pexels.com/photo.jpg"), null);
});

test("signs private entity-attachments URLs for anonymous magazine access", async () => {
  const path = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/publishing/article-1/hero.webp";
  const publicUrl =
    `https://zvoijyneresvkadpprel.supabase.co/storage/v1/object/public/entity-attachments/${path}`;
  const calls = [];
  const signed = await resolveMagazineImageUrl(publicUrl, async (bucket, objectPath, ttl) => {
    calls.push({ bucket, objectPath, ttl });
    return `https://signed.example/${objectPath}?exp=${ttl}`;
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].bucket, "entity-attachments");
  assert.equal(calls[0].objectPath, path);
  assert.match(signed, /^https:\/\/signed\.example\//);
});

test("passes through external absolute URLs unchanged", async () => {
  const external = "https://images.pexels.com/photos/31428953/pexels-photo-31428953.jpeg";
  const result = await resolveMagazineImageUrl(external, async () => {
    throw new Error("should not sign external urls");
  });
  assert.equal(result, external);
});

test("resolves article hero+inline fields together and drops invalid ones", async () => {
  const path = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/publishing/article-1/inline.webp";
  const article = await resolveArticleImageFields(
    {
      hero_image_url: "/images/gold-appraisal-hero.webp",
      inline_image_url:
        `https://zvoijyneresvkadpprel.supabase.co/storage/v1/object/public/entity-attachments/${path}`,
    },
    async (_bucket, objectPath) => `https://signed.example/${objectPath}`,
  );
  assert.equal(article.hero_image_url, null);
  assert.equal(article.inline_image_url, `https://signed.example/${path}`);
});

test("sign failure fails closed to null", async () => {
  const path = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/publishing/article-1/hero.webp";
  const publicUrl =
    `https://zvoijyneresvkadpprel.supabase.co/storage/v1/object/public/entity-attachments/${path}`;
  const result = await resolveMagazineImageUrl(publicUrl, async () => null);
  assert.equal(result, null);
});
