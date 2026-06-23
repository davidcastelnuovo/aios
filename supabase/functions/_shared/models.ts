// Shared AI model catalog for run-ai-agent + list-ai-models edge fn.
// Single source of truth for available "brains".
//
// Provider: Anthropic Claude (native Messages API), via _shared/ai-gateway.ts.
// (Migrated off the Lovable AI Gateway — see CLAUDE.md "de-Lovable" notes.)

export type ModelFamily = 'anthropic';

export interface ModelDef {
  id: string;          // Anthropic model id (e.g. 'claude-opus-4-8')
  alias?: string;      // short alias used by agent.engine column (e.g. 'opus')
  label: string;       // display name
  family: ModelFamily;
  context_window?: number;
  capabilities?: ('text' | 'vision' | 'image' | 'tools')[];
  isLatest?: boolean;
  recommended?: boolean;
  cheap?: boolean;
}

export const DEFAULT_MODEL = 'claude-opus-4-8';
export const CHEAP_MODEL = 'claude-haiku-4-5';
export const MID_MODEL = 'claude-sonnet-4-6';

export const MODEL_CATALOG: ModelDef[] = [
  { id: 'claude-opus-4-8', alias: 'opus', label: 'Claude Opus 4.8', family: 'anthropic', context_window: 1_000_000, capabilities: ['text', 'vision', 'tools'], isLatest: true, recommended: true },
  { id: 'claude-opus-4-7', alias: 'opus-4-7', label: 'Claude Opus 4.7', family: 'anthropic', context_window: 1_000_000, capabilities: ['text', 'vision', 'tools'] },
  { id: 'claude-sonnet-4-6', alias: 'sonnet', label: 'Claude Sonnet 4.6', family: 'anthropic', context_window: 1_000_000, capabilities: ['text', 'vision', 'tools'] },
  { id: 'claude-haiku-4-5', alias: 'haiku', label: 'Claude Haiku 4.5', family: 'anthropic', context_window: 200_000, capabilities: ['text', 'vision', 'tools'], cheap: true },
];

/**
 * Resolve agent.engine (alias OR full id OR legacy value) → Anthropic model id.
 *
 * Legacy values (gemini-*, gpt-*, manus-*, the old google/* and openai/* gateway
 * ids) are mapped by tier so existing agents keep sensible behaviour after the
 * migration off the Lovable gateway:
 *   - "cheap"/lite/nano/flash-lite → Haiku 4.5
 *   - mid (flash, gpt-mini)        → Sonnet 4.6
 *   - everything else / unknown    → Opus 4.8 (default)
 */
export function resolveModelId(engine: string | null | undefined): string {
  if (!engine) return DEFAULT_MODEL;
  const e = String(engine).trim();

  // Already a current Anthropic id?
  const direct = MODEL_CATALOG.find(m => m.id === e);
  if (direct) return direct.id;

  // Alias match (opus / sonnet / haiku / opus-4-7)
  const byAlias = MODEL_CATALOG.find(m => m.alias === e);
  if (byAlias) return byAlias.id;

  // Explicit legacy → Claude mappings
  const legacy: Record<string, string> = {
    // old Lovable gateway ids
    'google/gemini-3-flash-preview': DEFAULT_MODEL,
    'google/gemini-3.1-flash-lite-preview': CHEAP_MODEL,
    'google/gemini-3.5-flash': MID_MODEL,
    'google/gemini-3.1-pro-preview': DEFAULT_MODEL,
    'google/gemini-2.5-pro': DEFAULT_MODEL,
    'google/gemini-2.5-flash': MID_MODEL,
    'google/gemini-2.5-flash-lite': CHEAP_MODEL,
    'openai/gpt-5': DEFAULT_MODEL,
    'openai/gpt-5-mini': MID_MODEL,
    'openai/gpt-5-nano': CHEAP_MODEL,
    'openai/gpt-5.4': DEFAULT_MODEL,
    'openai/gpt-5.5': DEFAULT_MODEL,
    // short aliases used historically by agent.engine
    'gemini-3-flash': DEFAULT_MODEL,
    'gemini-3.1-flash-lite': CHEAP_MODEL,
    'gemini-3.5-flash': MID_MODEL,
    'gemini-3.1-pro': DEFAULT_MODEL,
    'gemini-3-pro': DEFAULT_MODEL,
    'gemini-2.5-pro': DEFAULT_MODEL,
    'gemini-2.5-flash': MID_MODEL,
    'gemini-2.5-flash-lite': CHEAP_MODEL,
    'gemini-1.5-flash': MID_MODEL,
    'gpt-5': DEFAULT_MODEL,
    'gpt-5-mini': MID_MODEL,
    'gpt-5-nano': CHEAP_MODEL,
    'gpt-5.4': DEFAULT_MODEL,
    'gpt-5.5': DEFAULT_MODEL,
    'manus-1.6': DEFAULT_MODEL,
    'manus-1.6-max': DEFAULT_MODEL,
    'manus-1.6-lite': CHEAP_MODEL,
    'claude-sonnet': MID_MODEL,
  };
  if (legacy[e]) return legacy[e];

  // Heuristic fallback for anything unseen
  if (/lite|nano|mini|flash-lite|cheap|haiku/i.test(e)) return CHEAP_MODEL;
  return DEFAULT_MODEL;
}
