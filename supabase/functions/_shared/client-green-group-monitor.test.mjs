import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  findMissingCardWeeklyUpdates,
  findUnfulfilledStaffCommitments,
  findUnansweredClientQuestions,
  isLikelyQuestion,
  isLikelyWeeklyGroupUpdate,
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

  it("detects weekly-like outbound missing on card", () => {
    const now = Date.parse("2026-09-22T18:00:00Z");
    const msgTime = new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString();
    const missing = findMissingCardWeeklyUpdates({
      messages: [
        {
          created_at: msgTime,
          direction: "outbound",
          message_text: "עדכון שבועי: הכל תקין בקמפיין " + "x".repeat(120),
          sender_phone: "972509999999",
        },
      ],
      staffPhones: ["972509999999"],
      cardUpdates: [],
      nowMs: now,
    });
    assert.equal(missing.length, 1);
    assert.equal(isLikelyWeeklyGroupUpdate("עדכון שבועי קצר"), true);
  });

  it("flags unfulfilled staff commitment", () => {
    const now = Date.parse("2026-09-22T18:00:00Z");
    const t0 = new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString();
    const items = findUnfulfilledStaffCommitments({
      messages: [
        {
          created_at: t0,
          direction: "outbound",
          message_text: "אעדכן אתכם מחר על התקציב",
          sender_phone: "972509999999",
        },
      ],
      staffPhones: ["972509999999"],
      nowMs: now,
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
