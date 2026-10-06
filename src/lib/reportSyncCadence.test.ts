import assert from "node:assert/strict";
import test from "node:test";
import { PULSE_REFRESH_CRONS, REPORT_SYNC_SCHEDULES } from "./cronJobsCatalog.ts";

function minutesOfDay(cron: string): number[] {
  const [minute, hour] = cron.split(/\s+/);
  const minutes = minute.split(",").map(Number);
  const hours = hour.split(",").map(Number);
  return hours.flatMap((h) => minutes.map((m) => h * 60 + m));
}

test("report sync runs twice a day and finishes before each pulse refresh", () => {
  const pulseSlots = PULSE_REFRESH_CRONS.flatMap(minutesOfDay).sort((a, b) => a - b);
  assert.equal(pulseSlots.length, 2);

  for (const job of REPORT_SYNC_SCHEDULES) {
    const slots = minutesOfDay(job.cron).sort((a, b) => a - b);
    assert.equal(slots.length, 2, job.jobname);
    for (let i = 0; i < slots.length; i++) {
      const lead = pulseSlots[i] - slots[i];
      assert.ok(lead >= 30 && lead <= 120, `${job.jobname} slot ${i} leads pulse by ${lead}m`);
    }
  }
});
