import { supabase } from "@/integrations/supabase/client";
import {
  loadSeoForceIrrelevant,
  loadSeoForceRelevant,
  normalizeKeywordPhrase,
  saveSeoForceIrrelevant,
  saveSeoForceRelevant,
} from "@/lib/seoKeywordRelevance";

export type SeoKeywordRelevanceLists = {
  forceRelevant: string[];
  forceIrrelevant: string[];
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isSeoRelevanceClientId(value: string | undefined | null): boolean {
  return !!value && UUID_RE.test(value);
}

export function parseSeoKeywordRelevance(raw: unknown): SeoKeywordRelevanceLists {
  const empty: SeoKeywordRelevanceLists = { forceRelevant: [], forceIrrelevant: [] };
  if (!raw || typeof raw !== "object") return empty;
  const obj = raw as Record<string, unknown>;
  const normalizeList = (v: unknown): string[] => {
    if (!Array.isArray(v)) return [];
    const out: string[] = [];
    const seen = new Set<string>();
    for (const item of v) {
      const phrase = normalizeKeywordPhrase(String(item || ""));
      if (!phrase || seen.has(phrase)) continue;
      seen.add(phrase);
      out.push(String(item).trim() || phrase);
    }
    return out;
  };
  return {
    forceRelevant: normalizeList(obj.force_relevant ?? obj.forceRelevant),
    forceIrrelevant: normalizeList(obj.force_irrelevant ?? obj.forceIrrelevant),
  };
}

export function seoKeywordRelevancePayload(lists: SeoKeywordRelevanceLists) {
  return {
    force_relevant: lists.forceRelevant,
    force_irrelevant: lists.forceIrrelevant,
  };
}

/** Load overrides from clients.seo_keyword_relevance (authenticated). */
export async function fetchClientSeoKeywordRelevance(
  clientId: string,
): Promise<SeoKeywordRelevanceLists> {
  const { data, error } = await supabase
    .from("clients")
    .select("seo_keyword_relevance")
    .eq("id", clientId)
    .maybeSingle();
  if (error) throw error;
  return parseSeoKeywordRelevance((data as any)?.seo_keyword_relevance);
}

/** Persist overrides on the client row and mirror into localStorage cache. */
export async function saveClientSeoKeywordRelevance(
  clientId: string,
  lists: SeoKeywordRelevanceLists,
): Promise<void> {
  const payload = seoKeywordRelevancePayload(lists);
  const { error } = await supabase
    .from("clients")
    .update({ seo_keyword_relevance: payload } as any)
    .eq("id", clientId);
  if (error) throw error;
  saveSeoForceRelevant(clientId, lists.forceRelevant);
  saveSeoForceIrrelevant(clientId, lists.forceIrrelevant);
}

/**
 * Prefer server lists when present; otherwise migrate localStorage → server once.
 */
export async function loadAndMigrateClientSeoKeywordRelevance(
  clientId: string,
): Promise<SeoKeywordRelevanceLists> {
  const server = await fetchClientSeoKeywordRelevance(clientId);
  const local: SeoKeywordRelevanceLists = {
    forceRelevant: loadSeoForceRelevant(clientId),
    forceIrrelevant: loadSeoForceIrrelevant(clientId),
  };

  const serverEmpty =
    server.forceRelevant.length === 0 && server.forceIrrelevant.length === 0;
  const localHas =
    local.forceRelevant.length > 0 || local.forceIrrelevant.length > 0;

  if (serverEmpty && localHas) {
    try {
      await saveClientSeoKeywordRelevance(clientId, local);
      return local;
    } catch (err) {
      console.warn("[seoKeywordRelevance] migrate local→server failed", err);
      return local;
    }
  }

  // Keep local cache warm for offline / same-tab speed.
  if (!serverEmpty) {
    saveSeoForceRelevant(clientId, server.forceRelevant);
    saveSeoForceIrrelevant(clientId, server.forceIrrelevant);
  }
  return serverEmpty ? local : server;
}
