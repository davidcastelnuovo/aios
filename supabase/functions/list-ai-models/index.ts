// Returns the catalog of AI models available for selection as an agent "brain".
// Single source of truth is _shared/models.ts (Anthropic Claude catalog).
import { corsHeaders } from '../_shared/cors.ts';
import { MODEL_CATALOG } from '../_shared/models.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  return new Response(JSON.stringify({ models: MODEL_CATALOG, source: 'catalog' }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
