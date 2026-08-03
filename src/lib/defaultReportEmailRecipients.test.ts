import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDefaultReportRecipientEmails,
  buildReportEmailOptions,
  DEFAULT_REPORT_EMAIL_RECIPIENTS,
} from "./defaultReportEmailRecipients.ts";

test("default recipients include Anna, David, DMM", () => {
  const emails = buildDefaultReportRecipientEmails(null);
  assert.deepEqual(emails, [
    "adamchik2301@gmail.com",
    "david.castelnuovo@gmail.com",
    "dmm4business@gmail.com",
  ]);
});

test("default recipients append client email once", () => {
  const emails = buildDefaultReportRecipientEmails("Client@Example.com");
  assert.equal(emails.length, 4);
  assert.ok(emails.includes("client@example.com"));
});

test("options list dedupes team member overlapping defaults", () => {
  const options = buildReportEmailOptions({
    clientEmail: "client@x.com",
    clientName: "לקוח",
    teamMembers: [
      {
        role_on_account: "seo",
        campaigners: { full_name: "Anna", email: "adamchik2301@gmail.com" },
      },
    ],
  });
  const emails = options.map((o) => o.email);
  assert.equal(new Set(emails).size, emails.length);
  assert.ok(emails.includes("client@x.com"));
  assert.equal(DEFAULT_REPORT_EMAIL_RECIPIENTS.length, 3);
});
