// Returns the catalog of AI models available for selection as an agent "brain".
// Tries live gateway, falls back to MODEL_CATALOG.
import { corsHeaders } from '../_shared/cors.ts';
import { MODEL_CATALOG, type ModelDef } from '../_shared/models.ts';

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

let cache: { at: number; models: ModelDef[] } | null = null;
const CACHE_MS = 60 * 60 * 1000; // 1h

async function tryFetchLive(): Promise<ModelDef[] | null> {
  if (!LOVABLE_API_KEY) return null;
  try {
    const r = await fetch('https://ai.gateway.lovable.dev/v1/models', {
      headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}` },
    });
    if (!r.ok) return null;
    const j = await r.json();
    const arr: any[] = j?.data || j?.models || [];
    if (!Array.isArray(arr) || arr.length === 0) return null;

    // Merge: keep catalog metadata, add any new models discovered.
    const known = new Map(MODEL_CATALOG.map(m => [m.id, m]));
    const result: ModelDef[] = [];
    for (const item of arr) {
      const id: string = item?.id || item?.model;
      if (!id || typeof id !== 'string') continue;
      const meta = known.get(id);
      if (meta) {
        result.push({ ...meta, isLatest: true });
      } else {
        // Newly discovered model
        const family: any = id.startsWith('google/') ? 'google'
          : id.startsWith('openai/') ? 'openai'
          : id.startsWith('anthropic/') ? 'anthropic'
          : 'google';
        // Filter out image/embedding-only models
        if (/embed|image/.test(id)) continue;
        result.push({
          id,
          label: id.split('/').pop() || id,
          family,
          isLatest: true,
          capabilities: ['text','tools'],
        });
      }
    }
    // Append catalog items missing from live list (so UI still shows everything).
    for (const m of MODEL_CATALOG) {
      if (!result.find(r => r.id === m.id)) result.push(m);
    }
    return result;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  if (cache && Date.now() - cache.at < CACHE_MS) {
    return new Response(JSON.stringify({ models: cache.models, source: 'cache' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const live = await tryFetchLive();
  const models = live ?? MODEL_CATALOG;
  cache = { at: Date.now(), models };

  return new Response(JSON.stringify({ models, source: live ? 'live' : 'catalog' }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
