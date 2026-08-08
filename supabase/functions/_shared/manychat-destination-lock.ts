import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'

const DEFAULT_LOCK_TTL_SECONDS = 120
const DEFAULT_ACQUIRE_ATTEMPTS = 40
const DEFAULT_ACQUIRE_INTERVAL_MS = 1500
/** ManyChat Flow Smart Delay (10s min) + template send — hold lock so the next lead cannot overwrite fields mid-flight. */
export const POST_SEND_FLOW_SETTLE_MS = 22_000

export function manyChatDestinationLockKey(phone: string | null | undefined): string | null {
  const last9 = String(phone ?? '').replace(/\D/g, '').slice(-9)
  return last9.length === 9 ? `wa:${last9}` : null
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export async function withManyChatDestinationLock<T>(
  supabase: SupabaseClient,
  destinationPhone: string | null | undefined,
  fn: () => Promise<T>,
  opts?: {
    ttlSeconds?: number
    maxAttempts?: number
    intervalMs?: number
    postSendSettleMs?: number
  },
): Promise<T> {
  const key = manyChatDestinationLockKey(destinationPhone)
  if (!key) return fn()

  const ttlSeconds = opts?.ttlSeconds ?? DEFAULT_LOCK_TTL_SECONDS
  const maxAttempts = opts?.maxAttempts ?? DEFAULT_ACQUIRE_ATTEMPTS
  const intervalMs = opts?.intervalMs ?? DEFAULT_ACQUIRE_INTERVAL_MS
  const postSendSettleMs = opts?.postSendSettleMs ?? POST_SEND_FLOW_SETTLE_MS

  let acquired = false
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const { data, error } = await supabase.rpc('try_acquire_manychat_destination_lock', {
      p_destination_key: key,
      p_ttl_seconds: ttlSeconds,
    })
    if (error) {
      console.warn('[send_whatsapp] destination lock rpc failed (continuing without lock):', error.message)
      return fn()
    }
    if (data === true) {
      acquired = true
      break
    }
    await sleep(intervalMs)
  }

  if (!acquired) {
    throw new Error(
      `ManyChat עמוס על מספר ${destinationPhone} — ליד קודם עדיין נשלח. נסו שוב בעוד דקה.`,
    )
  }

  try {
    const result = await fn()
    if (postSendSettleMs > 0) {
      await sleep(postSendSettleMs)
    }
    return result
  } finally {
    try {
      await supabase.rpc('release_manychat_destination_lock', { p_destination_key: key })
    } catch (releaseErr) {
      console.warn('[send_whatsapp] destination lock release failed:', releaseErr)
    }
  }
}
