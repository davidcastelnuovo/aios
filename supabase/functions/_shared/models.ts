// Shared AI model catalog for run-ai-agent + list-ai-models edge fn.
// Single source of truth for available "brains".

export type ModelFamily = 'google' | 'openai' | 'anthropic';

export interface ModelDef {
  id: string;          // gateway model id (e.g. 'google/gemini-3-flash-preview')
  alias?: string;      // short alias used by agent.engine column (e.g. 'gemini-3-flash')
  label: string;       // display name
  family: ModelFamily;
  context_window?: number;
  capabilities?: ('text' | 'vision' | 'image' | 'tools')[];
  isLatest?: boolean;
  recommended?: boolean;
  cheap?: boolean;
}

export const MODEL_CATALOG: ModelDef[] = [
  // ===== Google Gemini =====
  { id: 'google/gemini-3-flash-preview', alias: 'gemini-3-flash', label: 'Gemini 3 Flash (Preview)', family: 'google', context_window: 1_000_000, capabilities: ['text','vision','tools'], isLatest: true, recommended: true },
  { id: 'google/gemini-3.1-flash-lite-preview', alias: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite (Preview)', family: 'google', isLatest: true, cheap: true, capabilities: ['text','tools'] },
  { id: 'google/gemini-3.5-flash', alias: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash', family: 'google', isLatest: true, capabilities: ['text','vision','tools'] },
  { id: 'google/gemini-3.1-pro-preview', alias: 'gemini-3.1-pro', label: 'Gemini 3.1 Pro (Preview)', family: 'google', isLatest: true, capabilities: ['text','vision','tools'] },
  { id: 'google/gemini-2.5-pro', alias: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', family: 'google', capabilities: ['text','vision','tools'] },
  { id: 'google/gemini-2.5-flash', alias: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', family: 'google', capabilities: ['text','vision','tools'] },
  { id: 'google/gemini-2.5-flash-lite', alias: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite', family: 'google', cheap: true, capabilities: ['text','tools'] },
  // ===== OpenAI =====
  { id: 'openai/gpt-5', alias: 'gpt-5', label: 'GPT-5', family: 'openai', capabilities: ['text','vision','tools'] },
  { id: 'openai/gpt-5-mini', alias: 'gpt-5-mini', label: 'GPT-5 Mini', family: 'openai', capabilities: ['text','tools'] },
  { id: 'openai/gpt-5-nano', alias: 'gpt-5-nano', label: 'GPT-5 Nano', family: 'openai', cheap: true, capabilities: ['text','tools'] },
  { id: 'openai/gpt-5.2', alias: 'gpt-5.2', label: 'GPT-5.2', family: 'openai', capabilities: ['text','tools'] },
  { id: 'openai/gpt-5.4', alias: 'gpt-5.4', label: 'GPT-5.4', family: 'openai', isLatest: true, capabilities: ['text','vision','tools'] },
  { id: 'openai/gpt-5.4-mini', alias: 'gpt-5.4-mini', label: 'GPT-5.4 Mini', family: 'openai', isLatest: true, capabilities: ['text','tools'] },
  { id: 'openai/gpt-5.4-nano', alias: 'gpt-5.4-nano', label: 'GPT-5.4 Nano', family: 'openai', isLatest: true, cheap: true, capabilities: ['text','tools'] },
  { id: 'openai/gpt-5.4-pro', alias: 'gpt-5.4-pro', label: 'GPT-5.4 Pro', family: 'openai', isLatest: true, capabilities: ['text','vision','tools'] },
  { id: 'openai/gpt-5.5', alias: 'gpt-5.5', label: 'GPT-5.5', family: 'openai', isLatest: true, capabilities: ['text','vision','tools'] },
  { id: 'openai/gpt-5.5-pro', alias: 'gpt-5.5-pro', label: 'GPT-5.5 Pro', family: 'openai', isLatest: true, capabilities: ['text','vision','tools'] },
  // ===== Anthropic Claude (via the tenant's anthropic_api_key, OpenAI-compatible endpoint) =====
  { id: 'anthropic/claude-sonnet-4-6', alias: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', family: 'anthropic', context_window: 200_000, capabilities: ['text','vision','tools'], isLatest: true, recommended: true },
  { id: 'anthropic/claude-opus-4-8', alias: 'claude-opus-4-8', label: 'Claude Opus 4.8', family: 'anthropic', context_window: 200_000, capabilities: ['text','vision','tools'], isLatest: true },
  { id: 'anthropic/claude-haiku-4-5-20251001', alias: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', family: 'anthropic', context_window: 200_000, capabilities: ['text','tools'], cheap: true },
];

/**
 * Resolve agent.engine (alias OR full id OR legacy value) → gateway model id.
 * Falls back to default Gemini 3 Flash.
 */
export function resolveModelId(engine: string | null | undefined): string {
  if (!engine) return 'google/gemini-3-flash-preview';
  // Already a full id?
  const direct = MODEL_CATALOG.find(m => m.id === engine);
  if (direct) return direct.id;
  // Alias match
  const byAlias = MODEL_CATALOG.find(m => m.alias === engine);
  if (byAlias) return byAlias.id;
  // Legacy mappings
  const legacy: Record<string, string> = {
    'gemini-1.5-flash': 'google/gemini-2.5-flash',
    'gemini-3-pro': 'google/gemini-3.1-pro-preview',
    'manus-1.6': 'google/gemini-3-flash-preview',
    'manus-1.6-max': 'google/gemini-2.5-pro',
    'manus-1.6-lite': 'google/gemini-2.5-flash-lite',
    'claude-sonnet': 'anthropic/claude-sonnet-4-6',
  };
  return legacy[engine] || 'google/gemini-3-flash-preview';
}
