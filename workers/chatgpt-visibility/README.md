# ChatGPT.com visibility worker

Separate DigitalOcean droplet. Do **not** run this on the WhatsApp instance box.

WhatsApp needs sticky WebSockets and uptime. This worker launches Chromium, uses a residential proxy, and can OOM or restart freely. One crash here must not drop customer WhatsApp sessions.

## What it does

For each high-intent prompt:

1. Open chatgpt.com with a saved logged-in session (one default account, not a farm of people)
2. Start a **new chat** (no memory / no history)
3. Ask the question as a normal user
4. Capture the answer + citation URLs
5. POST results back to `ai-detection-worker-ingest`

Locale/timezone: `he-IL` / `Asia/Jerusalem`. Put an Israeli residential proxy in `CHATGPT_PROXY` so the IP matches the audience.

## One-time login

```bash
npm install
CHATGPT_PROXY=http://user:pass@il-proxy:8000 npm run login
```

Log in once in the window, press Enter in the terminal. It writes `storage-state.json`. Keep that file on the droplet only.

## Run

```bash
export CHATGPT_WEB_WORKER_SECRET='long random'
export CHATGPT_INGEST_URL='https://zvoijyneresvkadpprel.supabase.co/functions/v1/ai-detection-worker-ingest'
export CHATGPT_PROXY='http://user:pass@il-proxy:8000'
node src/server.mjs
```

Docker (preferred on the droplet):

```bash
# .env next to docker-compose.yml
# CHATGPT_WEB_WORKER_SECRET=...
# CHATGPT_INGEST_URL=https://zvoijyneresvkadpprel.supabase.co/functions/v1/ai-detection-worker-ingest
# CHATGPT_PROXY=http://user:pass@il-proxy:8000

docker compose up -d --build
```

Or:

```bash
docker build -t chatgpt-visibility .
docker run -d --restart unless-stopped -p 127.0.0.1:8787:8787 \
  -v $PWD/storage-state.json:/app/storage-state.json \
  -e CHATGPT_WEB_WORKER_SECRET \
  -e CHATGPT_INGEST_URL \
  -e CHATGPT_PROXY \
  chatgpt-visibility
```

Put nginx + TLS in front. The edge function calls `CHATGPT_WEB_WORKER_URL` (e.g. `https://chatgpt-worker.yourdomain.com`). Droplet size: 2 vCPU / 4 GB is enough for one Chromium at a time.

## Supabase secrets (after merge)

- `CHATGPT_WEB_WORKER_URL`
- `CHATGPT_WEB_WORKER_SECRET` (same value as the droplet)

Until those secrets exist, scans keep using ChatGPT Search API.

## Why not many ChatGPT users

The metric is “default ChatGPT, Israel, new chat”. Extra accounts with memory/custom instructions pollute it. 1–3 blank Plus sessions on a proxy is enough; rotate if a session dies.
