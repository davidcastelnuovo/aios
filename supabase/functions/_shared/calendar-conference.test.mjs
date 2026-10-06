import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyZoomLinkToEvent,
  buildMeetConferenceData,
  collectExtraAttendeeEmails,
  conferenceKindFromUrl,
  eventDurationMinutes,
  extractConferenceUrl,
  googleEventPatchUrl,
  mergeAttendees,
  normalizeEmail,
  resolveRequestedConference,
  summarizeEventResult,
} from './calendar-conference.mjs';

test('normalizeEmail rejects junk', () => {
  assert.equal(normalizeEmail(' David@AIOS.co.il '), 'david@aios.co.il');
  assert.equal(normalizeEmail('not-an-email'), '');
});

test('collectExtraAttendeeEmails accepts array, csv, and carmen_email', () => {
  const emails = collectExtraAttendeeEmails({
    add_attendee_emails: ['ana@example.com', 'Ana@example.com'],
    attendee_emails: 'felix@dmm.com, extra@aios.co.il',
    carmen_email: 'carmen@aios.co.il',
  });
  assert.deepEqual(emails, [
    'ana@example.com',
    'felix@dmm.com',
    'extra@aios.co.il',
    'carmen@aios.co.il',
  ]);
});

test('mergeAttendees keeps existing attendees and adds new ones', () => {
  const merged = mergeAttendees(
    [{ email: 'david@aios.co.il', responseStatus: 'accepted' }, { email: 'OLD@client.com' }],
    ['felix@dmm.com', 'david@aios.co.il'],
    [{ email: 'carmen@aios.co.il', displayName: 'כרמן' }],
  );
  assert.equal(merged.length, 4);
  assert.equal(merged.find((a) => a.email === 'david@aios.co.il').responseStatus, 'accepted');
  assert.equal(merged.find((a) => a.email === 'old@client.com').email, 'old@client.com');
  assert.equal(merged.find((a) => a.email === 'carmen@aios.co.il').displayName, 'כרמן');
});

test('extractConferenceUrl prefers hangoutLink then Zoom in description', () => {
  assert.equal(
    extractConferenceUrl({ hangoutLink: 'https://meet.google.com/abc-defg-hij' }),
    'https://meet.google.com/abc-defg-hij',
  );
  assert.equal(
    extractConferenceUrl({
      conferenceData: { entryPoints: [{ entryPointType: 'video', uri: 'https://us02web.zoom.us/j/123' }] },
    }),
    'https://us02web.zoom.us/j/123',
  );
  assert.equal(
    extractConferenceUrl({ description: 'Join: https://zoom.us/j/999?pwd=abc.' }),
    'https://zoom.us/j/999?pwd=abc',
  );
});

test('resolveRequestedConference maps Zoom/Meet Hebrew and flags', () => {
  assert.equal(resolveRequestedConference({ conference_type: 'zoom' }), 'zoom');
  assert.equal(resolveRequestedConference({ conference_type: 'זום' }), 'zoom');
  assert.equal(resolveRequestedConference({ add_conference: true }), 'meet');
  assert.equal(resolveRequestedConference({}), 'none');
});

test('buildMeetConferenceData uses hangoutsMeet', () => {
  const data = buildMeetConferenceData('req-1');
  assert.equal(data.createRequest.conferenceSolutionKey.type, 'hangoutsMeet');
  assert.equal(data.createRequest.requestId, 'req-1');
});

test('applyZoomLinkToEvent does not drop existing description', () => {
  const next = applyZoomLinkToEvent(
    { description: 'Agenda: Q3', location: 'Office' },
    'https://zoom.us/j/42',
  );
  assert.match(next.description, /Agenda: Q3/);
  assert.match(next.description, /https:\/\/zoom.us\/j\/42/);
  assert.equal(next.location, 'https://zoom.us/j/42');
});

test('googleEventPatchUrl sets conferenceDataVersion when adding Meet', () => {
  const url = googleEventPatchUrl('abc 123', { conference: true });
  assert.match(url, /conferenceDataVersion=1/);
  assert.match(url, /sendUpdates=all/);
  assert.match(url, /abc%20123/);
});

test('summarizeEventResult returns conference_url and attendees', () => {
  const summary = summarizeEventResult({
    id: 'evt-1',
    htmlLink: 'https://calendar.google.com/event?eid=1',
    hangoutLink: 'https://meet.google.com/aaa-bbbb-ccc',
    attendees: [{ email: 'a@x.com' }, { email: 'b@y.com' }],
    start: { dateTime: '2026-10-06T09:00:00+03:00' },
    summary: 'Sync',
  }, { zoom_available: false });
  assert.equal(summary.conference_url, 'https://meet.google.com/aaa-bbbb-ccc');
  assert.equal(summary.conference_type, 'meet');
  assert.deepEqual(summary.attendees, ['a@x.com', 'b@y.com']);
  assert.equal(summary.zoom_available, false);
});

test('eventDurationMinutes reads start/end', () => {
  assert.equal(eventDurationMinutes({
    start: { dateTime: '2026-10-06T09:00:00+03:00' },
    end: { dateTime: '2026-10-06T10:30:00+03:00' },
  }), 90);
});

test('conferenceKindFromUrl', () => {
  assert.equal(conferenceKindFromUrl('https://meet.google.com/x'), 'meet');
  assert.equal(conferenceKindFromUrl('https://us06web.zoom.us/j/1'), 'zoom');
});

test('updateExistingCalendarEvent merges attendees and adds Meet', async () => {
  const { updateExistingCalendarEvent } = await import('./calendar-conference.mjs');
  const calls = [];
  const fetchImpl = async (url, opts = {}) => {
    calls.push({ url, method: opts.method || 'GET', body: opts.body });
    if (!opts.method || opts.method === 'GET') {
      return {
        ok: true,
        json: async () => ({
          id: 'evt-1',
          htmlLink: 'https://calendar.google.com/event?eid=1',
          summary: 'Weekly',
          attendees: [{ email: 'david@aios.co.il' }],
          start: { dateTime: '2026-10-07T10:00:00+03:00' },
          end: { dateTime: '2026-10-07T11:00:00+03:00' },
        }),
      };
    }
    const patch = JSON.parse(opts.body);
    return {
      ok: true,
      json: async () => ({
        id: 'evt-1',
        htmlLink: 'https://calendar.google.com/event?eid=1',
        summary: patch.summary || 'Weekly',
        hangoutLink: 'https://meet.google.com/new-link',
        attendees: patch.attendees,
        start: { dateTime: '2026-10-07T10:00:00+03:00' },
      }),
    };
  };

  const result = await updateExistingCalendarEvent({
    accessToken: 'tok',
    eventId: 'evt-1',
    conferenceType: 'meet',
    extraEmails: ['carmen@aios.co.il'],
    fetchImpl,
  });

  assert.equal(result.success, true);
  assert.equal(result.conference_url, 'https://meet.google.com/new-link');
  assert.deepEqual(result.attendees, ['david@aios.co.il', 'carmen@aios.co.il']);
  const patchCall = calls.find((c) => c.method === 'PATCH');
  assert.match(patchCall.url, /conferenceDataVersion=1/);
  const body = JSON.parse(patchCall.body);
  assert.equal(body.attendees.length, 2);
  assert.equal(body.conferenceData.createRequest.conferenceSolutionKey.type, 'hangoutsMeet');
});

test('updateExistingCalendarEvent Zoom missing falls back to Meet and keeps guests', async () => {
  const { updateExistingCalendarEvent } = await import('./calendar-conference.mjs');
  const fetchImpl = async (_url, opts = {}) => {
    if (!opts.method || opts.method === 'GET') {
      return {
        ok: true,
        json: async () => ({
          id: 'evt-2',
          attendees: [{ email: 'a@x.com' }, { email: 'b@y.com' }],
        }),
      };
    }
    const patch = JSON.parse(opts.body);
    return {
      ok: true,
      json: async () => ({
        id: 'evt-2',
        hangoutLink: 'https://meet.google.com/fallback',
        attendees: patch.attendees,
      }),
    };
  };
  const result = await updateExistingCalendarEvent({
    accessToken: 'tok',
    eventId: 'evt-2',
    conferenceType: 'zoom',
    extraEmails: ['c@z.com'],
    fetchImpl,
  });
  assert.equal(result.conference_applied, 'meet');
  assert.equal(result.zoom_available, false);
  assert.equal(result.attendees.length, 3);
  assert.match(result.zoom_status, /Zoom לא מוגדר/);
});
