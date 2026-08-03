import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CLIENT_UNREADABLE_ERROR,
  CLIENT_WITHOUT_AGENCY_ERROR,
  MISSING_CLIENT_ERROR,
  resolveClientTaskAgency,
  type TaskClientRow,
} from './taskClientAgency.ts';

const AGENCY_ID = 'ab6ed4f1-0d4b-4f9e-9f4d-4bbd7b2f2f01';

// The picker list only ever holds a filtered slice of the tenant's clients.
const activeClientInPicker: TaskClientRow = {
  id: 'client-active',
  name: 'לקוח פעיל',
  agency_id: AGENCY_ID,
};

// Opened straight from the card of a client the picker list never loaded
// (paused/onboarding/ended, or not assigned to the selected campaigner).
const clientOutsidePicker: TaskClientRow = {
  id: 'client-paused',
  name: 'לקוח מושהה',
  agency_id: AGENCY_ID,
};

const fetchFrom = (rows: TaskClientRow[]) => async (clientId: string) =>
  rows.find((row) => row.id === clientId) ?? null;

test('a client missing from the cached picker list still resolves its agency', async () => {
  const resolved = await resolveClientTaskAgency({
    clientId: clientOutsidePicker.id,
    fetchClient: fetchFrom([activeClientInPicker, clientOutsidePicker]),
    cachedClients: [activeClientInPicker],
  });

  assert.equal(resolved.agencyId, AGENCY_ID);
  assert.equal(resolved.clientName, 'לקוח מושהה');
});

test('the fresh read wins over a stale cached row', async () => {
  const movedAgencyId = 'c0f1b8de-9a2c-4f0e-8f2a-1d3c5b7a9e11';
  const resolved = await resolveClientTaskAgency({
    clientId: activeClientInPicker.id,
    fetchClient: fetchFrom([{ ...activeClientInPicker, agency_id: movedAgencyId }]),
    cachedClients: [activeClientInPicker],
  });

  assert.equal(resolved.agencyId, movedAgencyId);
});

test('the cached row covers a client that cannot be read back', async () => {
  const resolved = await resolveClientTaskAgency({
    clientId: activeClientInPicker.id,
    fetchClient: async () => null,
    cachedClients: [activeClientInPicker],
  });

  assert.equal(resolved.agencyId, AGENCY_ID);
});

test('the agency of the originating card is the last resort', async () => {
  const resolved = await resolveClientTaskAgency({
    clientId: clientOutsidePicker.id,
    fetchClient: async () => {
      throw new Error('permission denied for table clients');
    },
    cachedClients: [],
    fallbackAgencyId: AGENCY_ID,
  });

  assert.equal(resolved.agencyId, AGENCY_ID);
});

test('a client genuinely without an agency is reported as such', async () => {
  await assert.rejects(
    resolveClientTaskAgency({
      clientId: 'client-no-agency',
      fetchClient: fetchFrom([{ id: 'client-no-agency', name: 'לקוח ללא סוכנות', agency_id: null }]),
      cachedClients: [],
    }),
    new Error(CLIENT_WITHOUT_AGENCY_ERROR),
  );
});

test('an unreadable client is not blamed on a missing agency', async () => {
  await assert.rejects(
    resolveClientTaskAgency({
      clientId: 'client-deleted',
      fetchClient: async () => null,
      cachedClients: [],
    }),
    new Error(CLIENT_UNREADABLE_ERROR),
  );
});

test('no client at all is rejected before any lookup', async () => {
  await assert.rejects(
    resolveClientTaskAgency({
      clientId: '',
      fetchClient: async () => {
        throw new Error('should not be called');
      },
    }),
    new Error(MISSING_CLIENT_ERROR),
  );
});
