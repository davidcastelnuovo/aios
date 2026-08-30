import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isInternalMcpUrl, isMcpAuthError, secretForConnectionName } from "./mcp-bearer.ts";

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
