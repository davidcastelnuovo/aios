import assert from "node:assert/strict";
import test from "node:test";
import {
  crmWhatsappFunctionName,
  pickCrmWhatsappIntegration,
} from "./crmWhatsappRoute.ts";

const green = { id: "g1", integration_type: "green_api", user_id: "u1" };
const manus = { id: "m1", integration_type: "manus_wa", user_id: "u2" };
const meta = { id: "x1", integration_type: "meta_whatsapp", user_id: null };

test("prefers the lead's active CRM WhatsApp provider", () => {
  const picked = pickCrmWhatsappIntegration("manus_wa", [green, manus, meta]);
  assert.equal(picked?.id, "m1");
  assert.equal(picked?.type, "manus_wa");
});

test("falls back to green_api then manus then meta", () => {
  assert.equal(pickCrmWhatsappIntegration(null, [meta, manus, green])?.type, "green_api");
  assert.equal(pickCrmWhatsappIntegration(null, [meta, manus])?.type, "manus_wa");
  assert.equal(pickCrmWhatsappIntegration("telegram", [meta])?.type, "meta_whatsapp");
});

test("maps provider to the CRM send function", () => {
  assert.equal(crmWhatsappFunctionName("green_api"), "send-green-api-message");
  assert.equal(crmWhatsappFunctionName("manus_wa"), "send-manus-wa-message");
  assert.equal(crmWhatsappFunctionName("meta_whatsapp"), "send-meta-whatsapp-message");
});
