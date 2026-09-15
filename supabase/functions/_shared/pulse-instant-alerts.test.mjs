import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_PULSE_ALERT_RULES,
  evaluatePulseInstantAlerts,
  parsePulseAlertRules,
} from "./pulse-instant-alerts.ts";

test("parsePulseAlertRules applies defaults", () => {
  assert.deepEqual(parsePulseAlertRules(null), DEFAULT_PULSE_ALERT_RULES);
  assert.equal(parsePulseAlertRules({ cpl_spike_pct: 60 }).cpl_spike_pct, 60);
});

test("evaluatePulseInstantAlerts detects no contact and CPL spike", () => {
  const now = Date.parse("2026-09-15T07:00:00+03:00");
  const rows = evaluatePulseInstantAlerts(
    [{
      client_id: "c1",
      client_name: "Acme",
      status: "warning",
      cpl_change_pct: 55,
      flags: [],
      last_client_call_at: null,
    }],
    [],
    DEFAULT_PULSE_ALERT_RULES,
    now,
  );
  assert.equal(rows.length, 2);
  assert.ok(rows.some((row) => row.rule_type === "no_contact"));
  assert.ok(rows.some((row) => row.rule_type === "cpl_spike"));
});

test("evaluatePulseInstantAlerts respects disabled master switch", () => {
  const rows = evaluatePulseInstantAlerts(
    [{ client_id: "c1", client_name: "Acme", cpl_change_pct: 99, flags: [] }],
    [],
    { ...DEFAULT_PULSE_ALERT_RULES, instant_wa_enabled: false },
  );
  assert.deepEqual(rows, []);
});
