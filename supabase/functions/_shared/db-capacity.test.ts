import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCapacityWhatsApp,
  classifyPressure,
  extractComputeVariant,
  nextComputeVariant,
  shouldNotify,
  shouldScale,
} from "./db-capacity.ts";

test("classifyPressure uses 70/85 bands", () => {
  assert.equal(classifyPressure(10), "ok");
  assert.equal(classifyPressure(70), "warn");
  assert.equal(classifyPressure(84.9), "warn");
  assert.equal(classifyPressure(85), "critical");
  assert.equal(classifyPressure(99, false), "down");
  assert.equal(classifyPressure(null), "down");
});

test("shouldScale only at 92%+ when reachable", () => {
  assert.equal(shouldScale(91), false);
  assert.equal(shouldScale(92), true);
  assert.equal(shouldScale(95, false), false);
});

test("nextComputeVariant climbs one step and respects the cap", () => {
  assert.equal(nextComputeVariant("ci_micro"), "ci_small");
  assert.equal(nextComputeVariant("small"), "ci_medium");
  assert.equal(nextComputeVariant("ci_large", "ci_large"), null);
  assert.equal(nextComputeVariant("ci_medium", "ci_small"), null);
  assert.equal(nextComputeVariant(null), "ci_small");
});

test("extractComputeVariant reads common Management API shapes", () => {
  assert.equal(extractComputeVariant({ addon_variant: "ci_medium" }), "ci_medium");
  assert.equal(
    extractComputeVariant({ addons: [{ addon_type: "compute_instance", addon_variant: "ci_small" }] }),
    "ci_small",
  );
  assert.equal(extractComputeVariant({ database: { infra_compute_size: "large" } }), "ci_large");
  assert.equal(extractComputeVariant({ addons: [] }), null);
});

test("shouldNotify recovers once and otherwise follows the claim", () => {
  assert.equal(shouldNotify({ level: "ok", previousLevel: "critical", claimed: false }), true);
  assert.equal(shouldNotify({ level: "ok", previousLevel: "ok", claimed: false }), false);
  assert.equal(shouldNotify({ level: "warn", claimed: true }), true);
  assert.equal(shouldNotify({ level: "warn", claimed: false }), false);
});

test("WhatsApp copy stays short and Hebrew", () => {
  const warn = buildCapacityWhatsApp({
    level: "warn",
    snapshot: {
      used: 45, max: 60, used_pct: 75, active: 10, idle: 30, idle_in_transaction: 5,
    },
  });
  assert.match(warn, /75%/);
  assert.match(warn, /45\/60/);
  assert.doesNotMatch(warn, /PGRST/);

  const scaled = buildCapacityWhatsApp({
    level: "critical",
    snapshot: { used: 55, max: 60, used_pct: 94, active: 40, idle: 10, idle_in_transaction: 5 },
    scaledFrom: "ci_small",
    scaledTo: "ci_medium",
  });
  assert.match(scaled, /ci_medium/);
});
