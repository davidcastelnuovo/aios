// JavaScript \b does not recognize Hebrew word boundaries.
export function hasPulseIntent(text) {
  return /(?:^|[^\p{L}\p{N}_])ה?דופק(?=$|[^\p{L}\p{N}_])|\bpulse\s*check\b|בדיקת\s*דוח|מצב\s*קמפיינים|סיכום\s*קמפיינים/iu.test(String(text || ''))
}

export function isCachedPulseRequest(text) {
  // Only unqualified summary requests may bypass the model with empty tool args.
  // Client filters, analysis, refresh and send instructions need normal routing.
  const normalized = String(text || '').trim().replace(/[.!?؟]+$/u, '').trim()
  return /^(?:(?:כרמן|קרמן|carmen)[,\s]+)?(?:(?:תני לי|תן לי|הציגי|הצג|אפשר|מה|תראי לי|תראה לי)\s+)?(?:(?:בדיקת\s+)?דופק(?:\s+קמפיינים)?|(?:מצב|סיכום)\s*(?:הקמפיינים|קמפיינים)|pulse\s*check)(?:\s+בבקשה)?$/iu.test(normalized)
}
