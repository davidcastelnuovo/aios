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

test("campaign exception includes target, evidence and last-change context", () => {
  const rows = evaluatePulseInstantAlerts(
    [{
      client_id: "c1",
      client_name: "Acme",
      flags: [],
      campaign_breakdown: [{
        campaign_key: "meta:id:123",
        campaign_name: "Leads",
        goal: "leads",
        status_reason: "חריגה מתמשכת מהיעד המאושר",
        alert_eligible: true,
        target_kind: "cpl",
        target_value: 30,
        efficiency_3d: 52,
        efficiency_7d: 48,
        trend_3d_pct: 40,
        trend_7d_pct: 31,
        data_fresh_through: "2026-09-17",
        last_change_at: "2026-09-10T08:00:00Z",
      }],
    }],
    [],
    DEFAULT_PULSE_ALERT_RULES,
  );
  const exception = rows.find((row) => row.rule_type === "campaign_exception");
  assert.ok(exception);
  assert.equal(exception.campaign_key, "meta:id:123");
  assert.equal(exception.evidence.target_value, 30);
  assert.match(exception.message, /קמפיין: Leads/);
  assert.match(exception.message, /שינוי אחרון: 2026-09-10/);
});

test("target-aware campaign rows suppress the legacy raw CPL-spike alert", () => {
  const rows = evaluatePulseInstantAlerts(
    [{
      client_id: "c1",
      client_name: "Acme",
      cpl_change_pct: 80,
      flags: [],
      campaign_breakdown: [{
        campaign_key: "meta:id:123",
        campaign_name: "Leads",
        goal: "leads",
        status_reason: "התוצאה בתוך היעד המאושר",
        alert_eligible: false,
      }],
    }],
    [],
    DEFAULT_PULSE_ALERT_RULES,
  );
  assert.equal(rows.some((row) => row.rule_type === "cpl_spike"), false);
  assert.equal(rows.some((row) => row.rule_type === "campaign_exception"), false);
});
