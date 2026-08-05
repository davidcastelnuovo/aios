import assert from 'node:assert/strict';
import test from 'node:test';
import {
  googleAdsErrorBody,
  managerAccountErrorBody,
} from '../../supabase/functions/_shared/googleAdsErrors.ts';
import { edgeFunctionErrorMessage } from './edgeFunctionError.ts';

/** A rejection from `supabase.functions.invoke`: generic message, real body on `context`. */
const functionsHttpError = (status: number, body: unknown) =>
  Object.assign(new Error('Edge Function returned a non-2xx status code'), {
    context: new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  });

test('the function\'s own message wins over the generic transport error', async () => {
  const error = functionsHttpError(400, { error: 'needs_reauth', message: 'יש לחבר מחדש.' });
  const message = await edgeFunctionErrorMessage(error, 'הסנכרון נכשל');
  assert.equal(message, 'יש לחבר מחדש.');
  assert.doesNotMatch(message, /non-2xx/);
});

test('an error body without a message falls back to its error and details fields', async () => {
  assert.equal(
    await edgeFunctionErrorMessage(functionsHttpError(400, { error: 'needs_reauth' }), 'fallback'),
    'needs_reauth',
  );
  assert.equal(
    await edgeFunctionErrorMessage(functionsHttpError(400, { details: 'CUSTOMER_NOT_ENABLED' }), 'fallback'),
    'CUSTOMER_NOT_ENABLED',
  );
});

test('the body is read non-destructively so callers can still inspect it', async () => {
  const error = functionsHttpError(400, { message: 'first read' });
  assert.equal(await edgeFunctionErrorMessage(error, 'fallback'), 'first read');
  assert.equal(await edgeFunctionErrorMessage(error, 'fallback'), 'first read');
});

test('a non-JSON body leaves the thrown error message in place', async () => {
  const error = Object.assign(new Error('Edge Function returned a non-2xx status code'), {
    context: new Response('<html>gateway timeout</html>', { status: 504 }),
  });
  assert.equal(
    await edgeFunctionErrorMessage(error, 'fallback'),
    'Edge Function returned a non-2xx status code',
  );
});

test('an error with no context at all uses the fallback', async () => {
  assert.equal(await edgeFunctionErrorMessage({}, 'הסנכרון נכשל'), 'הסנכרון נכשל');
  assert.equal(await edgeFunctionErrorMessage(null, 'הסנכרון נכשל'), 'הסנכרון נכשל');
});

// What the Google Ads sync toast ends up saying, using the bodies the function
// actually returns.
test('a manager account report reaches the user as instructions', async () => {
  const shown = await edgeFunctionErrorMessage(
    functionsHttpError(400, managerAccountErrorBody('4568787244')),
    'הסנכרון נכשל',
  );
  assert.match(shown, /456-878-7244/);
  assert.match(shown, /יש לפתוח את הגדרות הטבלה ולבחור את חשבון הפרסום עצמו/);
  assert.doesNotMatch(shown, /non-2xx/);
});

test('any other Google Ads failure reaches the user in Google\'s own wording', async () => {
  const googleFailure = {
    message: 'Request contains an invalid argument.',
    details: [
      {
        errors: [
          {
            errorCode: { queryError: 'UNRECOGNIZED_FIELD' },
            message: "Field 'metrics.nope' is not recognized.",
          },
        ],
      },
    ],
  };

  const shown = await edgeFunctionErrorMessage(
    functionsHttpError(400, googleAdsErrorBody(googleFailure)),
    'הסנכרון נכשל',
  );
  assert.equal(shown, "Field 'metrics.nope' is not recognized. (UNRECOGNIZED_FIELD)");
  assert.doesNotMatch(shown, /invalid argument/);
});
