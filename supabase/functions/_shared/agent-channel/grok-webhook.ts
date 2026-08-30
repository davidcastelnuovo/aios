export async function fireGrokBotWebhook(args: {
  task: string;
  context: string;
}): Promise<{ id: string; url: string }> {
  const url = String(Deno.env.get("GROK_BOT_WEBHOOK_URL") || "").trim();
  const key = String(Deno.env.get("GROK_BOT_WEBHOOK_KEY") || "").trim();
  if (!url || !key) throw new Error("Grok Bot webhook is not configured.");

  const task = args.task.trim();
  if (!task) throw new Error("Grok Bot webhook requires a non-empty task.");

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "aios-agent-channel/1.0",
    },
    body: JSON.stringify({
      task: task.length > 100_000 ? task.slice(0, 100_000) : task,
      context: args.context,
    }),
  });
  const raw = await resp.text();
  if (!resp.ok) {
    let detail = raw.slice(0, 400);
    try { detail = JSON.parse(raw)?.error?.message || JSON.parse(raw)?.message || detail; } catch { /* keep */ }
    throw new Error(`Grok Bot webhook ${resp.status}: ${detail}`);
  }
  let id = `webhook-${crypto.randomUUID()}`;
  try {
    const data = JSON.parse(raw);
    id = String(data?.id || data?.runId || data?.dispatchId || id);
  } catch { /* empty body is fine */ }
  return { id, url: "Grok Bot Direct" };
}
