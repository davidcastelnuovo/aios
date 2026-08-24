import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_HEADER_SHORTCUT_KEYS,
  headerShortcutsStorageKey,
  resolveHeaderShortcuts,
  toggleHeaderShortcut,
} from "./headerShortcuts.ts";

const accessible = ["tasks", "clients", "dynamic-tables", "leads", "chat", "dashboard"];

test("new users get tasks, clients and reports when accessible", () => {
  assert.deepEqual(resolveHeaderShortcuts(null, accessible), [...DEFAULT_HEADER_SHORTCUT_KEYS]);
});

test("saved empty selection remains empty", () => {
  assert.deepEqual(resolveHeaderShortcuts("[]", accessible), []);
});

test("corrupt storage recovers to defaults", () => {
  assert.deepEqual(resolveHeaderShortcuts("{bad json", accessible), [...DEFAULT_HEADER_SHORTCUT_KEYS]);
  assert.deepEqual(resolveHeaderShortcuts(JSON.stringify({ tasks: true }), accessible), [...DEFAULT_HEADER_SHORTCUT_KEYS]);
});

test("inaccessible, stale and duplicate modules are removed", () => {
  assert.deepEqual(
    resolveHeaderShortcuts(JSON.stringify(["tasks", "forbidden", "tasks", "leads"]), accessible),
    ["tasks", "leads"],
  );
});

test("shortcut selection is capped and can always be removed", () => {
  const full = ["tasks", "clients", "dynamic-tables", "leads", "chat"];
  assert.deepEqual(toggleHeaderShortcut(full, "dashboard"), full);
  assert.deepEqual(toggleHeaderShortcut(full, "tasks"), ["clients", "dynamic-tables", "leads", "chat"]);
});

test("storage is isolated per user and tenant", () => {
  assert.equal(headerShortcutsStorageKey("user-a", "tenant-a"), "headerShortcuts:user-a:tenant-a");
  assert.notEqual(
    headerShortcutsStorageKey("user-a", "tenant-a"),
    headerShortcutsStorageKey("user-a", "tenant-b"),
  );
});

