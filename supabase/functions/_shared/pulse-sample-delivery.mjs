/** Manual sample pulse delivery — one digest, one recipient, MarketingCaptain only. */

export function parsePulseSampleToPhone(body, manualDeliveryBypass) {
  if (!manualDeliveryBypass || typeof body?.sample_to_phone !== 'string') return null
  const trimmed = body.sample_to_phone.trim()
  return trimmed || null
}

export function isPulseSampleDeliveryTenant(tenantSlug) {
  return tenantSlug === 'marketingcaptain'
}

/** Instant alerts are separate from the scheduled digest and must never fire on refresh-only runs. */
export function shouldDeliverInstantPulseAlerts(deliveryRequested, sampleToPhone) {
  return deliveryRequested === true && !sampleToPhone
}

export function buildPulseSampleMessage(digest) {
  return ['*דוגמה — בדיקת דופק*', '', digest].join('\n')
}
