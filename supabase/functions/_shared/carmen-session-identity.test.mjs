import assert from "node:assert/strict";
import test from "node:test";

import {
  buildWaNotifyFromOrigin,
  isGroupChatId,
  normalizeCarmenChatId,
  originChatsMatch,
  replyDestinationIsConsistent,
  requireOriginChatId,
} from "./carmen-session-identity.ts";

const DAVID_PRIVATE = "972507677613@c.us";
const GROUP_A = "120363425732219862@g.us"; // AfterLead - DMM
const GROUP_B = "120363421902818314@g.us"; // דוד & דקל & אנה
const DAVID_PHONE = "972507677613";

test("normalizeCarmenChatId keeps group and private JIDs", () => {
  assert.equal(normalizeCarmenChatId(GROUP_A), GROUP_A);
  assert.equal(normalizeCarmenChatId(DAVID_PRIVATE), DAVID_PRIVATE);
  assert.equal(normalizeCarmenChatId(DAVID_PHONE), DAVID_PRIVATE);
  assert.equal(normalizeCarmenChatId(""), null);
  assert.equal(normalizeCarmenChatId(null), null);
});

test("two groups with the same speaker are different sessions", () => {
  assert.equal(originChatsMatch(GROUP_A, GROUP_B), false);
  assert.equal(originChatsMatch(GROUP_A, GROUP_A), true);
  assert.equal(originChatsMatch(GROUP_A, DAVID_PRIVATE), false);
  assert.equal(isGroupChatId(GROUP_A), true);
  assert.equal(isGroupChatId(DAVID_PRIVATE), false);
});

test("requireOriginChatId refuses phone-only / missing keys", () => {
  assert.equal(requireOriginChatId(GROUP_A).ok, true);
  assert.equal(requireOriginChatId("").ok, false);
  assert.equal(requireOriginChatId(null).ok, false);
  // digits-only is a private chat, not "whatever group this phone was last in"
  const origin = requireOriginChatId(DAVID_PHONE);
  assert.equal(origin.ok, true);
  if (origin.ok) {
    assert.equal(origin.chatId, DAVID_PRIVATE);
    assert.equal(origin.isGroup, false);
  }
});

test("reply destination must match JID type", () => {
  assert.equal(replyDestinationIsConsistent({ chatId: GROUP_A, isGroup: true }), true);
  assert.equal(replyDestinationIsConsistent({ chatId: GROUP_A, isGroup: false }), false);
  assert.equal(replyDestinationIsConsistent({ chatId: DAVID_PRIVATE, isGroup: false }), true);
  assert.equal(replyDestinationIsConsistent({ chatId: DAVID_PRIVATE, isGroup: true }), false);
});

test("wa_notify is pinned to the originating group, not the speaker phone", () => {
  const notify = buildWaNotifyFromOrigin({
    tenantId: "t1",
    automationId: "auto-groups",
    connectionUserId: "u1",
    chatId: GROUP_B,
    speakerPhone: DAVID_PHONE,
  });
  assert.ok(notify);
  assert.equal(notify.chat_id, GROUP_B);
  assert.equal(notify.is_group, true);
  assert.equal(notify.phone_number, DAVID_PHONE);
  assert.equal(originChatsMatch(notify.chat_id, GROUP_A), false);
});

test("a question in group A cannot restore history from group B", () => {
  const askedIn = requireOriginChatId(GROUP_A);
  const otherSession = { chat_id: GROUP_B, phone: DAVID_PHONE };
  assert.equal(askedIn.ok, true);
  assert.equal(originChatsMatch(askedIn.ok ? askedIn.chatId : null, otherSession.chat_id), false);
});
