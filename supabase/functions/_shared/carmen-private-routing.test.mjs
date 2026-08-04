import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPrivateRoutingAcceptanceCases,
  isPhoneInAllowedList,
  outboundThirdPartyGuardDecision,
  pickPrivateCarmenTarget,
  resolveInboundLidToPhone,
  shouldMarkResolvedLidAsOutgoing,
} from "./carmen-private-routing.mjs";

const { anaPhone, davidPhone, anaLid, unauthorizedPhone } = buildPrivateRoutingAcceptanceCases();
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
