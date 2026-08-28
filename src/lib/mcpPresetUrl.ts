type ViteSupabaseEnv = {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PROJECT_ID?: string;
};

/** MCP preset URLs must follow the app's current Supabase project, not hardcoded prod. */
export function mcpPresetBaseUrl(env: ViteSupabaseEnv = (import.meta as { env?: ViteSupabaseEnv }).env || {}): string {
  const fromUrl = String(env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
  if (fromUrl.startsWith("https://") && fromUrl.includes(".supabase.co")) return fromUrl;
  const ref = String(env.VITE_SUPABASE_PROJECT_ID || "zvoijyneresvkadpprel");
  return `https://${ref}.supabase.co`;
}

export function mcpPresetFunctionUrl(
  fn: string,
  env?: ViteSupabaseEnv,
): string {
  return `${mcpPresetBaseUrl(env)}/functions/v1/${fn}`;
}
