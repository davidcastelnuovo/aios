import assert from "node:assert/strict";
import test from "node:test";
import {
  copyDepartmentItemStorageKey,
  isLegacyDepartmentClientSlug,
  isMarketingDepartmentId,
  marketingDepartmentPath,
} from "./marketingRoutes.ts";

test("isMarketingDepartmentId recognizes department slugs", () => {
  assert.equal(isMarketingDepartmentId("copy"), true);
  assert.equal(isMarketingDepartmentId("creative"), true);
  assert.equal(isMarketingDepartmentId("department"), false);
  assert.equal(isMarketingDepartmentId("client-uuid"), false);
});

test("isLegacyDepartmentClientSlug matches department ids only", () => {
  assert.equal(isLegacyDepartmentClientSlug("copy"), true);
  assert.equal(isLegacyDepartmentClientSlug("department"), false);
});

test("marketingDepartmentPath preserves query params", () => {
  const params = new URLSearchParams({ client: "all", item: "proj-1" });
  assert.equal(
    marketingDepartmentPath("acme", "copy", params),
    "/t/acme/marketing/department/copy?client=all&item=proj-1",
  );
});

test("copyDepartmentItemStorageKey is tenant scoped", () => {
  assert.equal(copyDepartmentItemStorageKey("tenant-a"), "copy-dept-item:tenant-a");
});
