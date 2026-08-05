import assert from "node:assert/strict";
import test from "node:test";

import {
  isManagerStaffRole,
  normalizeNotifyPhone,
  resolveCarmenNotifyTarget,
} from "./carmen-notify-target.ts";

const DAVID = "972507677613";
const FELIX = "972558833168";

test("normalizeNotifyPhone: Israeli local + JID → 972", () => {
  assert.equal(normalizeNotifyPhone("0507677613"), DAVID);
  assert.equal(normalizeNotifyPhone("0558833168"), FELIX);
  assert.equal(normalizeNotifyPhone(`${DAVID}@c.us`), DAVID);
  assert.equal(normalizeNotifyPhone(DAVID), DAVID);
});

test("isManagerStaffRole recognizes Hebrew team manager", () => {
  assert.equal(isManagerStaffRole("מנהל צוות"), true);
  assert.equal(isManagerStaffRole("קמפיינר"), false);
  assert.equal(isManagerStaffRole("manager"), true);
});

test("DMM pulse: campaign_pulse_phone → Felix, not newest David session", () => {
  const result = resolveCarmenNotifyTarget({
    campaignPulsePhone: FELIX,
    sessions: [
      { chat_id: `${DAVID}@c.us`, phone: DAVID, sender_name: "דוד", updated_at: "2026-08-05" },
      { chat_id: `${FELIX}@c.us`, phone: FELIX, sender_name: "פליקס", updated_at: "2026-07-01" },
    ],
    staff: [
      { phone: FELIX, full_name: "פליקס", role: "מנהל צוות" },
      { phone: "0501234567", full_name: "Other", role: "קמפיינר" },
    ],
  });
  assert.equal(result.source, "campaign_pulse_phone");
  assert.equal(normalizeNotifyPhone(result.chatId), FELIX);
  assert.equal(result.phone, FELIX);
});

test("DMM: without pulse phone, prefer Felix manager session over David (David not in staff)", () => {
  const result = resolveCarmenNotifyTarget({
    campaignPulsePhone: null,
    sessions: [
      { chat_id: `${DAVID}@c.us`, phone: DAVID, sender_name: "דוד", updated_at: "2026-08-05" },
      { chat_id: `${FELIX}@c.us`, phone: FELIX, sender_name: "פליקס", updated_at: "2026-07-01" },
    ],
    staff: [
      { phone: FELIX, full_name: "פליקס", role: "מנהל צוות" },
      { phone: "972549757611", full_name: "אביעד", role: "קמפיינר" },
    ],
  });
  assert.equal(result.source, "tenant_staff_session");
  assert.equal(normalizeNotifyPhone(result.chatId), FELIX);
  assert.notEqual(normalizeNotifyPhone(result.chatId), DAVID);
});

test("DMM: David-only sessions + Felix staff phone → Felix (no David fallback)", () => {
  const result = resolveCarmenNotifyTarget({
    campaignPulsePhone: null,
    sessions: [
      { chat_id: `${DAVID}@c.us`, phone: DAVID, sender_name: "דוד" },
    ],
    staff: [
      { phone: FELIX, full_name: "פליקס", role: "מנהל צוות" },
    ],
  });
  assert.equal(result.source, "tenant_staff_phone");
  assert.equal(normalizeNotifyPhone(result.chatId), FELIX);
});

test("DMM: David sessions + empty staff → refuse", () => {
  const result = resolveCarmenNotifyTarget({
    campaignPulsePhone: null,
    preferredPhone: null,
    sessions: [
      { chat_id: `${DAVID}@c.us`, phone: DAVID, sender_name: "דוד" },
    ],
    staff: [],
  });
  assert.equal(result.source, "none");
  assert.equal(result.chatId, "");
});

test("preferred_phone wins over campaign_pulse_phone", () => {
  const result = resolveCarmenNotifyTarget({
    preferredPhone: DAVID,
    campaignPulsePhone: FELIX,
    sessions: [
      { chat_id: `${DAVID}@c.us`, phone: DAVID, sender_name: "דוד" },
      { chat_id: `${FELIX}@c.us`, phone: FELIX, sender_name: "פליקס" },
    ],
    staff: [{ phone: FELIX, full_name: "פליקס", role: "מנהל צוות" }],
  });
  assert.equal(result.source, "preferred_phone");
  assert.equal(normalizeNotifyPhone(result.chatId), DAVID);
});

test("MC: campaign_pulse_phone David works when he is tenant staff", () => {
  const result = resolveCarmenNotifyTarget({
    campaignPulsePhone: DAVID,
    sessions: [{ chat_id: `${DAVID}@c.us`, phone: DAVID, sender_name: "דוד" }],
    staff: [{ phone: "0507677613", full_name: "דוד", role: "owner" }],
  });
  assert.equal(result.source, "campaign_pulse_phone");
  assert.equal(normalizeNotifyPhone(result.chatId), DAVID);
});

test("manager staff preferred over campaigner when both have sessions", () => {
  const avi = "972549757611";
  const result = resolveCarmenNotifyTarget({
    sessions: [
      { chat_id: `${avi}@c.us`, phone: avi, sender_name: "אביעד", updated_at: "2026-08-05" },
      { chat_id: `${FELIX}@c.us`, phone: FELIX, sender_name: "פליקס", updated_at: "2026-07-01" },
    ],
    staff: [
      { phone: avi, full_name: "אביעד", role: "קמפיינר" },
      { phone: FELIX, full_name: "פליקס", role: "מנהל צוות" },
    ],
  });
  assert.equal(result.source, "tenant_staff_session");
  assert.equal(normalizeNotifyPhone(result.chatId), FELIX);
});
