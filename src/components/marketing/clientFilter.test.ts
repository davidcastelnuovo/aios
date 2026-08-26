import assert from "node:assert/strict";
import test from "node:test";
import {
  ALL_CLIENTS_FILTER,
  applyClientFilter,
  clientFilterToParam,
  entryClientFilter,
  parseClientFilter,
  resolveCreativeListFilter,
} from "./clientFilter.ts";

test("entry to creative always uses every client", () => {
  assert.equal(entryClientFilter("creative", null), ALL_CLIENTS_FILTER);
  assert.equal(entryClientFilter("creative", "client-1"), ALL_CLIENTS_FILTER);
  assert.equal(entryClientFilter("copy", "client-1"), "client-1");
  assert.equal(entryClientFilter("copy", null), null);
  assert.equal(clientFilterToParam(entryClientFilter("creative", null)), "all");
});

test("parseClientFilter maps a missing param to every client, not unassigned-only", () => {
  assert.equal(parseClientFilter("all"), ALL_CLIENTS_FILTER);
  assert.equal(parseClientFilter(null), ALL_CLIENTS_FILTER);
  assert.equal(parseClientFilter(""), ALL_CLIENTS_FILTER);
  assert.equal(parseClientFilter("general"), null);
  assert.equal(parseClientFilter("abc"), "abc");
  assert.equal(clientFilterToParam(null), "general");
  assert.equal(clientFilterToParam(ALL_CLIENTS_FILTER), "all");
});

test("creative list filter never treats a missing client as unassigned-only", () => {
  assert.equal(resolveCreativeListFilter(null), ALL_CLIENTS_FILTER);
  assert.equal(resolveCreativeListFilter(ALL_CLIENTS_FILTER), ALL_CLIENTS_FILTER);
  assert.equal(resolveCreativeListFilter("client-1"), "client-1");
});

test("applyClientFilter does not constrain the query for all clients", () => {
  const calls: string[] = [];
  const query = {
    eq(col: string, val: string) {
      calls.push(`eq:${col}:${val}`);
      return this;
    },
    is(col: string, val: null) {
      calls.push(`is:${col}:${val}`);
      return this;
    },
  };
  applyClientFilter(query, ALL_CLIENTS_FILTER);
  applyClientFilter(query, "client-1");
  applyClientFilter(query, null);
  assert.deepEqual(calls, ["eq:client_id:client-1", "is:client_id:null"]);
});
