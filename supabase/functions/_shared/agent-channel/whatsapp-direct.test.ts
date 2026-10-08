import assert from "node:assert/strict";
import test from "node:test";
import {
  isOwnerSender,
  parseWhatsAppDirectCommand,
  whatsAppReplyText,
} from "./whatsapp-direct-logic.ts";

test("parses Claude and Cursor prefixes in Hebrew and English", () => {
  assert.deepEqual(parseWhatsAppDirectCommand("קלוד תבדוק את הדופק"), {
    provider: "claude",
    content: "תבדוק את הדופק",
  });
  assert.deepEqual(parseWhatsAppDirectCommand("  Claude: fix the report"), {
    provider: "claude",
    content: "fix the report",
  });
  assert.deepEqual(parseWhatsAppDirectCommand("קרסר, תפתח PR"), {
    provider: "cursor",
    content: "תפתח PR",
  });
  assert.deepEqual(parseWhatsAppDirectCommand("cursor - run tests"), {
    provider: "cursor",
    content: "run tests",
  });
});

test("ignores Carmen messages, bare triggers and words that only start with the trigger", () => {
  assert.equal(parseWhatsAppDirectCommand("כרמן מה קורה"), null);
  assert.equal(parseWhatsAppDirectCommand("קלוד"), null);
  assert.equal(parseWhatsAppDirectCommand("claudette hello"), null);
  assert.equal(parseWhatsAppDirectCommand("מה עם קלוד?"), null);
});

test("own reply echo never re-triggers a channel", () => {
  assert.equal(
    parseWhatsAppDirectCommand(whatsAppReplyText("claude", "OK")),
    null,
  );
  assert.equal(
    parseWhatsAppDirectCommand(whatsAppReplyText("cursor", "קלוד done")),
    null,
  );
});

test("only the owner writing from their profile phone may open a direct channel", () => {
  assert.equal(
    isOwnerSender({
      senderPhone: "972501234567",
      ownerPhones: [null, "050-123-4567"],
      roles: ["owner"],
    }),
    true,
  );
  assert.equal(
    isOwnerSender({
      senderPhone: "972501234567",
      ownerPhones: [null, "050-123-4567"],
      roles: ["campaigner"],
    }),
    false,
  );
  assert.equal(
    isOwnerSender({
      senderPhone: "972509999999",
      ownerPhones: [null, "050-123-4567"],
      roles: ["owner"],
    }),
    false,
  );
  assert.equal(
    isOwnerSender({ senderPhone: "", ownerPhones: [""], roles: ["owner"] }),
    false,
  );
});
