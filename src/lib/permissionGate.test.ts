import assert from "node:assert/strict";
import test from "node:test";
import { resolvePermissionGateView, type PermissionGateState } from "./permissionGate.ts";

function state(overrides: Partial<PermissionGateState> = {}): PermissionGateState {
  return {
    permission: "lead_integrations",
    isSuperAdmin: false,
    isLoading: false,
    isFetching: false,
    isError: false,
    isReady: true,
    isFetchedAfterMount: true,
    allowed: true,
    ...overrides,
  };
}

test("super-admin always sees the page, even if permissions query failed", () => {
  assert.equal(
    resolvePermissionGateView(state({
      isSuperAdmin: true,
      isError: true,
      isReady: false,
      isFetchedAfterMount: false,
      allowed: false,
    })),
    "children",
  );
});

test("routes without a permission check never block", () => {
  assert.equal(
    resolvePermissionGateView(state({ permission: undefined, allowed: false })),
    "children",
  );
});

test("stale error with cached access does not flash error UI", () => {
  assert.equal(
    resolvePermissionGateView(state({
      isError: true,
      isFetching: false,
      isReady: true,
      isFetchedAfterMount: false,
      allowed: true,
    })),
    "children",
  );
});

test("cached error without data does not flash error or redirect on first paint", () => {
  assert.equal(
    resolvePermissionGateView(state({
      isError: true,
      isReady: false,
      isFetchedAfterMount: false,
      allowed: false,
    })),
    "skeleton",
  );
});

test("settled load failure without data shows the retry error", () => {
  assert.equal(
    resolvePermissionGateView(state({
      isError: true,
      isFetching: false,
      isReady: false,
      isFetchedAfterMount: true,
      allowed: false,
    })),
    "error",
  );
});

test("error that is currently refetching stays on skeleton, not error UI", () => {
  assert.equal(
    resolvePermissionGateView(state({
      isError: true,
      isFetching: true,
      isReady: false,
      isFetchedAfterMount: true,
      allowed: false,
    })),
    "skeleton",
  );
});

test("missing permission after a successful load redirects", () => {
  assert.equal(
    resolvePermissionGateView(state({ allowed: false })),
    "redirect",
  );
});

test("first load shows skeleton", () => {
  assert.equal(
    resolvePermissionGateView(state({
      isLoading: true,
      isReady: false,
      isFetchedAfterMount: false,
      allowed: false,
    })),
    "skeleton",
  );
});
