/**
 * Picks which Google Search Console connection an SEO report should use.
 *
 * Kept pure (no React) so the priority order stays covered by tests. Two rules
 * matter most: a report that pins an account keeps it even when that account's
 * OAuth token is stale (the user must be able to reconnect it), and another
 * account may only take over when it verifiably has access to the requested
 * property — never as a silent guess.
 */

export type GscSelectableIntegration = {
  id: string;
  settings?: Record<string, unknown> | null;
};

export type GscSelectionSource =
  /** The account pinned on the report, with a working connection. */
  | "explicit"
  /** The pinned account, whose connection needs to be reconnected. */
  | "explicit-needs-reconnect"
  /** Another account that has access to the requested property. */
  | "substitute"
  /** A connection already mapped to this client's property. */
  | "mapped"
  /** The org-wide connection resolved server-side. */
  | "fallback"
  /** Any remaining connection, so a property can still be picked manually. */
  | "first"
  | "none";

export type GscSelection<T> = {
  integration: T | null;
  source: GscSelectionSource;
  /** The pinned account, whenever one is configured — used for reconnect prompts. */
  pinnedIntegration: T | null;
};

type GscSiteMeta = { siteUrl?: string; permissionLevel?: string };

type SiteMatcher = (a?: string | null, b?: string | null) => boolean;

const defaultSiteMatcher: SiteMatcher = (a, b) =>
  !!a && !!b && String(a).trim() === String(b).trim();

function availableSitesOf(integration: GscSelectableIntegration): GscSiteMeta[] {
  const settings = (integration.settings || {}) as Record<string, unknown>;
  return Array.isArray(settings.available_sites)
    ? (settings.available_sites as GscSiteMeta[])
    : [];
}

function hasUsableClientMapping(
  integration: GscSelectableIntegration,
  clientId: string,
): boolean {
  const settings = (integration.settings || {}) as Record<string, unknown>;
  const clientSites = (settings.client_sites || {}) as Record<string, string>;
  const mapped = clientSites[clientId];
  if (!mapped) return false;

  const meta = availableSitesOf(integration).find((site) => site?.siteUrl === mapped);
  return !meta || meta.permissionLevel !== "siteUnverifiedUser";
}

/** True when this connection lists the requested property with real access. */
export function hasAccessToSite(
  integration: GscSelectableIntegration,
  requestedSiteUrl: string | null | undefined,
  siteMatcher: SiteMatcher = defaultSiteMatcher,
): boolean {
  if (!requestedSiteUrl) return false;
  return availableSitesOf(integration).some(
    (site) =>
      site?.permissionLevel !== "siteUnverifiedUser" &&
      siteMatcher(site?.siteUrl, requestedSiteUrl),
  );
}

export function pickGscIntegration<T extends GscSelectableIntegration>(input: {
  integrations: T[];
  clientId: string;
  /** Account pinned on the report (`integration_settings.gsc_integration_id`). */
  selectedIntegrationId?: string | null;
  /** Connections whose OAuth token already failed in this session. */
  brokenIntegrationIds?: ReadonlySet<string>;
  /** Org-wide connection resolved server-side. */
  fallbackIntegrationId?: string | null;
  /** Property the org-wide connection resolved to. */
  fallbackSiteUrl?: string | null;
  /** Property this report needs, used to verify a stand-in connection. */
  requestedSiteUrl?: string | null;
  siteMatcher?: SiteMatcher;
}): GscSelection<T> {
  const {
    integrations,
    clientId,
    selectedIntegrationId,
    fallbackIntegrationId,
    fallbackSiteUrl,
    requestedSiteUrl,
  } = input;
  const broken = input.brokenIntegrationIds;
  const siteMatcher = input.siteMatcher || defaultSiteMatcher;
  const isBroken = (id: string) => !!broken?.has(id);

  const pinned = selectedIntegrationId
    ? integrations.find((integration) => integration.id === selectedIntegrationId) || null
    : null;

  if (pinned) {
    if (!isBroken(pinned.id)) {
      return { integration: pinned, source: "explicit", pinnedIntegration: pinned };
    }

    // The pinned connection is stale. Only hand over to an account that
    // verifiably has the requested property; otherwise keep the pinned account
    // selected so the user is prompted to reconnect it.
    const substitute = integrations.find(
      (integration) =>
        integration.id !== pinned.id &&
        !isBroken(integration.id) &&
        hasAccessToSite(integration, requestedSiteUrl, siteMatcher),
    );
    if (substitute) {
      return { integration: substitute, source: "substitute", pinnedIntegration: pinned };
    }

    if (
      fallbackIntegrationId &&
      fallbackIntegrationId !== pinned.id &&
      siteMatcher(fallbackSiteUrl, requestedSiteUrl)
    ) {
      return { integration: null, source: "substitute", pinnedIntegration: pinned };
    }

    return {
      integration: pinned,
      source: "explicit-needs-reconnect",
      pinnedIntegration: pinned,
    };
  }

  const usable = broken
    ? integrations.filter((integration) => !broken.has(integration.id))
    : integrations;

  if (usable.length === 0) {
    return {
      integration: null,
      source: fallbackIntegrationId ? "fallback" : "none",
      pinnedIntegration: null,
    };
  }

  const mapped = usable.find((integration) => hasUsableClientMapping(integration, clientId));
  if (mapped) return { integration: mapped, source: "mapped", pinnedIntegration: null };

  if (fallbackIntegrationId) {
    return { integration: null, source: "fallback", pinnedIntegration: null };
  }

  return { integration: usable[0], source: "first", pinnedIntegration: null };
}
