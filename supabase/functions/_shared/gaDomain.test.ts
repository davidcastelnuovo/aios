import assert from "node:assert/strict";
import test from "node:test";
import { gaHostsMatch, listedPropertyMatchesDomain, normalizeGaHost } from "./gaDomain.ts";

test("normalizes a pasted website to a host", () => {
  assert.equal(normalizeGaHost("https://www.ggh-law.co.il/about"), "ggh-law.co.il");
});

test("matches a property account name to the domain", () => {
  assert.equal(
    listedPropertyMatchesDomain(
      { name: "Law office", accountName: "ggh-law.co.il" },
      "https://www.ggh-law.co.il/",
    ),
    true,
  );
});

test("a display name that is not the domain does not match", () => {
  assert.equal(
    listedPropertyMatchesDomain(
      { name: "Periodontics Hebrew Website", accountName: "Dr. Weinberg" },
      "periodontics.co.il",
    ),
    false,
  );
  assert.equal(gaHostsMatch("https://www.periodontics.co.il", "periodontics.co.il"), true);
});
