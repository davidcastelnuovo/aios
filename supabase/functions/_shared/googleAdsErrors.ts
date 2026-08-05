// Turning Google Ads API failures into something a user can act on.
//
// A searchStream failure arrives as an array wrapper around an outer error whose
// `message` is always the useless "Request contains an invalid argument." The
// actionable text lives in `details[].errors[].message`, with a machine-readable
// code in `errorCode`. Reporting only the outer message is how a broken report
// ends up looking like a mystery: the sync said "invalid argument" while Google
// had already explained exactly what was wrong.

interface GoogleAdsFailureDetail {
  errors?: Array<{ message?: string; errorCode?: Record<string, string> }>;
}

interface GoogleAdsRpcError {
  message?: string;
  details?: GoogleAdsFailureDetail[];
}

export interface GoogleAdsErrorInfo {
  /** The outer google.rpc.Status message, e.g. "Request contains an invalid argument." */
  outerMessage: string;
  /** The first specific failure message Google returned, when there is one. */
  detailMessage: string | null;
  /** The first error code value, e.g. "REQUESTED_METRICS_FOR_MANAGER". */
  code: string | null;
}

/** Find a Google Ads error in any response shape (object, array, or wrapped). */
export function detectGoogleAdsError(data: unknown): Record<string, unknown> | null {
  if (!data) return null;
  if (Array.isArray(data)) {
    for (const entry of data) {
      const found = detectGoogleAdsError(entry);
      if (found) return found;
    }
    return null;
  }
  const error = (data as { error?: unknown }).error;
  if (error && typeof error === 'object') return error as Record<string, unknown>;
  return null;
}

export function describeGoogleAdsError(error: unknown): GoogleAdsErrorInfo {
  const err = (error || {}) as GoogleAdsRpcError;
  const outerMessage = typeof err.message === 'string' ? err.message : '';
  let detailMessage: string | null = null;
  let code: string | null = null;

  for (const detail of err.details ?? []) {
    for (const inner of detail?.errors ?? []) {
      if (!detailMessage && typeof inner?.message === 'string') detailMessage = inner.message;
      if (!code && inner?.errorCode) {
        const value = Object.values(inner.errorCode)[0];
        if (typeof value === 'string') code = value;
      }
      if (detailMessage && code) return { outerMessage, detailMessage, code };
    }
  }

  return { outerMessage, detailMessage, code };
}

/**
 * True when the report is pointed at a manager (MCC) account. Google never
 * returns metrics for one, so no amount of retrying or switching
 * `login-customer-id` can help — the account on the table has to change.
 */
export function isManagerAccountError(error: unknown): boolean {
  return describeGoogleAdsError(error).code === 'REQUESTED_METRICS_FOR_MANAGER';
}

/** Hebrew, actionable text for the manager-account case. */
export function managerAccountMessage(customerId: string): string {
  const formatted = String(customerId || '').replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
  return `החשבון שנבחר לדוח (${formatted}) הוא חשבון ניהול (MCC) ולא חשבון פרסום. ` +
    `Google לא מחזירה נתוני קמפיינים עבור חשבון ניהול. ` +
    `יש לפתוח את הגדרות הטבלה ולבחור את חשבון הפרסום עצמו מתוך חשבון הניהול.`;
}

/**
 * Body the sync returns for the manager-account case. `message` is the field the
 * client reads for its toast; `error` stays machine-readable.
 */
export function managerAccountErrorBody(customerId: string) {
  return {
    error: 'manager_account_selected',
    message: managerAccountMessage(customerId),
    customer_id: customerId,
  };
}

/** Body the sync returns for any other Google Ads failure. */
export function googleAdsErrorBody(error: unknown) {
  const text = googleAdsErrorText(error);
  return {
    error: 'Google Ads API error',
    // Google's own explanation, not the outer "invalid argument" placeholder.
    message: text,
    details: text,
  };
}

/** Best available single-line description of a Google Ads failure. */
export function googleAdsErrorText(error: unknown): string {
  const { outerMessage, detailMessage, code } = describeGoogleAdsError(error);
  const base = detailMessage || outerMessage || 'שגיאה לא מזוהה מ-Google Ads';
  return code ? `${base} (${code})` : base;
}
