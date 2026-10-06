import assert from "node:assert/strict";
import test from "node:test";

import {
  OPENAI_CREDIT_BALANCE_UNAVAILABLE_REASON,
  buildOpenAiBillingStatus,
  extractDailyCostBuckets,
  extractDailyUsageBuckets,
  formatOpenAiBillingWhatsApp,
  isSuperAdminRole,
  monthUtcBounds,
  redactSecretsFromText,
  sumCompletionsUsage,
  sumOrganizationCosts,
} from "./openai-billing.mjs";

test("super_admin guard helper", () => {
  assert.equal(isSuperAdminRole("super_admin"), true);
  assert.equal(isSuperAdminRole("owner"), false);
  assert.equal(isSuperAdminRole("campaigner"), false);
});

test("sumOrganizationCosts aggregates daily buckets", () => {
  const payload = {
    data: [
      {
        results: [
          { amount: { value: 1.25, currency: "usd" }, line_item: "gpt-4o-mini" },
          { amount: { value: 0.75, currency: "usd" }, line_item: "embeddings" },
        ],
      },
      {
        results: [{ amount: { value: 2, currency: "usd" }, line_item: "gpt-4o-mini" }],
      },
    ],
  };
  const sum = sumOrganizationCosts(payload);
  assert.equal(sum.total_cost, 4);
  assert.equal(sum.currency, "usd");
  assert.equal(sum.line_items[0].name, "gpt-4o-mini");
  assert.equal(sum.line_items[0].value, 3.25);
});

test("sumCompletionsUsage aggregates tokens", () => {
  const payload = {
    data: [
      {
        results: [
          { input_tokens: 100, output_tokens: 40, num_model_requests: 2 },
          { input_tokens: 50, output_tokens: 10, num_model_requests: 1 },
        ],
      },
    ],
  };
  const u = sumCompletionsUsage(payload);
  assert.equal(u.input_tokens, 150);
  assert.equal(u.output_tokens, 50);
  assert.equal(u.total_tokens, 200);
  assert.equal(u.num_model_requests, 3);
});

test("buildOpenAiBillingStatus never fabricates remaining credit", () => {
  const status = buildOpenAiBillingStatus({
    costs: {
      data: [{ results: [{ amount: { value: 12.5, currency: "usd" }, line_item: "x" }] }],
    },
    period: monthUtcBounds(new Date("2026-08-15T12:00:00Z")),
  });
  assert.equal(status.remaining_credit, null);
  assert.equal(status.remaining_credit_available, false);
  assert.match(status.remaining_credit_reason, /does not expose remaining prepaid credit/i);
  assert.equal(status.current_month_usage_cost, 12.5);
  assert.equal(status.period, "2026-08");
  assert.ok(status.ok);
});

test("WhatsApp summary is concise and mentions unavailable credit", () => {
  const status = buildOpenAiBillingStatus({
    costs: {
      data: [{ results: [{ amount: { value: 3.2, currency: "usd" }, line_item: "chat" }] }],
    },
    usage: {
      data: [{ results: [{ input_tokens: 1000, output_tokens: 200, num_model_requests: 5 }] }],
    },
    period: monthUtcBounds(new Date("2026-08-04T00:00:00Z")),
  });
  const text = formatOpenAiBillingWhatsApp(status);
  assert.match(text, /לא זמינה/);
  assert.match(text, /\$3\.20/i);
  assert.doesNotMatch(text, /sk-/);
  assert.ok(text.length < 800);
  assert.ok(OPENAI_CREDIT_BALANCE_UNAVAILABLE_REASON.includes("billing"));
});

test("extractDailyCostBuckets preserves dates and sums", () => {
  const payload = {
    data: [
      { start_time: 1756684800, results: [{ amount: { value: 1.5 }, line_item: "gpt-4o-mini" }] },
      { start_time: 1756771200, results: [{ amount: { value: 2.0 }, line_item: "gpt-4o-mini" }] },
    ],
  };
  const days = extractDailyCostBuckets(payload);
  assert.equal(days.length, 2);
  assert.equal(days[0].cost, 1.5);
  assert.equal(days[1].cost, 2);
});

test("extractDailyUsageBuckets aggregates per day", () => {
  const payload = {
    data: [
      { start_time: 1756684800, results: [{ input_tokens: 100, output_tokens: 50, num_model_requests: 2 }] },
    ],
  };
  const days = extractDailyUsageBuckets(payload);
  assert.equal(days[0].total_tokens, 150);
  assert.equal(days[0].num_model_requests, 2);
});

test("redactSecretsFromText strips API keys", () => {
  const redacted = redactSecretsFromText("Bearer sk-abc1234567890xyz error");
  assert.doesNotMatch(redacted, /sk-abc/);
  assert.match(redacted, /\*\*\*/);
});
