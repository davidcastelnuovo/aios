import assert from "node:assert/strict";
import test from "node:test";
import {
  getCachedReportScreenshot,
  setCachedReportScreenshot,
  hasFreshReportScreenshot,
  pickPrimaryReportTable,
} from "./reportScreenshotCache.ts";

// Minimal localStorage shim for node test runner.
if (typeof globalThis.localStorage === "undefined") {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
    key: () => null,
    get length() {
      return store.size;
    },
  } as Storage;
}

test("report screenshot cache round-trips", () => {
  localStorage.clear();
  const id = "table-a";
  const dataUrl = "data:image/jpeg;base64," + "x".repeat(250);
  setCachedReportScreenshot(id, dataUrl);
  assert.equal(getCachedReportScreenshot(id), dataUrl);
  assert.equal(hasFreshReportScreenshot(id), true);
});

test("report screenshot cache rejects tiny payloads", () => {
  localStorage.clear();
  setCachedReportScreenshot("tiny", "data:short");
  assert.equal(getCachedReportScreenshot("tiny"), null);
});

test("pickPrimaryReportTable prefers facebook ads over seo", () => {
  const tables = [
    { id: "1", slug: "seo", client_id: "c1", integration_type: "ahrefs" },
    { id: "2", slug: "fb", client_id: "c1", integration_type: "facebook_insights" },
    { id: "3", slug: "gads", client_id: "c1", integration_type: "google_ads", campaign_active: false },
    { id: "4", slug: "other", client_id: "c2", integration_type: "facebook_insights" },
  ];
  assert.equal(pickPrimaryReportTable(tables, "c1")?.id, "2");
});

test("pickPrimaryReportTable skips inactive campaigns", () => {
  const onlyInactive = [
    { id: "3", slug: "gads", client_id: "c1", integration_type: "google_ads", campaign_active: false },
  ];
  assert.equal(pickPrimaryReportTable(onlyInactive, "c1"), null);
});
