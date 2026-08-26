import { createServer } from "node:http";
import { withChatSession, captureFailure } from "./runQuery.mjs";
import { brandIsMentioned, listPosition, sentimentFromText } from "./mentions.mjs";

const PORT = Number(process.env.PORT || 8787);
const SECRET = process.env.CHATGPT_WEB_WORKER_SECRET || "";
const INGEST_URL = process.env.CHATGPT_INGEST_URL || "";
const PAUSE_MS = Number(process.env.CHATGPT_PAUSE_MS || 5000);

if (!SECRET || !INGEST_URL) {
  console.error("Set CHATGPT_WEB_WORKER_SECRET and CHATGPT_INGEST_URL");
  process.exit(1);
}

const queue = [];
let busy = false;

function unauthorized(res) {
  res.writeHead(401, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Unauthorized" }));
}

function json(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

async function ingest(event, scanId, extra = {}) {
  const response = await fetch(INGEST_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-chatgpt-worker-secret": SECRET,
    },
    body: JSON.stringify({ scan_id: scanId, event, ...extra }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`ingest ${event} ${response.status}: ${text.slice(0, 400)}`);
  }
}

async function processScan(job) {
  console.log(`scan ${job.scan_id} starting (${job.prompts.length} prompts)`);
  await ingest("started", job.scan_id);
  await withChatSession(async ({ ask, page }) => {
    for (const prompt of job.prompts) {
      try {
        const answer = await ask(prompt.prompt);
        const mentioned = brandIsMentioned(answer.text, job.brand_name, job.keywords);
        await ingest("result", job.scan_id, {
          result: {
            prompt_id: prompt.id,
            text: answer.text,
            citations: answer.citations,
            is_mentioned: mentioned,
            position: mentioned ? listPosition(answer.text, job.brand_name) : null,
            sentiment: mentioned ? sentimentFromText(answer.text, job.brand_name) : null,
            competitors: (job.competitors || []).map((name) => ({
              name,
              is_mentioned: brandIsMentioned(answer.text, name, [name]),
              position: listPosition(answer.text, name),
            })),
          },
        });
        console.log(`scan ${job.scan_id} prompt ${prompt.id} mentioned=${mentioned}`);
      } catch (error) {
        console.error(`scan ${job.scan_id} prompt ${prompt.id} failed:`, error);
        await captureFailure(page, job.scan_id, prompt.id);
        await ingest("result", job.scan_id, {
          result: {
            prompt_id: prompt.id,
            text: `WORKER_ERROR: ${error instanceof Error ? error.message : String(error)}`,
            citations: [],
            is_mentioned: false,
            position: null,
            sentiment: null,
            competitors: [],
          },
        });
      }
      await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
    }
  });
  await ingest("done", job.scan_id);
  console.log(`scan ${job.scan_id} done`);
}

async function pump() {
  if (busy) return;
  const job = queue.shift();
  if (!job) return;
  busy = true;
  try {
    await processScan(job);
  } catch (error) {
    console.error(`scan ${job.scan_id} crashed:`, error);
    try {
      await ingest("failed", job.scan_id, { error: error instanceof Error ? error.message : String(error) });
    } catch (ingestError) {
      console.error("failed to report crash", ingestError);
    }
  } finally {
    busy = false;
    pump();
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  if (req.method === "GET" && url.pathname === "/health") {
    return json(res, 200, { ok: true, busy, queued: queue.length, engine: "chatgpt_web" });
  }
  if (req.method === "POST" && url.pathname === "/v1/scans") {
    if ((req.headers["x-chatgpt-worker-secret"] || "") !== SECRET) return unauthorized(res);
    const body = await readBody(req);
    if (!body.scan_id || !Array.isArray(body.prompts) || body.prompts.length === 0) {
      return json(res, 400, { error: "scan_id and prompts required" });
    }
    queue.push(body);
    pump();
    return json(res, 202, { queued: true, scan_id: body.scan_id, position: queue.length });
  }
  json(res, 404, { error: "not found" });
});

server.listen(PORT, () => {
  console.log(`chatgpt-visibility worker on :${PORT}`);
});
