#!/usr/bin/env node
/**
 * Deterministic validation for PBN magazine image URL resolution.
 * Mirrors publishing-feed behavior without mutating production data.
 */
import {
  publishingImageProxyUrl,
  resolveMagazineImageUrl,
} from "../supabase/functions/_shared/publishing-images.ts";

const SUPABASE_URL = "https://zvoijyneresvkadpprel.supabase.co";
const ARTICLE = "c3ee1a9c-1111-2222-3333-444455556666";
const TENANT = "2dcdaac6-41bf-42cc-86bf-9a0b4b2e6019";
const proxyFor = (kind) => publishingImageProxyUrl(SUPABASE_URL, ARTICLE, kind);

const cases = [
  { name: "live relative hero", input: "/images/gold-appraisal-hero.webp", kind: "hero", expect: null },
  { name: "live relative inline", input: "/images/gold-appraisal-process.webp", kind: "inline", expect: null },
  {
    name: "private storage hero becomes stable proxy URL",
    input: `${SUPABASE_URL}/storage/v1/object/public/entity-attachments/${TENANT}/publishing/${ARTICLE}/hero.webp`,
    kind: "hero",
    expect: proxyFor("hero"),
  },
  {
    name: "external pexels passthrough",
    input: "https://images.pexels.com/photos/31428953/pexels-photo-31428953.jpeg",
    kind: "hero",
    expect: "https://images.pexels.com/photos/31428953/pexels-photo-31428953.jpeg",
  },
  { name: "proxy URL stays stable", input: proxyFor("inline"), kind: "inline", expect: proxyFor("inline") },
];

let failed = 0;
for (const testCase of cases) {
  const resolved = resolveMagazineImageUrl(testCase.input, testCase.kind, proxyFor);
  if (resolved !== testCase.expect) {
    failed += 1;
    console.error("FAIL", testCase.name, { input: testCase.input, resolved, expected: testCase.expect });
  } else {
    console.log("ok", testCase.name, "->", resolved);
  }
}

if (failed) process.exit(1);
console.log("validation passed", { failed, total: cases.length });
