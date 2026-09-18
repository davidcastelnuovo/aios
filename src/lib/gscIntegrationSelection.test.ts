import assert from "node:assert/strict";
import test from "node:test";
import { pickGscIntegration, hasAccessToSite } from "./gscIntegrationSelection.ts";
import { seoDomainsMatch } from "./seoDomain.ts";

const CLIENT = "client-1";
const SITE = "https://www.zommer-law.com/";

const pinned = {
  id: "pinned",
  settings: {
    google_email: "david@example.com",
    available_sites: [{ siteUrl: SITE, permissionLevel: "siteOwner" }],
  },
};

const otherWithAccess = {
  id: "other-with-access",
  settings: {
    google_email: "yuval@example.com",
    available_sites: [{ siteUrl: "sc-domain:zommer-law.com", permissionLevel: "siteFullUser" }],
  },
};

const otherWithoutAccess = {
  id: "other-without-access",
  settings: {
    google_email: "anna@example.com",
    client_sites: { [CLIENT]: "https://www.another-client.com/" },
    available_sites: [{ siteUrl: "https://www.another-client.com/", permissionLevel: "siteOwner" }],
  },
};

test("pinned account wins over a connection already mapped to the client", () => {
  const result = pickGscIntegration({
    integrations: [otherWithoutAccess, pinned],
    clientId: CLIENT,
    selectedIntegrationId: pinned.id,
    requestedSiteUrl: SITE,
    siteMatcher: seoDomainsMatch,
  });
  assert.equal(result.source, "explicit");
  assert.equal(result.integration?.id, pinned.id);
});

test("stale pinned account keeps the selection when no other account has the property", () => {
  const result = pickGscIntegration({
    integrations: [pinned, otherWithoutAccess],
    clientId: CLIENT,
    selectedIntegrationId: pinned.id,
    brokenIntegrationIds: new Set([pinned.id]),
    fallbackIntegrationId: otherWithoutAccess.id,
    fallbackSiteUrl: "https://www.another-client.com/",
    requestedSiteUrl: SITE,
    siteMatcher: seoDomainsMatch,
  });
  assert.equal(result.source, "explicit-needs-reconnect");
  assert.equal(result.integration?.id, pinned.id);
  assert.equal(result.pinnedIntegration?.id, pinned.id);
});

test("stale pinned account hands over only to an account holding the property", () => {
  const result = pickGscIntegration({
    integrations: [pinned, otherWithoutAccess, otherWithAccess],
    clientId: CLIENT,
    selectedIntegrationId: pinned.id,
    brokenIntegrationIds: new Set([pinned.id]),
    requestedSiteUrl: SITE,
    siteMatcher: seoDomainsMatch,
  });
  assert.equal(result.source, "substitute");
  assert.equal(result.integration?.id, otherWithAccess.id);
  assert.equal(result.pinnedIntegration?.id, pinned.id);
});

test("org-wide connection stands in only when it resolved the requested property", () => {
  const base = {
    integrations: [pinned],
    clientId: CLIENT,
    selectedIntegrationId: pinned.id,
    brokenIntegrationIds: new Set([pinned.id]),
    fallbackIntegrationId: "org-wide",
    requestedSiteUrl: SITE,
    siteMatcher: seoDomainsMatch,
  };

  const matching = pickGscIntegration({ ...base, fallbackSiteUrl: "sc-domain:zommer-law.com" });
  assert.equal(matching.source, "substitute");
  assert.equal(matching.integration, null);

  const mismatching = pickGscIntegration({ ...base, fallbackSiteUrl: "https://www.another-client.com/" });
  assert.equal(mismatching.source, "explicit-needs-reconnect");
  assert.equal(mismatching.integration?.id, pinned.id);
});

test("an unknown property never justifies switching accounts", () => {
  const result = pickGscIntegration({
    integrations: [pinned, otherWithAccess],
    clientId: CLIENT,
    selectedIntegrationId: pinned.id,
    brokenIntegrationIds: new Set([pinned.id]),
    requestedSiteUrl: "",
    siteMatcher: seoDomainsMatch,
  });
  assert.equal(result.source, "explicit-needs-reconnect");
  assert.equal(result.integration?.id, pinned.id);
});

test("without a pinned account the mapped connection is used, then the org-wide one", () => {
  const mapped = pickGscIntegration({
    integrations: [otherWithAccess, otherWithoutAccess],
    clientId: CLIENT,
    requestedSiteUrl: SITE,
    siteMatcher: seoDomainsMatch,
  });
  assert.equal(mapped.source, "mapped");
  assert.equal(mapped.integration?.id, otherWithoutAccess.id);

  const fallback = pickGscIntegration({
    integrations: [otherWithAccess],
    clientId: CLIENT,
    fallbackIntegrationId: "org-wide",
    requestedSiteUrl: SITE,
    siteMatcher: seoDomainsMatch,
  });
  assert.equal(fallback.source, "fallback");
  assert.equal(fallback.integration, null);

  const first = pickGscIntegration({
    integrations: [otherWithAccess],
    clientId: CLIENT,
    requestedSiteUrl: SITE,
    siteMatcher: seoDomainsMatch,
  });
  assert.equal(first.source, "first");
  assert.equal(first.integration?.id, otherWithAccess.id);
});

test("properties without granted access do not count as access", () => {
  const unverified = {
    id: "unverified",
    settings: { available_sites: [{ siteUrl: SITE, permissionLevel: "siteUnverifiedUser" }] },
  };
  assert.equal(hasAccessToSite(unverified, SITE, seoDomainsMatch), false);
  assert.equal(hasAccessToSite(otherWithAccess, SITE, seoDomainsMatch), true);
});
