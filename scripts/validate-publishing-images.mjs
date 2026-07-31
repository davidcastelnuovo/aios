#!/usr/bin/env node
/**
 * Deterministic validation for PBN magazine image URL resolution.
 * Mirrors publishing-feed behavior without mutating production data.
 */
import {
  extractEntityAttachmentPath,
  resolveMagazineImageUrl,
} from "../supabase/functions/_shared/publishing-images.ts";

const cases = [
  {
    name: "live relative hero",
    input: "/images/gold-appraisal-hero.webp",
    expect: null,
  },
  {
    name: "live relative inline",
    input: "/images/gold-appraisal-process.webp",
    expect: null,
  },
  {
    name: "private bucket public URL becomes signed",
    input:
      "https://zvoijyneresvkadpprel.supabase.co/storage/v1/object/public/entity-attachments/11111111-1111-1111-1111-111111111111/publishing/abc/hero.webp",
    expectPrefix: "https://example.test/sign/",
  },
  {
    name: "external pexels passthrough",
    input: "https://images.pexels.com/photos/31428953/pexels-photo-31428953.jpeg",
    expect:
      "https://images.pexels.com/photos/31428953/pexels-photo-31428953.jpeg",
  },
];

const signer = async (bucket, path, ttl) => {
  if (bucket !== "entity-attachments") return null;
  return `https://example.test/sign/${path}?ttl=${ttl}`;
};

let failed = 0;
for (const testCase of cases) {
  const path = extractEntityAttachmentPath(testCase.input);
  const resolved = await resolveMagazineImageUrl(testCase.input, signer);
  const ok = testCase.expectPrefix
    ? typeof resolved === "string" && resolved.startsWith(testCase.expectPrefix)
    : resolved === testCase.expect;
  if (!ok) {
    failed += 1;
    console.error("FAIL", testCase.name, { input: testCase.input, path, resolved });
  } else {
    console.log("ok", testCase.name, "->", resolved);
  }
}

const summary = { failed, total: cases.length, ok: failed === 0 };
if (failed) process.exit(1);
console.log("validation passed", summary);
