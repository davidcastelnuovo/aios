import assert from "node:assert/strict";
import test from "node:test";
import { mcpPresetBaseUrl, mcpPresetFunctionUrl } from "./mcpPresetUrl.ts";

test("MCP presets follow staging VITE_SUPABASE_URL", () => {
  const env = {
    VITE_SUPABASE_URL: "https://mzjsuvatrzhciojmbbbm.supabase.co",
    VITE_SUPABASE_PROJECT_ID: "mzjsuvatrzhciojmbbbm",
  };
  assert.equal(mcpPresetBaseUrl(env), "https://mzjsuvatrzhciojmbbbm.supabase.co");
  assert.equal(
    mcpPresetFunctionUrl("cursor-mcp", env),
    "https://mzjsuvatrzhciojmbbbm.supabase.co/functions/v1/cursor-mcp",
  );
});

test("MCP presets fall back to production project ref", () => {
  assert.equal(mcpPresetBaseUrl({}), "https://zvoijyneresvkadpprel.supabase.co");
  assert.equal(
    mcpPresetFunctionUrl("cursor-mcp", {}),
    "https://zvoijyneresvkadpprel.supabase.co/functions/v1/cursor-mcp",
  );
});
