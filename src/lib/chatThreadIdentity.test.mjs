import assert from "node:assert/strict";
import test from "node:test";

import {
  buildChatThreadFilter,
  normalizeChatThreadPhone,
} from "./chatThreadIdentity.mjs";

test("normalizes common Israeli phone formats to one WhatsApp identity", () => {
  assert.equal(normalizeChatThreadPhone("+972-50-767-7613"), "507677613");
  assert.equal(normalizeChatThreadPhone("0507677613"), "507677613");
  assert.equal(normalizeChatThreadPhone("972507677613"), "507677613");
});

test("known leads include linked rows and unlinked rows for the same phone", () => {
  assert.equal(
    buildChatThreadFilter({
      contactId: "lead-id",
      contactType: "lead",
      phone: "972507677613",
    }),
    "lead_id.eq.lead-id,sender_phone.ilike.%507677613",
  );
});

test("clients use the same unified phone identity filter", () => {
  assert.equal(
    buildChatThreadFilter({
      contactId: "client-id",
      contactType: "client",
      phone: "050-767-7613",
    }),
    "client_id.eq.client-id,sender_phone.ilike.%507677613",
  );
});

test("unknown contacts and groups retain their canonical identity", () => {
  assert.equal(
    buildChatThreadFilter({
      contactId: "972507677613",
      contactType: "unknown",
      phone: "972507677613",
    }),
    "sender_phone.ilike.%507677613",
  );
  assert.equal(
    buildChatThreadFilter({
      contactId: "group-id",
      contactType: "group",
      phone: null,
    }),
    "group_id.eq.group-id",
  );
});
