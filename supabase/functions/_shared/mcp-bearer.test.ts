import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  canonicalInternalMcpUrl,
  isInternalMcpUrl,
  isMcpAuthError,
  isMcpTimeoutError,
  mcpRpcTimeoutMs,
  MCP_RPC_TIMEOUT_DEFAULT_MS,
  MCP_RPC_TIMEOUT_TOOLS_CALL_MS,
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

Deno.test("mcpRpcTimeoutMs gives tools/call a long budget", () => {
  assertEquals(mcpRpcTimeoutMs("initialize"), MCP_RPC_TIMEOUT_DEFAULT_MS);
  assertEquals(mcpRpcTimeoutMs("tools/list"), MCP_RPC_TIMEOUT_DEFAULT_MS);
  assertEquals(mcpRpcTimeoutMs("tools/call"), MCP_RPC_TIMEOUT_TOOLS_CALL_MS);
  assertEquals(mcpRpcTimeoutMs("tools/call", 45_000), 45_000);
});

Deno.test("isMcpTimeoutError detects abort/timeout shapes", () => {
  const abort = new Error("The operation was aborted due to timeout");
  (abort as Error & { name: string }).name = "TimeoutError";
  assertEquals(isMcpTimeoutError(abort), true);
  assertEquals(isMcpTimeoutError(new Error("signal timed out")), true);
  assertEquals(isMcpTimeoutError(new Error("MCP 500: boom")), false);
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
