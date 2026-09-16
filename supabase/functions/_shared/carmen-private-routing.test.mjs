import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPrivateRoutingAcceptanceCases,
  isPhoneInAllowedList,
  isUsableLidKey,
  looksLikeRealPhone,
  outboundThirdPartyGuardDecision,
  pickInboundLidDigits,
  pickPayloadRealPhone,
  pickPrivateCarmenTarget,
  resolveInboundLidToPhone,
  shouldMarkResolvedLidAsOutgoing,
} from "./carmen-private-routing.mjs";

const { anaPhone, davidPhone, anaLid, davidLid, botPhone, unauthorizedPhone } =
  buildPrivateRoutingAcceptanceCases();
const allowed = [davidPhone, anaPhone];

test("Ana is recognized as authorized direct-chat phone", () => {
  assert.equal(isPhoneInAllowedList(anaPhone, allowed), true);
  assert.equal(isPhoneInAllowedList("0545612156", allowed), true);
  assert.equal(isPhoneInAllowedList(unauthorizedPhone, allowed), false);
});

test("inbound LID with multiple allowed phones does NOT hijack to recent David session", () => {
  // Regression: old code picked the freshest carmen_whatsapp_sessions phone
  // among allowed phones → Ana's LID became David's chat.
  const resolved = resolveInboundLidToPhone({
    lidDigits: anaLid,
    allowedPhones: allowed,
    // no payload phone, no alias, no wa_lid_map
  });
  assert.equal(resolved.phone, null);
  assert.equal(resolved.reason, "unresolved_multi_allowed");
});

test("inbound LID resolves via wa_lid_map / alias / payload to Ana", () => {
  assert.equal(
    resolveInboundLidToPhone({
      lidDigits: anaLid,
      waLidMapPhone: anaPhone,
      allowedPhones: allowed,
    }).phone,
    anaPhone,
  );
  assert.equal(
    resolveInboundLidToPhone({
      lidDigits: anaLid,
      lidAliases: { [anaLid]: anaPhone },
      allowedPhones: allowed,
    }).phone,
    anaPhone,
  );
  assert.equal(
    resolveInboundLidToPhone({
      lidDigits: anaLid,
      payloadRealPhone: anaPhone,
      allowedPhones: allowed,
    }).phone,
    anaPhone,
  );
});

test("single allowed phone may resolve LID (backward compatible)", () => {
  const resolved = resolveInboundLidToPhone({
    lidDigits: "123",
    allowedPhones: [davidPhone],
  });
  assert.equal(resolved.phone, davidPhone);
  assert.equal(resolved.reason, "single_allowed_phone");
});

test("resolved inbound LID must not be marked as David outbound", () => {
  assert.equal(shouldMarkResolvedLidAsOutgoing(), false);
});

test("private Ana inbound reply stays in Ana chat (not David)", () => {
  const target = pickPrivateCarmenTarget({
    pairedFromGreenApi: false,
    counterpartPhone: anaPhone,
    sourcePhoneNumber: davidPhone, // connected Manus phone
    isOutgoingFromPhone: false,
  });
  assert.equal(target.phone, anaPhone);
  assert.equal(target.chatId, `${anaPhone}@c.us`);
  assert.notEqual(target.phone, davidPhone);
});

test("unauthorized private sender: outbound guard still skips third-party chats", () => {
  assert.equal(
    outboundThirdPartyGuardDecision({
      isOutgoingFromPhone: true,
      pairedFromGreenApi: false,
      isGroup: false,
      messageText: "שלום אנה",
      hasActiveSessionForChat: false,
    }),
    "skip",
  );
  assert.equal(
    outboundThirdPartyGuardDecision({
      isOutgoingFromPhone: true,
      pairedFromGreenApi: false,
      isGroup: false,
      messageText: "כרמן מה שלומך",
      hasActiveSessionForChat: false,
    }),
    "continue",
  );
});

test("group mention path is orthogonal — private Ana does not notify David", () => {
  // Private inbound from Ana → target is Ana. No path returns David's chatId.
  const target = pickPrivateCarmenTarget({
    pairedFromGreenApi: false,
    counterpartPhone: anaPhone,
    sourcePhoneNumber: davidPhone,
    isOutgoingFromPhone: false,
  });
  assert.equal(target.chatId?.startsWith(davidPhone), false);
  assert.equal(target.reason, "inbound_counterpart");
});

test("unauthorized private LID stays unresolved (ignored by scope, no David reply)", () => {
  const resolved = resolveInboundLidToPhone({
    lidDigits: "111222333444555",
    allowedPhones: allowed,
  });
  assert.equal(resolved.phone, null);
  assert.equal(isPhoneInAllowedList("111222333444555", allowed), false);
  // Even if somehow a phone were present, unauthorized numbers are not allowed.
  assert.equal(isPhoneInAllowedList(unauthorizedPhone, allowed), false);
});

test("real phones are never mistaken for LIDs", () => {
  assert.equal(looksLikeRealPhone(davidPhone), true);
  assert.equal(looksLikeRealPhone("0507677613"), true);
  assert.equal(looksLikeRealPhone(anaLid), false);
  assert.equal(looksLikeRealPhone(davidLid), false);
  assert.equal(isUsableLidKey(davidPhone), false);
  assert.equal(isUsableLidKey(davidLid), true);
  assert.equal(isUsableLidKey("1234"), false);
});

test("inbound LID digits come from LID fields, never from a real-phone `from`", () => {
  // Manus private payload: from/senderPhone = real phone, chatId/senderLid = LID.
  assert.equal(
    pickInboundLidDigits({
      fromRaw: davidPhone,
      chatIdRaw: `${davidLid}@lid`,
      senderLidRaw: davidLid,
    }),
    davidLid,
  );
  // Gateways that deliver the LID in `from` still resolve.
  assert.equal(pickInboundLidDigits({ fromRaw: `${anaLid}@lid` }), anaLid);
  // Plain phone chat: no LID at all.
  assert.equal(pickInboundLidDigits({ fromRaw: `${davidPhone}@c.us` }), "");
});

test("payload real phone wins over the LID for the counterpart", () => {
  assert.equal(pickPayloadRealPhone([null, `${davidLid}@lid`, davidPhone], davidLid), davidPhone);
  assert.equal(pickPayloadRealPhone([davidLid], davidLid), "");
});

test("David's private 'כרמן' message resolves to David, not the connected bot number", () => {
  // Regression: wa_lid_map held a poisoned row keyed by David's OWN phone
  // (lid=972507677613 → phone=972549696673, the bot's number). Every message he
  // sent was re-attributed to the bot and Carmen refused it with scope_phone.
  const lidDigits = pickInboundLidDigits({
    fromRaw: davidPhone,
    chatIdRaw: `${davidLid}@lid`,
    senderLidRaw: davidLid,
  });
  const resolved = resolveInboundLidToPhone({
    lidDigits,
    payloadRealPhone: pickPayloadRealPhone([davidPhone], lidDigits),
    lidAliases: { [davidLid]: davidPhone },
    waLidMapPhone: null,
    allowedPhones: allowed,
  });
  assert.equal(resolved.phone, davidPhone);
  assert.notEqual(resolved.phone, botPhone);
  assert.equal(isPhoneInAllowedList(resolved.phone, allowed), true);
});

test("two WhatsApp accounts on one device never teach wa_lid_map a phone key", () => {
  // David's personal number (green_api) and Carmen's number (manus_wa) sit on the
  // same phone, so Manus mirrors their chat and the Green-API pairing step tried to
  // learn `lid = from`. With a real phone in `from` that produced the poisoned row.
  const learnedFromMirror =
    pickInboundLidDigits({ fromRaw: davidPhone, chatIdRaw: `${davidLid}@lid`, senderLidRaw: davidLid }) ||
    davidPhone;
  assert.equal(learnedFromMirror, davidLid);
  assert.equal(isUsableLidKey(learnedFromMirror), true);

  // No LID field at all: the phone must not be stored as a key.
  const learnedWithoutLid = pickInboundLidDigits({ fromRaw: davidPhone }) || davidPhone;
  assert.equal(learnedWithoutLid, davidPhone);
  assert.equal(isUsableLidKey(learnedWithoutLid), false);
});

test("a phone-shaped LID key resolves to itself instead of the single allowed phone", () => {
  // Regression: another person's phone was treated as a LID and mapped to David
  // via the single-allowed-phone fallback, hijacking his thread.
  const resolved = resolveInboundLidToPhone({
    lidDigits: "972508266089",
    allowedPhones: [davidPhone],
  });
  assert.equal(resolved.phone, "972508266089");
  assert.equal(resolved.reason, "lid_is_real_phone");
});

test("authorized Ana private target never equals David chat", () => {
  const target = pickPrivateCarmenTarget({
    pairedFromGreenApi: false,
    counterpartPhone: anaPhone,
    sourcePhoneNumber: davidPhone,
    isOutgoingFromPhone: false,
  });
  assert.equal(target.phone, anaPhone);
  assert.notEqual(target.chatId, `${davidPhone}@c.us`);
});
