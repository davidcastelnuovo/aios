/** Re-export for Deno edge functions. Implementation in fb-ad-duplicate.mjs (Node-testable). */
export {
  deepClone,
  extractLeadFormId,
  extractPageId,
  applyVariantToObjectStorySpec,
  applyVariantToAssetFeedSpec,
  normalizeAdCopyVariants,
  summarizeSourceAd,
} from './fb-ad-duplicate.mjs';
