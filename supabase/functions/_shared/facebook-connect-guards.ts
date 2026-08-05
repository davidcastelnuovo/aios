/**
 * Data-only guards for Carmen Facebook report table creation.
 * Never allow fuzzy/name-guess connects — require ppc_meta + matching meta_ads_account_id.
 */

export function normalizeMetaAdAccountId(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const digits = String(value).trim().replace(/^act_/i, '').replace(/\D/g, '')
  return digits.length > 0 ? digits : null
}

export function normalizeGoogleAdsCustomerId(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const digits = String(value).trim().replace(/-/g, '').replace(/\D/g, '')
  return digits.length > 0 ? digits : null
}

export function clientHasService(services: unknown, service: string): boolean {
  if (!Array.isArray(services)) return false
  return services.map((s) => String(s)).includes(service)
}

export type ConnectGuardResult =
  | { ok: true; normalized_ad_account_id: string }
  | { ok: false; code: string; error: string }

/**
 * Refuse inventing Facebook report tables for clients that are not Meta PPC
 * or that lack a stored ad-account id matching the requested account.
 */
export function evaluateFacebookReportConnect(
  client: { services?: unknown; meta_ads_account_id?: unknown; name?: string | null },
  adAccountId: unknown,
): ConnectGuardResult {
  if (!clientHasService(client.services, 'ppc_meta')) {
    return {
      ok: false,
      code: 'service_not_ppc_meta',
      error: 'הלקוח לא מוגדר עם שירות ניהול קמפיין פייסבוק (ppc_meta). אסור ליצור טבלת דוח פייסבוק.',
    }
  }
  const stored = normalizeMetaAdAccountId(client.meta_ads_account_id)
  if (!stored) {
    return {
      ok: false,
      code: 'missing_meta_ads_account_id',
      error: 'ללקוח אין meta_ads_account_id שמור. קודם יש לשמור מזהה חשבון מודעות על הלקוח — אסור לנחש לפי שם.',
    }
  }
  const requested = normalizeMetaAdAccountId(adAccountId)
  if (!requested) {
    return {
      ok: false,
      code: 'invalid_ad_account_id',
      error: 'ad_account_id לא תקין',
    }
  }
  if (requested !== stored) {
    return {
      ok: false,
      code: 'ad_account_mismatch',
      error: `ad_account_id (${requested}) לא תואם ל-meta_ads_account_id השמור על הלקוח (${stored}). אסור לחבר חשבון אחר בניחוש.`,
    }
  }
  return { ok: true, normalized_ad_account_id: stored }
}

export function evaluateGoogleAdsReportConnect(
  client: { services?: unknown; google_ads_account_id?: unknown },
  customerId: unknown,
): ConnectGuardResult {
  if (!clientHasService(client.services, 'ppc_google')) {
    return {
      ok: false,
      code: 'service_not_ppc_google',
      error: 'הלקוח לא מוגדר עם שירות ניהול קמפיין גוגל (ppc_google). אסור ליצור טבלת דוח Google Ads.',
    }
  }
  const stored = normalizeGoogleAdsCustomerId(client.google_ads_account_id)
  if (!stored) {
    return {
      ok: false,
      code: 'missing_google_ads_account_id',
      error: 'ללקוח אין google_ads_account_id שמור. קודם יש לשמור מזהה חשבון על הלקוח — אסור לנחש לפי שם.',
    }
  }
  const requested = normalizeGoogleAdsCustomerId(customerId)
  if (!requested) {
    return {
      ok: false,
      code: 'invalid_customer_id',
      error: 'customer_id לא תקין',
    }
  }
  if (requested !== stored) {
    return {
      ok: false,
      code: 'customer_id_mismatch',
      error: `customer_id (${requested}) לא תואם ל-google_ads_account_id השמור על הלקוח (${stored}). אסור לחבר חשבון אחר בניחוש.`,
    }
  }
  return { ok: true, normalized_ad_account_id: stored }
}
