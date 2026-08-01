import { useCallback, useEffect, useState } from "react";
import {
  SEO_KEYWORD_RELEVANCE_EVENT,
  loadSeoForceIrrelevant,
  loadSeoForceRelevant,
  seoForceListStorageKey,
  type SeoKeywordRelevanceChangedDetail,
} from "@/lib/seoKeywordRelevance";

/**
 * Live manual relevance overrides for a client (same localStorage keys as
 * SeoKeywordsTable). Updates when the user marks a keyword relevant/irrelevant
 * on the positions table, including same-tab custom events and cross-tab storage.
 */
export function useSeoKeywordRelevance(persistKey: string | undefined) {
  const [forceRelevant, setForceRelevant] = useState<string[]>(() =>
    loadSeoForceRelevant(persistKey),
  );
  const [forceIrrelevant, setForceIrrelevant] = useState<string[]>(() =>
    loadSeoForceIrrelevant(persistKey),
  );

  const reload = useCallback(() => {
    setForceRelevant(loadSeoForceRelevant(persistKey));
    setForceIrrelevant(loadSeoForceIrrelevant(persistKey));
  }, [persistKey]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (!persistKey || typeof window === "undefined") return;

    const onCustom = (event: Event) => {
      const detail = (event as CustomEvent<SeoKeywordRelevanceChangedDetail>).detail;
      if (detail?.persistKey && detail.persistKey !== persistKey) return;
      reload();
    };

    const onStorage = (event: StorageEvent) => {
      if (!event.key) return;
      const relevantKey = seoForceListStorageKey(persistKey, "relevant");
      const irrelevantKey = seoForceListStorageKey(persistKey, "irrelevant");
      if (event.key !== relevantKey && event.key !== irrelevantKey) return;
      reload();
    };

    // Re-read when returning to the tab (e.g. marked irrelevant, then opened monthly work).
    const onVisible = () => {
      if (document.visibilityState === "visible") reload();
    };

    window.addEventListener(SEO_KEYWORD_RELEVANCE_EVENT, onCustom);
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener(SEO_KEYWORD_RELEVANCE_EVENT, onCustom);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [persistKey, reload]);

  return { forceRelevant, forceIrrelevant, reload };
}
