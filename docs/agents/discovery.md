# Codebase discovery and Graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- Before architecture or implementation work, use the shared `aios-system-graph` MCP tools (`query_system_graph` and `graph_status`) when available to locate existing components, dependencies, database objects, Edge Functions, Carmen skins, tools, and memory paths. Confirm the central graph matches a recent `main` commit; reuse existing functionality and inspect affected dependencies again before opening a PR.
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the local graph current (AST-only, no API cost); the central graph is rebuilt after merges to `main`.
- Keep Graphify output, generated reports, summaries, reflections, and work-memory files out of commits. Keep changes to Carmen and other critical monolithic functions small and additive.
