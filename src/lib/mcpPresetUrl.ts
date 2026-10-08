type ViteSupabaseEnv = {
  VITE_SUPABASE_URL?: string;
};

/** MCP preset URLs must follow the app's current Supabase project, not hardcoded prod. */
export function mcpPresetBaseUrl(
  env: ViteSupabaseEnv = (import.meta as { env?: ViteSupabaseEnv }).env || {},
): string {
  const fromUrl = String(env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
  return fromUrl;
}

export function mcpPresetFunctionUrl(
  fn: string,
  env?: ViteSupabaseEnv,
): string {
  return `${mcpPresetBaseUrl(env)}/functions/v1/${fn}`;
}
