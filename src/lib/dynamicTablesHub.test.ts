import assert from "node:assert/strict";
import { test } from "node:test";
import {
  appendCategorySearchParam,
  DYNAMIC_TABLES_CATEGORY_PARAM,
  stripCategorySearchParam,
} from "./dynamicTablesHub.ts";

test("appendCategorySearchParam adds category to tenant path", () => {
  const path = appendCategorySearchParam("/t/demo/dynamic-tables", "SEO");
  assert.equal(path, `/t/demo/dynamic-tables?${DYNAMIC_TABLES_CATEGORY_PARAM}=SEO`);
});

test("stripCategorySearchParam returns hub path", () => {
  const path = stripCategorySearchParam(`/t/demo/dynamic-tables?${DYNAMIC_TABLES_CATEGORY_PARAM}=SEO&tab=tables`);
  assert.equal(path, "/t/demo/dynamic-tables?tab=tables");
});

test("stripCategorySearchParam removes only category param", () => {
  assert.equal(
    stripCategorySearchParam(`/t/demo/dynamic-tables?${DYNAMIC_TABLES_CATEGORY_PARAM}=SEO`),
    "/t/demo/dynamic-tables",
  );
});
