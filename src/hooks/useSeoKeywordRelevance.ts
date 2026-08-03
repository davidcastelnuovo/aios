import { useCallback, useEffect, useState } from "react";
import {
  SEO_KEYWORD_RELEVANCE_EVENT,
  loadSeoForceIrrelevant,
  loadSeoForceRelevant,
  normalizeKeywordPhrase,
  saveSeoForceIrrelevant,
  saveSeoForceRelevant,
  seoForceListStorageKey,
  type SeoKeywordRelevanceChangedDetail,
} from "@/lib/seoKeywordRelevance";
import {
  isSeoRelevanceClientId,
  loadAndMigrateClientSeoKeywordRelevance,
  saveClientSeoKeywordRelevance,
  type SeoKeywordRelevanceLists,
} from "@/lib/seoKeywordRelevanceServer";

type Options = {
  /** Server-provided lists (e.g. public share payload). */
  initialForceRelevant?: string[];
  initialForceIrrelevant?: string[];
  /** Public share: apply lists but never write. */
  readOnly?: boolean;
};

/**
 * Manual relevance overrides for a client.
 * - Authenticated + client UUID: load/save `clients.seo_keyword_relevance` (source of truth),
 *   with localStorage as cache + one-time migration.
 * - Public/readOnly: use server-provided initial lists only.
 */
export function useSeoKeywordRelevance(
  persistKey: string | undefined,
  options?: Options,
) {
  const readOnly = !!options?.readOnly;
  const isClientId = isSeoRelevanceClientId(persistKey);
  // Explicit props (including empty arrays) win over localStorage — critical for
  // public share links so a viewer's browser cache never overrides the server list.
  const hasProvidedLists =
    options?.initialForceRelevant !== undefined ||
    options?.initialForceIrrelevant !== undefined;

  const [forceRelevant, setForceRelevant] = useState<string[]>(() => {
    if (options?.initialForceRelevant !== undefined) return options.initialForceRelevant;
    if (readOnly) return [];
    return loadSeoForceRelevant(persistKey);
  });
  const [forceIrrelevant, setForceIrrelevant] = useState<string[]>(() => {
    if (options?.initialForceIrrelevant !== undefined) return options.initialForceIrrelevant;
    if (readOnly) return [];
    return loadSeoForceIrrelevant(persistKey);
  });
  const [ready, setReady] = useState(
    () => readOnly || hasProvidedLists || !isClientId,
  );

  const applyLists = useCallback((lists: SeoKeywordRelevanceLists) => {
    setForceRelevant(lists.forceRelevant);
    setForceIrrelevant(lists.forceIrrelevant);
  }, []);

  const reload = useCallback(() => {
    if (readOnly || hasProvidedLists) {
      applyLists({
        forceRelevant: options?.initialForceRelevant ?? [],
        forceIrrelevant: options?.initialForceIrrelevant ?? [],
      });
      setReady(true);
      return;
    }
    if (isClientId && persistKey) {
      void loadAndMigrateClientSeoKeywordRelevance(persistKey)
        .then((lists) => {
          applyLists(lists);
          setReady(true);
        })
        .catch((err) => {
          console.warn("[useSeoKeywordRelevance] load failed", err);
          applyLists({
            forceRelevant: loadSeoForceRelevant(persistKey),
            forceIrrelevant: loadSeoForceIrrelevant(persistKey),
          });
          setReady(true);
        });
      return;
    }
    applyLists({
      forceRelevant: loadSeoForceRelevant(persistKey),
      forceIrrelevant: loadSeoForceIrrelevant(persistKey),
    });
    setReady(true);
  }, [
    applyLists,
    hasProvidedLists,
    isClientId,
    options?.initialForceIrrelevant,
    options?.initialForceRelevant,
    persistKey,
    readOnly,
  ]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (readOnly || !persistKey || typeof window === "undefined") return;

    const onCustom = (event: Event) => {
      const detail = (event as CustomEvent<SeoKeywordRelevanceChangedDetail>).detail;
      if (detail?.persistKey && detail.persistKey !== persistKey) return;
      // Prefer fresh local cache after same-tab mark; DB write is already done.
      applyLists({
        forceRelevant: loadSeoForceRelevant(persistKey),
        forceIrrelevant: loadSeoForceIrrelevant(persistKey),
      });
    };

    const onStorage = (event: StorageEvent) => {
      if (!event.key) return;
      const relevantKey = seoForceListStorageKey(persistKey, "relevant");
      const irrelevantKey = seoForceListStorageKey(persistKey, "irrelevant");
      if (event.key !== relevantKey && event.key !== irrelevantKey) return;
      reload();
    };

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
  }, [applyLists, persistKey, readOnly, reload]);

  const persistLists = useCallback(
    async (lists: SeoKeywordRelevanceLists) => {
      if (readOnly || !persistKey) return;
      saveSeoForceRelevant(persistKey, lists.forceRelevant);
      saveSeoForceIrrelevant(persistKey, lists.forceIrrelevant);
      if (isClientId) {
        try {
          await saveClientSeoKeywordRelevance(persistKey, lists);
        } catch (err) {
          console.warn("[useSeoKeywordRelevance] save to client failed", err);
        }
      }
    },
    [isClientId, persistKey, readOnly],
  );

  const markRelevant = useCallback(
    (keyword: string) => {
      if (readOnly) return;
      const key = normalizeKeywordPhrase(keyword);
      if (!key) return;
      setForceIrrelevant((prevIrr) => {
        const nextIrr = prevIrr.filter((p) => normalizeKeywordPhrase(p) !== key);
        setForceRelevant((prevRel) => {
          const nextRel = prevRel.some((p) => normalizeKeywordPhrase(p) === key)
            ? prevRel
            : [...prevRel, keyword.trim()];
          void persistLists({ forceRelevant: nextRel, forceIrrelevant: nextIrr });
          return nextRel;
        });
        return nextIrr;
      });
    },
    [persistLists, readOnly],
  );

  const markIrrelevant = useCallback(
    (keyword: string) => {
      if (readOnly) return;
      const key = normalizeKeywordPhrase(keyword);
      if (!key) return;
      setForceRelevant((prevRel) => {
        const nextRel = prevRel.filter((p) => normalizeKeywordPhrase(p) !== key);
        setForceIrrelevant((prevIrr) => {
          const nextIrr = prevIrr.some((p) => normalizeKeywordPhrase(p) === key)
            ? prevIrr
            : [...prevIrr, keyword.trim()];
          void persistLists({ forceRelevant: nextRel, forceIrrelevant: nextIrr });
          return nextIrr;
        });
        return nextRel;
      });
    },
    [persistLists, readOnly],
  );

  return {
    forceRelevant,
    forceIrrelevant,
    ready,
    reload,
    markRelevant,
    markIrrelevant,
    readOnly,
  };
}
