import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  findUnansweredClientQuestions,
  isLikelyQuestion,
  GREEN_GROUP_MIN_AGE_MS,
  GREEN_GROUP_REPLY_SLA_MS,
} from "./client-green-group-monitor.ts";

describe("client-green-group-monitor", () => {
  it("detects Hebrew questions", () => {
    assert.equal(isLikelyQuestion("מתי הקמפיין עולה?"), true);
    assert.equal(isLikelyQuestion("תודה"), false);
  });

  it("flags unanswered client question after SLA", () => {
    const now = Date.parse("2026-09-22T18:00:00Z");
    const qTime = new Date(now - GREEN_GROUP_MIN_AGE_MS - 1000).toISOString();
    const items = findUnansweredClientQuestions({
      messages: [
        {
          created_at: qTime,
          direction: "inbound",
          message_text: "אפשר עדכון על הקמפיין?",
          sender_phone: "972501234567",
        },
      ],
      clientPhone: "972501234567",
      staffPhones: ["972509999999"],
      nowMs: now,
      slaMs: GREEN_GROUP_REPLY_SLA_MS,
      minAgeMs: GREEN_GROUP_MIN_AGE_MS,
    });
    assert.equal(items.length, 1);
  });

  it("does not flag when outbound follows", () => {
    const now = Date.parse("2026-09-22T18:00:00Z");
    const qTime = new Date(now - 3 * 60 * 60 * 1000).toISOString();
    const rTime = new Date(now - 2 * 60 * 60 * 1000).toISOString();
    const items = findUnansweredClientQuestions({
      messages: [
        {
          created_at: qTime,
          direction: "inbound",
          message_text: "מה המצב?",
          sender_phone: "972501234567",
        },
        {
          created_at: rTime,
          direction: "outbound",
          message_text: "הכל תקין",
          sender_phone: "972509999999",
        },
      ],
      clientPhone: "972501234567",
      staffPhones: ["972509999999"],
      nowMs: now,
    });
    assert.equal(items.length, 0);
  });
});
