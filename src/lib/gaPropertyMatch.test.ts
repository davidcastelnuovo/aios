import assert from "node:assert/strict";
import test from "node:test";
import {
  bestGaPropertyMatch,
  findGaIntegrationForDomain,
  pickGaPropertyForDomain,
} from "./gaPropertyMatch.ts";

test("picks the property whose name is the domain", () => {
  const id = pickGaPropertyForDomain(
    [
      { id: "properties/1", name: "Other Site" },
      { id: "properties/2", name: "example.com" },
    ],
    "https://www.example.com",
  );
  assert.equal(id, "properties/2");
});

test("picks an account named like the domain when the property title is not", () => {
  const id = pickGaPropertyForDomain(
    [
      { id: "properties/1", name: "Hebrew Website", accountName: "Other" },
      { id: "properties/517439257", name: "Law office", accountName: "ggh-law.co.il" },
    ],
    "https://www.ggh-law.co.il/",
  );
  assert.equal(id, "properties/517439257");
});

test("picks the property whose site URL is the domain", () => {
  const id = pickGaPropertyForDomain(
    [
      { id: "properties/1", name: "Periodontics Hebrew Website", accountName: "Dr. Weinberg" },
      { id: "properties/2", name: "Another", websiteUrl: "https://www.periodontics.co.il" },
    ],
    "periodontics.co.il",
  );
  assert.equal(id, "properties/2");
});

test("does not match a different site", () => {
  const id = pickGaPropertyForDomain(
    [{ id: "properties/1", name: "www.drdogs.net", accountName: "Dr Kelev" }],
    "ggh-law.co.il",
  );
  assert.equal(id, null);
});

test("uses the user's own login when a shared login has the same domain", () => {
  const found = bestGaPropertyMatch(
    [
      { integrationId: "anna", own: false, properties: [{ id: "properties/517439257", name: "ggh-law.co.il" }] },
      { integrationId: "yuval", own: true, properties: [{ id: "properties/9", name: "ggh-law.co.il" }] },
    ],
    "ggh-law.co.il",
  );
  assert.equal(found?.integrationId, "yuval");
});

test("keeps a shared login when it is the only match", () => {
  const found = bestGaPropertyMatch(
    [
      { integrationId: "yuval", own: true, properties: [{ id: "properties/1", name: "Other" }] },
      { integrationId: "anna", own: false, properties: [{ id: "properties/517439257", name: "ggh-law.co.il" }] },
    ],
    "ggh-law.co.il",
  );
  assert.equal(found?.integrationId, "anna");
  assert.equal(found?.propertyId, "properties/517439257");
});

test("an explicitly selected shared login wins a tie with the user's own login", () => {
  const found = bestGaPropertyMatch(
    [
      { integrationId: "yuval", own: true, properties: [{ id: "properties/9", name: "ggh-law.co.il" }] },
      { integrationId: "anna", own: false, properties: [{ id: "properties/517439257", name: "ggh-law.co.il" }] },
    ],
    "ggh-law.co.il",
    "anna",
  );
  assert.equal(found?.integrationId, "anna");
});

test("searches every Google login and keeps the current one on a tie", () => {
  const found = bestGaPropertyMatch(
    [
      { integrationId: "anna", properties: [{ id: "properties/517439257", name: "ggh-law.co.il" }] },
      { integrationId: "david", properties: [{ id: "properties/9", name: "ggh-law.co.il" }] },
    ],
    "ggh-law.co.il",
    "david",
  );
  assert.equal(found?.integrationId, "david");
  assert.equal(found?.propertyId, "properties/9");
});

test("falls through to the site-url lookup when names do not match", async () => {
  const calls: Array<{ id: string; matchDomain: string | null }> = [];
  const found = await findGaIntegrationForDomain(
    [{ id: "anna" }],
    "https://periodontics.co.il",
    async (id, matchDomain) => {
      calls.push({ id, matchDomain });
      if (!matchDomain) {
        return [{ id: "properties/520692191", name: "Periodontics Hebrew Website" }];
      }
      return [{
        id: "properties/520692191",
        name: "Periodontics Hebrew Website",
        websiteUrl: "https://www.periodontics.co.il",
      }];
    },
  );
  assert.equal(found?.propertyId, "properties/520692191");
  assert.deepEqual(calls, [
    { id: "anna", matchDomain: null },
    { id: "anna", matchDomain: "periodontics.co.il" },
  ]);
});
