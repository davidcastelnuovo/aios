import assert from "node:assert/strict";
import test from "node:test";
import {
  chooseCalendarRecordingMatch,
  isZoomCalendarEvent,
  matchClientFromCalendarTitle,
  normalizeCalendarMatchText,
} from "./calendar-recording-match.ts";

const clients = [
  { id: "client-acme", name: "Acme Ltd" },
  { id: "client-exito", name: "אקסיטו" },
  { id: "client-other", name: "לקוח אחר" },
];

const zoomEvent = (overrides: Record<string, unknown> = {}) => ({
  id: "event-1",
  summary: "פגישת סטטוס אקסיטו",
  description: "Join Zoom Meeting https://zoom.us/j/123456",
  start: { dateTime: "2026-08-24T07:00:00.000Z" },
  end: { dateTime: "2026-08-24T08:00:00.000Z" },
  ...overrides,
});

test("normalizes Hebrew punctuation and casing", () => {
  assert.equal(normalizeCalendarMatchText("  פגישת–אקסיטו!!! "), "פגישת אקסיטו");
  assert.equal(normalizeCalendarMatchText("ACME, Ltd."), "acme ltd");
});

test("detects Zoom links in description, location, or conference data", () => {
  assert.equal(isZoomCalendarEvent(zoomEvent()), true);
  assert.equal(isZoomCalendarEvent({
    summary: "Client call",
    conferenceData: { entryPoints: [{ uri: "https://us02web.zoom.us/j/42" }] },
  }), true);
  assert.equal(isZoomCalendarEvent({ summary: "פגישה רגילה" }), false);
});

test("matches an explicit client name in the calendar title", () => {
  assert.deepEqual(
    matchClientFromCalendarTitle("Zoom | פגישת סטטוס אקסיטו", clients),
    clients[1],
  );
  assert.deepEqual(
    matchClientFromCalendarTitle("Weekly call - Acme", clients),
    clients[0],
  );
});

test("does not match partial words or ambiguous equal-length names", () => {
  assert.equal(matchClientFromCalendarTitle("Acmeology kickoff", clients), null);
  assert.equal(matchClientFromCalendarTitle("פגישה כללית", clients), null);
  assert.equal(matchClientFromCalendarTitle("Alpha + Bravo", [
    { id: "alpha", name: "Alpha" },
    { id: "bravo", name: "Bravo" },
  ]), null);
});

test("chooses the closest timed Zoom event and assigns its client", () => {
  const match = chooseCalendarRecordingMatch({
    start_time: "2026-08-24T07:04:00.000Z",
    duration: 50,
  }, [
    zoomEvent({
      id: "far",
      summary: "פגישה לקוח אחר",
      start: { dateTime: "2026-08-24T06:40:00.000Z" },
      end: { dateTime: "2026-08-24T07:30:00.000Z" },
    }),
    zoomEvent(),
  ], clients);

  assert.equal(match?.eventId, "event-1");
  assert.equal(match?.eventTitle, "פגישת סטטוס אקסיטו");
  assert.equal(match?.clientId, "client-exito");
  assert.equal(match?.startDeltaMinutes, 4);
});

test("ignores non-Zoom, cancelled, all-day, distant, and generic events", () => {
  const recording = { start_time: "2026-08-24T07:00:00.000Z", duration: 60 };
  assert.equal(chooseCalendarRecordingMatch(recording, [
    { ...zoomEvent(), description: "", summary: "פגישה רגילה" },
    { ...zoomEvent(), status: "cancelled" },
    { ...zoomEvent(), start: { date: "2026-08-24" } },
    {
      ...zoomEvent(),
      start: { dateTime: "2026-08-24T10:00:00.000Z" },
      end: { dateTime: "2026-08-24T11:00:00.000Z" },
    },
    { ...zoomEvent(), summary: "Zoom Meeting" },
  ], clients), null);
});

test("never matches a known Google Meet or Teams recording to a Zoom event", () => {
  assert.equal(chooseCalendarRecordingMatch({
    start_time: "2026-08-24T07:00:00.000Z",
    duration: 60,
    meeting_topic: "Google Meet — כרמן",
    source: "meeting_bot",
  }, [zoomEvent()], clients), null);

  assert.equal(chooseCalendarRecordingMatch({
    start_time: "2026-08-24T07:00:00.000Z",
    duration: 60,
    meeting_topic: "פגישת צוות",
    source: "teams",
  }, [zoomEvent()], clients), null);
});
