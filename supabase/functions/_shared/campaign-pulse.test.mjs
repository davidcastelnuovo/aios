import assert from "node:assert/strict";
import test from "node:test";

import {
  buildHealthWhatsAppDigest,
  buildPulseDashboardAbsoluteUrl,
  buildPulseWhatsAppDigest,
  classifyCampaignPulseStatus,
  countPulseStatuses,
  effectiveIsEcommerce,
  pickFreshestTablePerPlatform,
  resolveLastSyncAt,
  isSyncStale,
  pulseSurfacePrefersWhatsAppDigest,
} from "./campaign-pulse.ts";

const NOW = Date.parse("2026-08-03T12:00:00.000Z");
const FRESH = "2026-08-03T10:00:00.000Z";
const DAY_OLD = "2026-08-02T12:30:00.000Z"; // ~23.5h — must NOT be stale (twice-daily cadence)
const STALE = "2026-07-20T08:00:00.000Z";
const VERY_OLD_COLUMN = "2026-03-27T04:00:00.000Z";

test("resolveLastSyncAt prefers freshest of column vs settings", () => {
  assert.equal(
    resolveLastSyncAt({
      last_sync_at: VERY_OLD_COLUMN,
      integration_settings: { last_sync_at: FRESH },
    }),
    FRESH,
  );
  assert.equal(
    resolveLastSyncAt({
      last_sync_at: null,
      integration_settings: { last_sync_at: STALE },
    }),
    STALE,
  );
  assert.equal(resolveLastSyncAt({ last_sync_at: null, integration_settings: {} }), null);
});

test("isSyncStale uses freshest timestamp", () => {
  assert.equal(
    isSyncStale({
      last_sync_at: VERY_OLD_COLUMN,
      integration_settings: { last_sync_at: FRESH },
    }, NOW),
    false,
  );
  assert.equal(
    isSyncStale({
      last_sync_at: null,
      integration_settings: { last_sync_at: STALE },
    }, NOW),
    true,
  );
});

test("isSyncStale tolerates ~24h gap (twice-daily sync + morning race)", () => {
  assert.equal(
    isSyncStale({
      last_sync_at: DAY_OLD,
      integration_settings: {},
    }, NOW),
    false,
  );
});

test("pickFreshestTablePerPlatform ignores abandoned Meta duplicate", () => {
  const picked = pickFreshestTablePerPlatform([
    {
      integration_type: "facebook_ecommerce",
      campaign_active: true,
      last_sync_at: null,
      integration_settings: { last_sync_at: STALE },
    },
    {
      integration_type: "facebook_insights",
      campaign_active: true,
      last_sync_at: FRESH,
      integration_settings: {},
    },
    {
      integration_type: "google_ads",
      campaign_active: true,
      last_sync_at: DAY_OLD,
      integration_settings: {},
    },
  ]);
  assert.equal(picked.length, 2);
  assert.equal(
    picked.find((t) => t.integration_type?.startsWith("facebook"))?.integration_type,
    "facebook_insights",
  );
  assert.ok(picked.some((t) => t.integration_type === "google_ads"));
});

test("fresh Meta sibling keeps platform healthy despite abandoned ecommerce row", () => {
  const result = classifyCampaignPulseStatus({
    activeTables: [
      {
        integration_type: "google_ads",
        campaign_active: true,
        last_sync_at: FRESH,
        integration_settings: {},
      },
      {
        integration_type: "facebook_insights",
        campaign_active: true,
        last_sync_at: FRESH,
        integration_settings: {},
      },
      {
        integration_type: "facebook_ecommerce",
        campaign_active: true,
        last_sync_at: null,
        integration_settings: { last_sync_at: STALE },
      },
    ],
    hasConfiguredCampaignTable: true,
    recentRecordCount: 20,
    isEcommerce: true,
    spend7: 900,
    leads7: 0,
    purchases7: 12,
    roas: 2.5,
    cplChangePct: null,
    nowMs: NOW,
  });
  assert.equal(result.status, "healthy");
  assert.deepEqual(result.stalePlatforms, []);
});

test("health WhatsApp digest is short counts + dashboard link (no per-client list)", () => {
  const digest = buildHealthWhatsAppDigest({
    activeConnections: 40,
    systemChecks: 8,
    okChecks: 7,
    issueCount: 18,
    dashboardUrl: buildPulseDashboardAbsoluteUrl("marketingcaptain"),
  });
  assert.match(digest, /בדיקת תקינות מערכות וקמפיינים/);
  assert.match(digest, /נמצאו 18 נקודות לטיפול/);
  assert.match(digest, /https:\/\/aios\.co\.il\/t\/marketingcaptain\/dmm-dashboard/);
  assert.equal(digest.includes("ארבע על ארבע"), false);
  assert.equal(digest.includes("בילבי"), false);
  assert.equal(digest.includes("Meta:"), false);
});

test("effectiveIsEcommerce follows facebook_ecommerce tables", () => {
  assert.equal(effectiveIsEcommerce(false, [{ integration_type: "google_ads", campaign_active: true }]), false);
  assert.equal(
    effectiveIsEcommerce(false, [{ integration_type: "facebook_ecommerce", campaign_active: true }]),
    true,
  );
  assert.equal(
    effectiveIsEcommerce(false, [{ integration_type: "facebook_ecommerce", campaign_active: false }]),
    false,
  );
  assert.equal(effectiveIsEcommerce(true, []), true);
});

test("connected client with no recent rows is warning/stale, not no_data", () => {
  const result = classifyCampaignPulseStatus({
    activeTables: [{
      integration_type: "facebook_ecommerce",
      campaign_active: true,
      last_sync_at: null,
      integration_settings: { last_sync_at: STALE },
    }],
    hasConfiguredCampaignTable: true,
    recentRecordCount: 0,
    isEcommerce: true,
    spend7: 0,
    leads7: 0,
    purchases7: 0,
    roas: null,
    cplChangePct: null,
    nowMs: NOW,
  });
  assert.equal(result.status, "warning");
  assert.ok(result.flags.some((flag) => flag.includes("סנכרון ישן או חסר")));
  assert.deepEqual(result.stalePlatforms, ["Meta"]);
});

test("missing campaign table is no_data", () => {
  const result = classifyCampaignPulseStatus({
    activeTables: [],
    hasConfiguredCampaignTable: false,
    recentRecordCount: 0,
    isEcommerce: false,
    spend7: 0,
    leads7: 0,
    purchases7: 0,
    roas: null,
    cplChangePct: null,
    nowMs: NOW,
  });
  assert.equal(result.status, "no_data");
  assert.deepEqual(result.flags, ["אין טבלת קמפיין מחוברת"]);
});

test("ecommerce spend without purchases is critical (not lead CPL)", () => {
  const result = classifyCampaignPulseStatus({
    activeTables: [{
      integration_type: "facebook_ecommerce",
      campaign_active: true,
      last_sync_at: FRESH,
      integration_settings: {},
    }],
    hasConfiguredCampaignTable: true,
    recentRecordCount: 10,
    isEcommerce: true,
    spend7: 200,
    leads7: 0,
    purchases7: 0,
    roas: null,
    cplChangePct: null,
    nowMs: NOW,
  });
  assert.equal(result.status, "critical");
  assert.deepEqual(result.flags, ["הוצאה ללא רכישות"]);
});

test("fresh google sync with metrics stays healthy even if column is old", () => {
  const result = classifyCampaignPulseStatus({
    activeTables: [{
      integration_type: "google_ads",
      campaign_active: true,
      last_sync_at: VERY_OLD_COLUMN,
      integration_settings: { last_sync_at: FRESH },
    }],
    hasConfiguredCampaignTable: true,
    recentRecordCount: 8,
    isEcommerce: false,
    spend7: 900,
    leads7: 10,
    purchases7: 0,
    roas: null,
    cplChangePct: 5,
    nowMs: NOW,
  });
  assert.equal(result.status, "healthy");
  assert.deepEqual(result.flags, []);
});

test("stale platform on otherwise healthy client becomes warning", () => {
  const result = classifyCampaignPulseStatus({
    activeTables: [
      {
        integration_type: "google_ads",
        campaign_active: true,
        last_sync_at: FRESH,
        integration_settings: {},
      },
      {
        integration_type: "facebook_ecommerce",
        campaign_active: true,
        last_sync_at: null,
        integration_settings: { last_sync_at: STALE },
      },
    ],
    hasConfiguredCampaignTable: true,
    recentRecordCount: 20,
    isEcommerce: true,
    spend7: 900,
    leads7: 0,
    purchases7: 12,
    roas: 2.5,
    cplChangePct: null,
    nowMs: NOW,
  });
  assert.equal(result.status, "warning");
  assert.ok(result.flags.some((flag) => flag.includes("Meta")));
});

test("client without a documented call in 14 days becomes warning", () => {
  const result = classifyCampaignPulseStatus({
    activeTables: [{
      integration_type: "facebook_insights",
      campaign_active: true,
      last_sync_at: FRESH,
      integration_settings: {},
    }],
    hasConfiguredCampaignTable: true,
    recentRecordCount: 20,
    isEcommerce: false,
    spend7: 900,
    leads7: 10,
    purchases7: 0,
    roas: null,
    cplChangePct: 5,
    lastClientCallAt: "2026-07-15T12:00:00.000Z",
    nowMs: NOW,
  });
  assert.equal(result.status, "warning");
  assert.ok(result.flags.some((flag) => flag.includes("14 הימים")));
});

test("client call within 14 days keeps healthy campaign healthy", () => {
  const result = classifyCampaignPulseStatus({
    activeTables: [{
      integration_type: "facebook_insights",
      campaign_active: true,
      last_sync_at: FRESH,
      integration_settings: {},
    }],
    hasConfiguredCampaignTable: true,
    recentRecordCount: 20,
    isEcommerce: false,
    spend7: 900,
    leads7: 10,
    purchases7: 0,
    roas: null,
    cplChangePct: 5,
    lastClientCallAt: "2026-07-25T12:00:00.000Z",
    nowMs: NOW,
  });
  assert.equal(result.status, "healthy");
  assert.deepEqual(result.flags, []);
});

test("client with no documented call is flagged", () => {
  const result = classifyCampaignPulseStatus({
    activeTables: [{
      integration_type: "google_ads",
      campaign_active: true,
      last_sync_at: FRESH,
      integration_settings: {},
    }],
    hasConfiguredCampaignTable: true,
    recentRecordCount: 20,
    isEcommerce: false,
    spend7: 900,
    leads7: 10,
    purchases7: 0,
    roas: null,
    cplChangePct: 5,
    lastClientCallAt: null,
    nowMs: NOW,
  });
  assert.equal(result.status, "warning");
  assert.deepEqual(result.flags, ["לא תועדה שיחה טלפונית עם הלקוח"]);
});

test("WhatsApp pulse digest is short counts + dashboard link (no markdown table)", () => {
  const digest = buildPulseWhatsAppDigest(
    [
      { status: "healthy" },
      { status: "warning" },
      { status: "no_data" },
      { status: "critical" },
    ],
    "https://aios.co.il/t/marketingcaptain/dmm-dashboard",
  );
  assert.match(digest, /בדיקת דופק הושלמה/);
  assert.match(digest, /🟢 1 תקינים/);
  assert.match(digest, /🟡 2 לתשומת לב/);
  assert.match(digest, /🔴 1 קריטיים/);
  assert.match(digest, /https:\/\/aios\.co\.il\/t\/marketingcaptain\/dmm-dashboard/);
  assert.match(digest, /לא בוואטסאפ/);
  assert.equal(digest.includes("| סוכנות |"), false);
  assert.equal(digest.includes("חושבה ב־"), false);
  const counts = countPulseStatuses([
    { status: "healthy" },
    { status: "warning" },
    { status: "no_data" },
    { status: "critical" },
  ]);
  assert.equal(counts.attention, 2);
  assert.equal(pulseSurfacePrefersWhatsAppDigest("whatsapp"), true);
  assert.equal(pulseSurfacePrefersWhatsAppDigest("task"), true);
  assert.equal(pulseSurfacePrefersWhatsAppDigest("internal_chat"), false);
});
