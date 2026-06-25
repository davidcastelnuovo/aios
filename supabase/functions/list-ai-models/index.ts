// Returns the catalog of AI models available for selection as an agent "brain".
// Served from the curated MODEL_CATALOG (no external gateway).
// (redeploy touch: Claude models added to the catalog — see _shared/models.ts)
import { corsHeaders } from '../_shared/cors.ts';
import { MODEL_CATALOG } from '../_shared/models.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  return new Response(JSON.stringify({ models: MODEL_CATALOG, source: 'catalog' }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
