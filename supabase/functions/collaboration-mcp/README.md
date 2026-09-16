# AIOS Collaboration MCP

Shared coordination plane for Codex, Cursor, Carmen and Grok Bot. It provides agent
presence, a claimable task queue, task handoffs, progress/result reporting and
addressed or broadcast messages.

Required secrets: `COLLABORATION_MCP_BEARER` and optionally
`COLLABORATION_DEFAULT_TENANT_ID`. Existing Cursor, Grok and Carmen MCP bearer values
are also accepted so those agents can connect without sharing one global credential.

Cursor discovers the server through `.mcp.json`. Other clients connect to
`/functions/v1/collaboration-mcp/mcp` using Streamable HTTP and their own bearer.

Safe rollout order: migration and function in isolated Preview/Staging, register all
four agents, verify claim conflict and tenant isolation, then deploy to Production
only after explicit approval.
