// Minimal Streamable HTTP MCP transport for Grok Bot and other remote MCP clients.
// Spec: https://modelcontextprotocol.io/specification/2025-03-26/basic/transports#streamable-http

export type McpRpcMessage = {
  jsonrpc?: string;
  id?: unknown;
  method?: string;
  params?: Record<string, unknown>;
};

export type McpRpcHandler = (msg: McpRpcMessage) => Promise<Response>;

const STREAMABLE_CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, accept, mcp-session-id, mcp-protocol-version",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Expose-Headers": "Mcp-Session-Id",
};

export function isStreamableMcpPath(pathname: string): boolean {
  return pathname.endsWith("/mcp") || pathname.endsWith("/mcp/");
}

export function wantsStreamableHttp(req: Request, pathname: string): boolean {
  if (isStreamableMcpPath(pathname)) return true;
  const accept = (req.headers.get("accept") || "").toLowerCase();
  return accept.includes("text/event-stream");
}

function sessionIdFrom(req: Request): string {
  return (req.headers.get("mcp-session-id") || req.headers.get("Mcp-Session-Id") || "").trim();
}

function newSessionId(): string {
  return crypto.randomUUID();
}

function jsonRpcResponse(
  body: unknown,
  sessionId: string,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...STREAMABLE_CORS,
      "Content-Type": "application/json",
      "Mcp-Session-Id": sessionId,
    },
  });
}

function prefersJsonResponse(req: Request): boolean {
  const accept = (req.headers.get("accept") || "").toLowerCase();
  return !accept || accept.includes("application/json") || accept.includes("*/*");
}

export async function handleStreamableMcpRequest(
  req: Request,
  handler: McpRpcHandler,
): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: STREAMABLE_CORS });
  }

  const sessionId = sessionIdFrom(req) || newSessionId();

  if (req.method === "GET") {
    const accept = (req.headers.get("accept") || "").toLowerCase();
    if (!accept.includes("text/event-stream")) {
      return jsonRpcResponse(
        { ok: true, transport: "streamable-http", endpoint: "/mcp" },
        sessionId,
      );
    }
    const stream = new ReadableStream({
      start(controller) {
        const enc = new TextEncoder();
        const ping = () => controller.enqueue(enc.encode(": keepalive\n\n"));
        ping();
        const timer = setInterval(ping, 15000);
        // Edge functions time out; close gracefully before hard limit.
        const closer = setTimeout(() => {
          clearInterval(timer);
          controller.close();
        }, 120_000);
        // @ts-ignore deno compat
        controller._cleanup = () => {
          clearInterval(timer);
          clearTimeout(closer);
        };
      },
      cancel() {
        // no-op
      },
    });
    return new Response(stream, {
      status: 200,
      headers: {
        ...STREAMABLE_CORS,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Mcp-Session-Id": sessionId,
      },
    });
  }

  if (req.method === "DELETE") {
    return new Response(null, {
      status: 204,
      headers: {
        ...STREAMABLE_CORS,
        "Mcp-Session-Id": sessionId,
      },
    });
  }

  if (req.method !== "POST") {
    return jsonRpcResponse(
      { jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid Request" } },
      sessionId,
      405,
    );
  }

  let msg: McpRpcMessage;
  try {
    msg = await req.json();
  } catch {
    return jsonRpcResponse(
      { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } },
      sessionId,
    );
  }

  const resp = await handler(msg);
  if (!resp.ok) return resp;

  const useJson = prefersJsonResponse(req);
  const raw = await resp.text();
  if (useJson) {
    return new Response(raw, {
      status: resp.status,
      headers: {
        ...STREAMABLE_CORS,
        "Content-Type": "application/json",
        "Mcp-Session-Id": sessionId,
      },
    });
  }

  return new Response(`event: message\ndata: ${raw}\n\n`, {
    status: 200,
    headers: {
      ...STREAMABLE_CORS,
      "Content-Type": "text/event-stream",
      "Mcp-Session-Id": sessionId,
    },
  });
}

export function grokCompatibleInitializeResult(
  clientProtocolVersion: string | undefined,
  serverInfo: { name: string; version: string },
) {
  return {
    protocolVersion: clientProtocolVersion || "2024-11-05",
    capabilities: {
      tools: { listChanged: false },
      logging: {},
    },
    serverInfo,
  };
}

export function compactToolsForGrok(tools: Array<Record<string, unknown>>) {
  return tools.map((tool) => {
    const copy = { ...tool };
    if (typeof copy.description === "string" && copy.description.length > 280) {
      copy.description = `${copy.description.slice(0, 277)}...`;
    }
    const schema = copy.inputSchema as Record<string, unknown> | undefined;
    if (schema && typeof schema === "object") {
      const props = schema.properties as Record<string, Record<string, unknown>> | undefined;
      if (props) {
        const nextProps: Record<string, Record<string, unknown>> = {};
        for (const [k, v] of Object.entries(props)) {
          const p = { ...v };
          if (typeof p.description === "string" && p.description.length > 120) {
            p.description = `${p.description.slice(0, 117)}...`;
          }
          nextProps[k] = p;
        }
        copy.inputSchema = {
          ...schema,
          properties: nextProps,
          additionalProperties: false,
        };
      }
    }
    return copy;
  });
}
