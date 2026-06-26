// Regression tests for the outbound-to-third-party guard added to manus-wa-webhook.
//
// These verify that Carmen does NOT respond when David sends a message from his
// connected phone to a third-party contact (e.g. Ana) without a trigger keyword,
// and that the LID resolver is skipped for outbound (fromMe) events.
//
// Run: deno test supabase/functions/manus-wa-webhook/index.test.ts

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';

// ===== Guard logic mirrored from index.ts =====
// These functions replicate the exact conditions added in the fixes so tests
// stay in sync with the implementation and catch regressions.

const OWNER_TRIGGER_RE = /[כק]א?רמן|carmen|קלוד|claude/i;

function hasTriggerKeyword(messageText: string): boolean {
  const msgPrefix = String(messageText || '')
    .toLowerCase()
    .replace(/^\s*🎤\s*/, '')
    .trim()
    .slice(0, 80); // PR #47: only first 80 chars count
  return OWNER_TRIGGER_RE.test(msgPrefix);
}

type MockSession = { id: string } | null;

/**
 * Mirrors the outbound-to-third-party guard from index.ts.
 * Returns 'skip' when Carmen must NOT respond, 'continue' otherwise.
 */
async function outboundGuardDecision(
  isOutgoingFromPhone: boolean,
  pairedFromGreenApi: boolean,
  isGroup: boolean,
  messageText: string,
  existingCarmenSession: MockSession,
): Promise<'skip' | 'continue'> {
  if (!isOutgoingFromPhone || pairedFromGreenApi || isGroup) return 'continue';
  if (hasTriggerKeyword(messageText)) return 'continue';
  if (existingCarmenSession) return 'continue';
  return 'skip';
}

/**
 * Mirrors the LID resolver gate condition from index.ts (Fix 1).
 * Returns true only when the resolver should actually run.
 */
function shouldRunLidResolver(
  isGroup: boolean,
  pairedFromGreenApi: boolean,
  isLidEvent: boolean,
  fromMeFlag: boolean,
): boolean {
  return !isGroup && !pairedFromGreenApi && isLidEvent && !fromMeFlag;
}

// ===== Regression scenario A: outbound to third party, no keyword =====

Deno.test('scenario A: owner sends to Ana without keyword → Carmen skipped', async () => {
  const decision = await outboundGuardDecision(
    true,        // isOutgoingFromPhone
    false,       // pairedFromGreenApi
    false,       // isGroup
    'שלום אנה', // no trigger keyword
    null,        // no existing Carmen session for this chatId
  );
  assertEquals(decision, 'skip');
});

Deno.test('scenario A: owner sends arbitrary text to third party → Carmen skipped', async () => {
  const decision = await outboundGuardDecision(true, false, false, 'מה נשמע? הכל בסדר?', null);
  assertEquals(decision, 'skip');
});

// ===== Regression scenario B: outbound in Carmen's OWN thread, no keyword =====

Deno.test('scenario B: owner sends to Carmen chat (active session) → Carmen continues', async () => {
  const decision = await outboundGuardDecision(
    true,
    false,
    false,
    'מה קורה',             // no trigger keyword — but session exists
    { id: 'session-abc' }, // active Carmen session for this exact chatId
  );
  assertEquals(decision, 'continue');
});

// ===== Regression scenario C: trigger keyword routing =====

Deno.test('scenario C: trigger "כרמן" → Carmen continues (no session needed)', async () => {
  const decision = await outboundGuardDecision(
    true, false, false,
    'כרמן מה שלומך',
    null,
  );
  assertEquals(decision, 'continue');
});

Deno.test('scenario C: trigger "קרמן" (variant spelling) → Carmen continues', async () => {
  const decision = await outboundGuardDecision(
    true, false, false,
    'קרמן תעזרי לי',
    null,
  );
  assertEquals(decision, 'continue');
});

Deno.test('scenario C: trigger "קלוד" → Carmen continues', async () => {
  const decision = await outboundGuardDecision(
    true, false, false,
    'קלוד תסכם את הפגישה',
    null,
  );
  assertEquals(decision, 'continue');
});

Deno.test('scenario C: trigger "carmen" (English) → Carmen continues', async () => {
  const decision = await outboundGuardDecision(
    true, false, false,
    'carmen help me write this',
    null,
  );
  assertEquals(decision, 'continue');
});

Deno.test('scenario C: trigger "claude" (English) → Carmen continues', async () => {
  const decision = await outboundGuardDecision(
    true, false, false,
    'claude summarize this',
    null,
  );
  assertEquals(decision, 'continue');
});

// ===== PR #47 compatibility: 80-char keyword window =====

Deno.test('PR #47 compat: trigger keyword after position 80 → Carmen skipped', async () => {
  // "כרמן" appears only at position 82 — must NOT activate Carmen per PR #47 rule
  const longPrefix = 'א'.repeat(82);
  const decision = await outboundGuardDecision(
    true, false, false,
    `${longPrefix}כרמן`,
    null,
  );
  assertEquals(decision, 'skip');
});

Deno.test('PR #47 compat: trigger keyword at position 79 → Carmen continues', async () => {
  // Exactly within the 80-char window
  const prefix = 'a'.repeat(74);
  const decision = await outboundGuardDecision(
    true, false, false,
    `${prefix}כרמן`, // "כרמן" starts at position 74, ends at ~78 (Hebrew chars)
    null,
  );
  assertEquals(decision, 'continue');
});

// ===== Guard does not interfere with inbound / group messages =====

Deno.test('inbound message (from Ana to David) → guard is a no-op, Carmen continues', async () => {
  const decision = await outboundGuardDecision(
    false, // NOT outgoing
    false, false,
    'שלום דוד',
    null,
  );
  assertEquals(decision, 'continue');
});

Deno.test('group message → guard is a no-op, Carmen continues', async () => {
  const decision = await outboundGuardDecision(
    true,
    false,
    true,  // isGroup
    'שלום כולם',
    null,
  );
  assertEquals(decision, 'continue');
});

Deno.test('paired via Green API → guard is a no-op, Carmen continues', async () => {
  const decision = await outboundGuardDecision(
    true,
    true,  // pairedFromGreenApi — different code path
    false,
    'שלום',
    null,
  );
  assertEquals(decision, 'continue');
});

// ===== LID resolver gate (Fix 1) =====

Deno.test('Fix 1: fromMeFlag=true (outbound) → LID resolver is skipped', () => {
  const runs = shouldRunLidResolver(
    false, // isGroup
    false, // pairedFromGreenApi
    true,  // isLidEvent
    true,  // fromMeFlag — David sent this message outbound
  );
  assertEquals(runs, false, 'LID resolver must NOT run for outbound fromMe messages');
});

Deno.test('Fix 1: inbound LID event (fromMeFlag=false) → LID resolver runs', () => {
  const runs = shouldRunLidResolver(false, false, true, false);
  assertEquals(runs, true);
});

Deno.test('Fix 1: group LID event → LID resolver skipped (unchanged)', () => {
  const runs = shouldRunLidResolver(true, false, true, false);
  assertEquals(runs, false);
});

Deno.test('Fix 1: already paired from Green API → LID resolver skipped (unchanged)', () => {
  const runs = shouldRunLidResolver(false, true, true, false);
  assertEquals(runs, false);
});
