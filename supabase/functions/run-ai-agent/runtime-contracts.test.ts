import assert from "node:assert/strict";
import test from "node:test";
import { jsonObject } from "./json-config.ts";
import { isMetaNode, readMetaResponse } from "./meta-response.ts";

function response(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status });
}

test("Meta responses preserve numeric strings, actions, pagination and extra metrics", async () => {
  const payload = {
    data: [
      {
        campaign_id: "campaign-1",
        spend: "21.5",
        impressions: 100,
        actions: [{ action_type: "lead", value: "3" }],
        purchase_roas: [{ value: "2.5" }],
      },
    ],
    paging: { next: "https://graph.facebook.com/next" },
    summary: { total_count: 1 },
  };
  assert.deepEqual(await readMetaResponse(response(payload)), payload);
});

test("Meta API errors and nullable fields survive decoding for existing fallback handling", async () => {
  const payload = {
    data: null,
    error: { message: "Token expired", code: 190, type: null },
    paging: null,
  };
  assert.deepEqual(await readMetaResponse(response(payload, 400)), payload);
  const nullable = {
    id: null,
    spend: null,
    actions: null,
    cost_per_action_type: null,
    questions: null,
  };
  assert.deepEqual(await readMetaResponse(response(nullable)), nullable);
  assert.deepEqual(await readMetaResponse(response({ data: [] })), {
    data: [],
  });
});

test("malformed Graph envelopes cannot masquerade as typed campaign data", async () => {
  for (const payload of [
    null,
    [],
    "bad",
    { data: {} },
    { data: [null] },
    { data: [{ spend: {} }] },
    { actions: [{ value: {} }] },
    { questions: [{ label: 42 }] },
    { paging: { next: 3 } },
    { error: "expired" },
  ]) {
    await assert.rejects(
      readMetaResponse(response(payload)),
      /Invalid Meta response/,
    );
  }
  await assert.rejects(readMetaResponse(new Response("not-json")), SyntaxError);
});

test("configured Meta pages accept nullable optional fields and reject malformed fields", () => {
  assert.equal(
    isMetaNode({ id: "page-1", name: null, access_token: "page-token" }),
    true,
  );
  assert.equal(isMetaNode({ id: "page-1", access_token: {} }), false);
});

test("persisted configuration keeps nested mappings intact while primitives have no keys", () => {
  const settings = {
    form_mappings: {
      form1: { agency_id: "agency-1", fields: { email: "EMAIL" } },
    },
    other: true,
  };
  assert.equal(jsonObject(settings), settings);
  for (const value of [null, undefined, true, 42, "legacy", []]) {
    assert.deepEqual(jsonObject(value), {});
  }
});
