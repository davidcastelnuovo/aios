import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { emailsCompatible, pickExistingTeamMember } from "./teamMemberMatch.ts";

const original = {
  id: "old",
  full_name: "רעיה כהן",
  email: null,
  active: true,
  created_at: "2024-01-01T00:00:00.000Z",
};
const duplicate = {
  id: "new",
  full_name: "רעיה כהן",
  email: "raya@example.com",
  active: true,
  created_at: "2026-09-24T00:00:00.000Z",
};

test("reuses the existing team member when only the name matches and that row has no email", () => {
  const match = pickExistingTeamMember([original], {
    email: "raya@example.com",
    fullName: "  רעיה   כהן ",
  });
  assert.equal(match?.id, "old");
});

test("email match wins over a different name", () => {
  const match = pickExistingTeamMember(
    [original, { ...duplicate, full_name: "מישהו אחר", email: "raya@example.com" }],
    { email: "Raya@Example.com", fullName: "רעיה כהן" },
  );
  assert.equal(match?.id, "new");
});

test("does not merge two people who share a name but have different emails", () => {
  const match = pickExistingTeamMember(
    [{ ...original, email: "other@example.com" }, duplicate],
    { email: "raya@example.com", fullName: "רעיה כהן" },
  );
  assert.equal(match?.id, "new");
});

test("ignores placeholder names", () => {
  const match = pickExistingTeamMember(
    [{ id: "blank", full_name: "קמפיינר", email: null, active: true, created_at: "2020-01-01T00:00:00.000Z" }],
    { email: "raya@example.com", fullName: "קמפיינר" },
  );
  assert.equal(match, null);
});

test("compatible emails treat a blank address as the same person", () => {
  assert.equal(emailsCompatible(null, "raya@example.com"), true);
  assert.equal(emailsCompatible("a@example.com", "b@example.com"), false);
});

test("app and edge matcher stay the same implementation", () => {
  const app = readFileSync(new URL("./teamMemberMatch.ts", import.meta.url), "utf8");
  const edge = readFileSync(
    new URL("../../supabase/functions/_shared/team-member-match.ts", import.meta.url),
    "utf8",
  );
  assert.equal(app, edge);
});
