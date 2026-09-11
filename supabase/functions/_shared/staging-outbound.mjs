/** Installed before an Edge entrypoint loads, only by the Staging deployer.
 * Independent of APP_ENV and copied database data. No production opt-out flag.
 */
export function outboundAllowed(url, method, ownOrigin) {
  const target = new URL(url);
  if (target.protocol !== 'https:') return false;
  if (target.origin === ownOrigin) {
    // Automated Supabase Auth invitations also send real email.
    return !/^\/auth\/v1\/(invite|recover|signup|resend|otp)(\/|$)/.test(target.pathname);
  }
  // Copied integration URLs must never invoke Production services, even with GET.
  if (target.hostname.endsWith('.supabase.co')) return false;
  const verb = method.toUpperCase();
  // Google report connections must be able to refresh their existing tokens.
  // The subsequent API call is still checked separately by this guard.
  if (verb === 'POST' && target.hostname === 'oauth2.googleapis.com' && target.pathname === '/token') return true;
  if (verb === 'POST' && ['www.googleapis.com', 'searchconsole.googleapis.com'].includes(target.hostname) &&
    /^\/webmasters\/v3\/sites\/[^/]+\/searchAnalytics\/query$/.test(target.pathname)) return true;
  // Carmen can think and read reports; messaging, publishing and management stay blocked.
  const inference = {
    'api.openai.com': /^\/v1\/(responses|chat\/completions|embeddings|audio\/transcriptions|audio\/speech|images\/generations|images\/edits)\/?$/,
    'api.anthropic.com': /^\/v1\/messages\/?$/,
    'api.x.ai': /^\/v1\/(chat\/completions|responses|embeddings)\/?$/,
  };
  if (verb === 'POST' && inference[target.hostname]?.test(target.pathname)) return true;
  if (verb === 'POST' && target.hostname === 'api.chatgpt.com' && /^\/v1\/workspace_agents\/agtch_[a-z0-9]+\/trigger$/.test(target.pathname)) return true;
  if (verb === 'POST' && target.hostname === 'api.cursor.com' && /^\/v0\/agents(?:\/[^/]+\/followup)?$/.test(target.pathname)) return true;
  if (verb === 'POST' && target.hostname === 'googleads.googleapis.com' && /\/googleAds:search(Stream)?$/.test(target.pathname)) return true;
  if (verb === 'POST' && target.hostname === 'analyticsdata.googleapis.com' && /:(runReport|batchRunReports|runRealtimeReport)$/.test(target.pathname)) return true;
  if (!['GET', 'HEAD'].includes(verb)) return false;
  if (['api.openai.com', 'api.anthropic.com', 'api.x.ai'].includes(target.hostname) &&
    /^\/v1\/(models(?:\/[^/]+)?|responses\/[^/]+)\/?$/.test(target.pathname)) return true;
  if (target.hostname === 'api.cursor.com' && /^\/v0\/agents(?:\/[^/]+(?:\/conversation)?)?\/?$/.test(target.pathname)) return true;
  // Some providers expose sends as GET. Only explicitly read-only analytics APIs
  // and static assets are allowed; unknown destinations fail closed.
  const readHosts = ['graph.facebook.com', 'googleads.googleapis.com', 'analyticsdata.googleapis.com',
    'searchconsole.googleapis.com', 'www.googleapis.com', 'api.ahrefs.com'];
  if (readHosts.includes(target.hostname)) {
    // Graph API supports method overrides in the query string.
    if (['method', '_method'].some(key => target.searchParams.has(key) &&
      !['GET', 'HEAD'].includes(target.searchParams.get(key).toUpperCase()))) return false;
    return !/\/(messages|feed|photos|videos)(\/|$)/i.test(target.pathname);
  }
  return ['fonts.googleapis.com', 'fonts.gstatic.com', 'oaidalleapiprodscus.blob.core.windows.net'].includes(target.hostname);
}

export function installStagingOutboundGuard(ownUrl, runtime = globalThis) {
  const origin = new URL(ownUrl).origin;
  const originalFetch = runtime.fetch.bind(runtime);
  runtime.fetch = async (input, init) => {
    const url = typeof input === 'string' || input instanceof URL ? String(input) : input.url;
    const method = init?.method || (input instanceof Request ? input.method : 'GET');
    if (!outboundAllowed(url, method, origin)) {
      // No recipient, token, body, URL query or client data enters the log.
      console.info('[staging-outbound] blocked', method, new URL(url).hostname);
      return new Response(JSON.stringify({ success: false, dry_run: true, blocked: true,
        error: 'staging_outbound_blocked' }), { status: 409, headers: { 'Content-Type': 'application/json' } });
    }
    // Do not let an allowed host redirect a request to an unreviewed destination.
    return originalFetch(input, { ...init, redirect: 'error' });
  };
}
