import assert from 'node:assert/strict';
import test from 'node:test';
import {
  describeGoogleAdsError,
  detectGoogleAdsError,
  googleAdsErrorText,
  isManagerAccountError,
  managerAccountMessage,
} from './googleAdsErrors.ts';

// Verbatim searchStream response recorded by the sync for a report that was
// pointed at a manager account (crm_tables.integration_settings.last_sync_diag).
const MANAGER_ACCOUNT_RESPONSE = [
  {
    error: {
      code: 400,
      message: 'Request contains an invalid argument.',
      status: 'INVALID_ARGUMENT',
      details: [
        {
          '@type': 'type.googleapis.com/google.ads.googleads.v23.errors.GoogleAdsFailure',
          errors: [
            {
              errorCode: { queryError: 'REQUESTED_METRICS_FOR_MANAGER' },
              message:
                'Metrics cannot be requested for a manager account. To retrieve metrics, issue separate requests against each client account under the manager account.',
            },
          ],
          requestId: '2Mgy9lv0HMW_sTqiysFrXQ',
        },
      ],
    },
  },
];

test('an error is found inside the array wrapper searchStream returns', () => {
  const error = detectGoogleAdsError(MANAGER_ACCOUNT_RESPONSE);
  assert.ok(error);
  assert.equal((error as { status?: string }).status, 'INVALID_ARGUMENT');
});

test('a successful response reports no error', () => {
  assert.equal(detectGoogleAdsError([{ results: [{ campaign: { id: '1' } }] }]), null);
  assert.equal(detectGoogleAdsError({ results: [] }), null);
  assert.equal(detectGoogleAdsError(null), null);
});

test('the specific failure is read out of details instead of the outer placeholder', () => {
  const info = describeGoogleAdsError(detectGoogleAdsError(MANAGER_ACCOUNT_RESPONSE));
  assert.equal(info.outerMessage, 'Request contains an invalid argument.');
  assert.equal(info.code, 'REQUESTED_METRICS_FOR_MANAGER');
  assert.match(info.detailMessage ?? '', /^Metrics cannot be requested for a manager account\./);
  assert.match(googleAdsErrorText(detectGoogleAdsError(MANAGER_ACCOUNT_RESPONSE)), /REQUESTED_METRICS_FOR_MANAGER/);
});

test('a manager account report is recognised', () => {
  assert.equal(isManagerAccountError(detectGoogleAdsError(MANAGER_ACCOUNT_RESPONSE)), true);
});

test('other Google Ads failures are not mistaken for a manager account', () => {
  const authError = detectGoogleAdsError([
    {
      error: {
        code: 400,
        message: 'Request contains an invalid argument.',
        details: [
          {
            errors: [
              {
                errorCode: { authorizationError: 'CUSTOMER_NOT_ENABLED' },
                message: 'The customer account cannot be accessed because it is not yet enabled.',
              },
            ],
          },
        ],
      },
    },
  ]);
  assert.equal(isManagerAccountError(authError), false);
  assert.equal(
    googleAdsErrorText(authError),
    'The customer account cannot be accessed because it is not yet enabled. (CUSTOMER_NOT_ENABLED)',
  );
});

test('an error with no details still yields the outer message', () => {
  const bare = detectGoogleAdsError({ error: { message: 'Permission denied.' } });
  assert.equal(isManagerAccountError(bare), false);
  assert.equal(googleAdsErrorText(bare), 'Permission denied.');
});

test('the manager account message names the account in Google Ads format', () => {
  const message = managerAccountMessage('4568787244');
  assert.match(message, /456-878-7244/);
  assert.match(message, /חשבון ניהול \(MCC\)/);
});
