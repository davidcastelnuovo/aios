// ============================================================================
// ai-gateway.ts — single AI provider abstraction for all edge functions.
//
// WHY THIS EXISTS
//   The project was migrated off the Lovable AI Gateway. Every function used to
//   POST an OpenAI-shaped body to https://ai.gateway.lovable.dev/v1/chat/completions.
//   This module keeps that familiar OpenAI-ish call/response shape for our code,
//   but translates to the **native Anthropic Messages API** underneath (Claude),
//   so each call site becomes a near-mechanical one-line change instead of a
//   rewrite of the whole agent loop.
//
// PROVIDER
//   Chat:       Anthropic Messages API  (POST https://api.anthropic.com/v1/messages)
//               -> needs secret ANTHROPIC_API_KEY
//   Embeddings: Anthropic has no embeddings API. We call Google directly
//               (gemini-embedding-001, 1536 dims — matches existing stored vectors)
//               -> needs secret GOOGLE_API_KEY
//
// NOTE Raw HTTP (not the SDK) is used deliberately: the rest of the codebase
//      talks to the model over fetch(), Deno edge npm resolution is finicky, and
//      we need full control over the bidirectional OpenAI<->Anthropic translation.
// ============================================================================

import { resolveModelId, DEFAULT_MODEL } from './models.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY') ?? '';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const EMBED_DIM = 1536;

// ---- OpenAI-ish public types (what our call sites already use) --------------
export type OAIRole = 'system' | 'user' | 'assistant' | 'tool';

export interface OAIToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string }; // arguments is a JSON string
}

export interface OAIMessage {
  role: OAIRole;
  content?: string | any[] | null;       // string, or content parts (incl. images)
  tool_calls?: OAIToolCall[];            // assistant tool calls
  tool_call_id?: string;                 // for role:'tool' results
  name?: string;
}

export interface OAITool {
  type: 'function';
  function: { name: string; description?: string; parameters?: any };
}

export interface ChatRequest {
  model?: string | null;                 // alias / legacy id / full id (resolved)
  messages: OAIMessage[];
  system?: string;                       // optional extra system text
  tools?: OAITool[];
  tool_choice?: 'auto' | 'none' | 'required' | { type: 'function'; function: { name: string } };
  response_format?: { type: 'json_object' | 'text' };
  max_tokens?: number;
  temperature?: number;                  // ignored on Opus 4.8 (kept for call-site compat)
}

export interface ChatResponse {
  choices: Array<{
    message: { role: 'assistant'; content: string | null; tool_calls?: OAIToolCall[] };
    finish_reason: string;
  }>;
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  model: string;
}

// ---- translation: OpenAI content parts -> Anthropic content blocks ----------
function toAnthropicContentParts(content: any): any[] {
  if (content == null) return [];
  if (typeof content === 'string') {
    return content ? [{ type: 'text', text: content }] : [];
  }
  if (!Array.isArray(content)) return [{ type: 'text', text: String(content) }];
  const blocks: any[] = [];
  for (const part of content) {
    if (typeof part === 'string') { blocks.push({ type: 'text', text: part }); continue; }
    if (part?.type === 'text') { blocks.push({ type: 'text', text: part.text ?? '' }); continue; }
    if (part?.type === 'image_url') {
      const url: string = part.image_url?.url ?? part.image_url ?? '';
      const m = /^data:([^;]+);base64,(.*)$/.exec(url);
      if (m) {
        // Anthropic wants PDFs in a `document` block, images in an `image` block.
        const kind = m[1] === 'application/pdf' ? 'document' : 'image';
        blocks.push({ type: kind, source: { type: 'base64', media_type: m[1], data: m[2] } });
      } else if (url) {
        const isPdf = /\.pdf($|\?)/i.test(url);
        blocks.push(isPdf
          ? { type: 'document', source: { type: 'url', url } }
          : { type: 'image', source: { type: 'url', url } });
      }
      continue;
    }
    if (part?.type === 'document' && part.source) { blocks.push(part); continue; }
    if (part?.type === 'image' && part.source) { blocks.push(part); continue; }
  }
  return blocks;
}

// ---- translation: full OpenAI message[] -> { system, messages } -------------
function translateMessages(req: ChatRequest): { system: string; messages: any[] } {
  const systemParts: string[] = [];
  if (req.system?.trim()) systemParts.push(req.system.trim());
  if (req.response_format?.type === 'json_object') {
    systemParts.push('Respond with a single valid JSON object only. No prose, no markdown fences.');
  }

  const out: any[] = [];
  const pushUser = (blocks: any[]) => {
    // merge into previous user turn so tool_results stay grouped
    const last = out[out.length - 1];
    if (last && last.role === 'user') last.content.push(...blocks);
    else out.push({ role: 'user', content: blocks });
  };

  for (const msg of req.messages || []) {
    if (msg.role === 'system') {
      const txt = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content ?? '');
      if (txt?.trim()) systemParts.push(txt.trim());
      continue;
    }
    if (msg.role === 'tool') {
      pushUser([{
        type: 'tool_result',
        tool_use_id: msg.tool_call_id || '',
        content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content ?? ''),
      }]);
      continue;
    }
    if (msg.role === 'assistant') {
      const blocks: any[] = toAnthropicContentParts(msg.content);
      for (const tc of msg.tool_calls || []) {
        let input: any = {};
        try { input = tc.function?.arguments ? JSON.parse(tc.function.arguments) : {}; } catch { input = {}; }
        blocks.push({ type: 'tool_use', id: tc.id, name: tc.function.name, input });
      }
      out.push({ role: 'assistant', content: blocks.length ? blocks : [{ type: 'text', text: '' }] });
      continue;
    }
    // user
    pushUser(toAnthropicContentParts(msg.content));
  }

  // Anthropic requires the first message to be 'user'
  while (out.length && out[0].role !== 'user') out.shift();
  if (out.length === 0) out.push({ role: 'user', content: [{ type: 'text', text: '...' }] });

  return { system: systemParts.join('\n\n'), messages: out };
}

function translateTools(tools?: OAITool[]): any[] | undefined {
  if (!tools?.length) return undefined;
  return tools.map(t => ({
    name: t.function.name,
    description: t.function.description ?? '',
    input_schema: t.function.parameters ?? { type: 'object', properties: {} },
  }));
}

function translateToolChoice(tc?: ChatRequest['tool_choice']): any | undefined {
  if (!tc) return undefined;
  if (tc === 'auto') return { type: 'auto' };
  if (tc === 'none') return { type: 'none' };
  if (tc === 'required') return { type: 'any' };
  if (typeof tc === 'object' && tc.function?.name) return { type: 'tool', name: tc.function.name };
  return undefined;
}

// ---- translation: Anthropic response -> OpenAI-ish response ----------------
function translateResponse(j: any, model: string): ChatResponse {
  const blocks: any[] = Array.isArray(j?.content) ? j.content : [];
  const textParts: string[] = [];
  const toolCalls: OAIToolCall[] = [];
  for (const b of blocks) {
    if (b.type === 'text') textParts.push(b.text ?? '');
    else if (b.type === 'tool_use') {
      toolCalls.push({
        id: b.id,
        type: 'function',
        function: { name: b.name, arguments: JSON.stringify(b.input ?? {}) },
      });
    }
  }
  const stop = j?.stop_reason;
  const finish_reason = stop === 'tool_use' ? 'tool_calls'
    : stop === 'max_tokens' ? 'length'
    : stop === 'end_turn' ? 'stop'
    : (stop || 'stop');
  return {
    choices: [{
      message: {
        role: 'assistant',
        content: textParts.length ? textParts.join('') : null,
        ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
      },
      finish_reason,
    }],
    usage: {
      prompt_tokens: j?.usage?.input_tokens ?? 0,
      completion_tokens: j?.usage?.output_tokens ?? 0,
      total_tokens: (j?.usage?.input_tokens ?? 0) + (j?.usage?.output_tokens ?? 0),
    },
    model,
  };
}

/**
 * chatCompletion — OpenAI-shaped in, OpenAI-shaped out; Claude underneath.
 * Drop-in replacement for the old `fetch(LOVABLE_GATEWAY, ...)` call sites.
 * Retries 429/5xx with exponential backoff.
 */
export async function chatCompletion(req: ChatRequest): Promise<ChatResponse> {
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not configured');
  const model = resolveModelId(req.model) || DEFAULT_MODEL;
  const { system, messages } = translateMessages(req);

  const body: Record<string, any> = {
    model,
    max_tokens: req.max_tokens ?? 8192,
    messages,
  };
  if (system) body.system = system;
  const tools = translateTools(req.tools);
  if (tools) body.tools = tools;
  const toolChoice = translateToolChoice(req.tool_choice);
  if (toolChoice) body.tool_choice = toolChoice;
  // NB: temperature / top_p are intentionally dropped — rejected on Opus 4.8.

  let lastErr: any = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const r = await fetch(ANTHROPIC_URL, {
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': ANTHROPIC_VERSION,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      if (r.ok) return translateResponse(await r.json(), model);
      const errText = await r.text();
      // retry on rate limit / overloaded / server error
      if (r.status === 429 || r.status === 529 || r.status >= 500) {
        lastErr = new Error(`Anthropic ${r.status}: ${errText}`);
        await new Promise(res => setTimeout(res, 500 * 2 ** attempt));
        continue;
      }
      throw new Error(`Anthropic ${r.status}: ${errText}`);
    } catch (e) {
      lastErr = e;
      if (attempt === 3) break;
      await new Promise(res => setTimeout(res, 500 * 2 ** attempt));
    }
  }
  throw lastErr ?? new Error('Anthropic request failed');
}

/**
 * createEmbedding — 1536-dim embedding via Google (gemini-embedding-001),
 * matching the dimension of vectors already stored in the DB.
 * Returns null on any failure (callers treat embeddings as best-effort).
 */
export async function createEmbedding(text: string): Promise<number[] | null> {
  if (!GOOGLE_API_KEY || !text?.trim()) return null;
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${GOOGLE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: 'models/gemini-embedding-001',
          content: { parts: [{ text: text.slice(0, 8000) }] },
          outputDimensionality: EMBED_DIM,
        }),
      },
    );
    if (!r.ok) return null;
    const j = await r.json();
    const values = j?.embedding?.values;
    return Array.isArray(values) ? values : null;
  } catch {
    return null;
  }
}

// Convenience: extract assistant text from a ChatResponse.
export function responseText(res: ChatResponse): string {
  return res.choices?.[0]?.message?.content ?? '';
}
