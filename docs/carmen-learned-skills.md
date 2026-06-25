# Carmen — Learned Skills Log (Claude's memory)

This file is **Claude's own long-term memory** of capabilities it has taught
Carmen. Every Claude Code session clones this repo, so anything recorded here is
available to all future sessions.

## How this works

When Carmen hits a task she can't do herself, she asks Claude via the `claude-mcp`
MCP bridge (`request_dev_task` / `ask_claude`). Claude solves it and then, if the
task represents a **reusable** capability, does two things:

1. **Makes Carmen independent** — writes a skin (row in `public.ai_skills`,
   `scope='tenant'`, `created_by_agent=true`) so Carmen can do it herself next
   time, triggered by the relevant Hebrew/English phrases.
2. **Remembers it here** — appends a dated entry below, so future Claude sessions
   know this ground has already been covered (and which skin slug owns it).

Trivial one-off requests are skipped — only genuinely reusable capabilities are
logged.

## Entry format

```
### YYYY-MM-DD — <short capability name>
- **Skin slug:** <ai_skills.slug> (tenant: <tenant_id or "global">)
- **What Carmen can now do:** <one or two sentences>
- **How:** <tools / steps the skin uses>
- **Origin:** Carmen request — "<short paraphrase of what she asked for>"
```

## Log

<!-- New entries go below this line, newest first. -->
