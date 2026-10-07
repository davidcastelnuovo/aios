import test from 'node:test';
import assert from 'node:assert/strict';
import { outboundAllowed, installStagingOutboundGuard } from './staging-outbound.mjs';
const own = 'https://staging.supabase.co';
test('external sends and production calls blocked regardless of verb', () => {
  for (const [url, method] of [
    ['https://api.resend.com/emails', 'POST'], ['https://api.telegram.org/bot123/sendMessage', 'GET'],
    ['https://example.com/webhook', 'POST'], ['https://production.supabase.co/functions/v1/trigger-automation', 'GET'],
    ['https://graph.facebook.com/v22/123/messages', 'POST'], ['https://graph.facebook.com/123/feed', 'GET'],
    ['https://graph.facebook.com/v22/123?method=POST', 'GET'],
    ['https://www.googleapis.com/calendar/v3/calendars/primary/events', 'POST'],
    [`${own}/auth/v1/invite`, 'POST'],
  ]) assert.equal(outboundAllowed(url, method, own), false);
});
test('Google reporting and token refresh work without allowing calendar/email writes', () => {
  for (const url of [
    'https://oauth2.googleapis.com/token',
    'https://www.googleapis.com/webmasters/v3/sites/https%3A%2F%2Fexample.com%2F/searchAnalytics/query',
    'https://searchconsole.googleapis.com/webmasters/v3/sites/sc-domain%3Aexample.com/searchAnalytics/query',
    'https://analyticsdata.googleapis.com/v1beta/properties/123:runReport',
    'https://googleads.googleapis.com/v23/customers/123/googleAds:searchStream',
  ]) assert.equal(outboundAllowed(url, 'POST', own), true, url);
  assert.equal(outboundAllowed('https://oauth2.googleapis.com/revoke', 'POST', own), false);
});
test('own database, analytics reads and inference stay usable', () => {
  for (const [url, method] of [[`${own}/rest/v1/clients`, 'POST'], ['https://graph.facebook.com/v22/act_1/insights', 'GET'], ['https://api.openai.com/v1/responses', 'POST'], ['https://api.openai.com/v1/models', 'GET'], ['https://api.cursor.com/v0/agents/bc_123', 'GET']]) {
    assert.equal(outboundAllowed(url, method, own), true);
  }
});
test('workspace agent triggers and health probes accept UUID and legacy ids only', () => {
  for (const [url, method] of [
    ['https://api.chatgpt.com/v1/workspace_agents/bd01c76c-0d82-4966-bf48-f4002fb4d4f0/trigger', 'POST'],
    ['https://api.chatgpt.com/v1/workspace_agents/bd01c76c-0d82-4966-bf48-f4002fb4d4f0', 'GET'],
    ['https://api.chatgpt.com/v1/workspace_agents/agtch_abc123/trigger', 'POST'],
    ['https://api.chatgpt.com/v1/workspace_agents/agtch_abc123', 'HEAD'],
  ]) assert.equal(outboundAllowed(url, method, own), true, url);
  assert.equal(outboundAllowed('https://api.chatgpt.com/v1/workspace_agents/not-a-trigger/trigger', 'POST', own), false);
});
test('Claude Direct can fire a routine but not manage routines', () => {
  assert.equal(outboundAllowed('https://api.anthropic.com/v1/claude_code/routines/trig_01EMLfUVZhWHw5PJxPtgdb7x/fire', 'POST', own), true);
  assert.equal(outboundAllowed('https://api.anthropic.com/v1/claude_code/routines/trig_01EMLfUVZhWHw5PJxPtgdb7x', 'POST', own), false);
  assert.equal(outboundAllowed('https://api.anthropic.com/v1/claude_code/routines', 'POST', own), false);
});
test('guard never calls network for blocked request and disables redirect bypass', async () => {
  const calls = [];
  const runtime = { fetch: async (...args) => { calls.push(args); return new Response('{}'); } };
  installStagingOutboundGuard(own, runtime);
  const res = await runtime.fetch(new Request('https://api.resend.com/emails', { method: 'POST' }));
  assert.equal(res.status, 409); assert.equal(calls.length, 0);
  await runtime.fetch(`${own}/rest/v1/clients`);
  assert.equal(calls[0][1].redirect, 'error');
});
