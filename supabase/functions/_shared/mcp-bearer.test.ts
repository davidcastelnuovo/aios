import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  canonicalInternalMcpUrl,
  isInternalMcpUrl,
  isMcpAuthError,
  repointInternalMcpUrlIfNeeded,
  secretForConnectionName,
} from "./mcp-bearer.ts";

Deno.test("isInternalMcpUrl accepts supabase edge functions", () => {
  assertEquals(
    isInternalMcpUrl("https://zvoijyneresvkadpprel.supabase.co/functions/v1/cursor-mcp"),
    true,
  );
  assertEquals(isInternalMcpUrl("https://example.com/mcp"), false);
});

Deno.test("secretForConnectionName maps presets", () => {
  Deno.env.set("CURSOR_MCP_BEARER", "test-bearer");
  assertEquals(secretForConnectionName("Cursor"), "test-bearer");
  Deno.env.delete("CURSOR_MCP_BEARER");
});

Deno.test("isMcpAuthError detects bearer failures", () => {
  assertEquals(isMcpAuthError({ status: 401, message: "nope" }), true);
  assertEquals(isMcpAuthError(new Error("Unauthorized: invalid or missing bearer token")), true);
  assertEquals(isMcpAuthError(new Error("timeout")), false);
});

Deno.test("repointInternalMcpUrlIfNeeded fixes cloned prod host on staging", () => {
  const staging = "https://mzjsuvatrzhciojmbbbm.supabase.co";
  const prodUrl = "https://zvoijyneresvkadpprel.supabase.co/functions/v1/cursor-mcp";
  assertEquals(
    repointInternalMcpUrlIfNeeded("Cursor", prodUrl, staging),
    `${staging}/functions/v1/cursor-mcp`,
  );
  assertEquals(
    repointInternalMcpUrlIfNeeded("Cursor", `${staging}/functions/v1/cursor-mcp`, staging),
    `${staging}/functions/v1/cursor-mcp`,
  );
  assertEquals(canonicalInternalMcpUrl("Grok", staging), `${staging}/functions/v1/grok-mcp`);
});
