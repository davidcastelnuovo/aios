import assert from 'node:assert/strict'
import test from 'node:test'
import { sendCarmenReplyViaActionStep } from './carmen.ts'

// Minimal stand-in for the PostgREST builder: every filter returns `this`, and the
// builder resolves to the rows it was seeded with.
function stubSupabase(stepRows) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    in: () => builder,
    order: () => builder,
    limit: () => Promise.resolve({ data: stepRows }),
    maybeSingle: () => Promise.resolve({ data: null }),
  }
  return { from: () => builder }
}

function withStubbedRuntime(run) {
  const originalDeno = globalThis.Deno
  const originalFetch = globalThis.fetch
  const calls = []
  globalThis.Deno = { env: { get: (key) => (key === 'SUPABASE_URL' ? 'https://project.supabase.co' : 'service-key') } }
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), body: JSON.parse(init.body) })
    return { ok: true, text: async () => '' }
  }
  return run(calls).finally(() => {
    globalThis.Deno = originalDeno
    globalThis.fetch = originalFetch
  })
}

const baseArgs = {
  automationId: 'automation-1',
  tenantId: 'tenant-1',
  connectionUserId: 'user-1',
  phoneNumber: '972507677613',
  message: 'שלום',
}

test('a Meta action step never sends to a group', async () => {
  await withStubbedRuntime(async (calls) => {
    const sent = await sendCarmenReplyViaActionStep({
      ...baseArgs,
      supabase: stubSupabase([
        { action_type: 'send_meta_whatsapp_message', configuration: { meta_whatsapp_integration_id: 'meta-1' } },
      ]),
      chatId: '120363416882903532@g.us',
      isGroup: true,
    })

    assert.equal(sent, false)
    assert.deepEqual(calls, [])
  })
})

test('a Meta action step dispatches a 1:1 reply to send-meta-whatsapp-message', async () => {
  await withStubbedRuntime(async (calls) => {
    const sent = await sendCarmenReplyViaActionStep({
      ...baseArgs,
      supabase: stubSupabase([
        { action_type: 'send_meta_whatsapp_message', configuration: { meta_whatsapp_integration_id: 'meta-1' } },
      ]),
      chatId: '972507677613',
      isGroup: false,
    })

    assert.equal(sent, true)
    assert.equal(calls.length, 1)
    assert.ok(calls[0].url.endsWith('/functions/v1/send-meta-whatsapp-message'))
    assert.deepEqual(calls[0].body, {
      tenantId: 'tenant-1',
      senderUserId: 'user-1',
      message: 'שלום',
      integrationId: 'meta-1',
      phoneNumber: '972507677613',
    })
  })
})

test('a Manus action step still routes to send-manus-wa-message', async () => {
  await withStubbedRuntime(async (calls) => {
    const sent = await sendCarmenReplyViaActionStep({
      ...baseArgs,
      supabase: stubSupabase([
        { action_type: 'send_manus_message', configuration: { integration_id: 'manus-1' } },
      ]),
      chatId: '972507677613',
      isGroup: false,
    })

    assert.equal(sent, true)
    assert.ok(calls[0].url.endsWith('/functions/v1/send-manus-wa-message'))
    assert.equal(calls[0].body.integrationId, 'manus-1')
  })
})
