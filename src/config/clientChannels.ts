// Single source of truth mapping a client's marketing channels to:
//  - which clients.services codes activate the channel (empty = always shown)
//  - which client connection fields to show/edit (columns on `clients`)
//  - the dynamic-table integration(s) to provision per channel (Phase 2)
// Drives both the conditional connection fields in client details and the
// one-button provisioning of per-channel crm_tables + dashboard.

export type ChannelFieldKey =
  | "website"
  | "ga_property_id"
  | "google_ads_account_id"
  | "meta_ads_account_id"
  | "ahrefs_domain"
  | "gsc_site_url";

export interface ChannelField {
  key: ChannelFieldKey;
  label: string;
  placeholder?: string;
}

// A dynamic table to provision for the channel (Phase 2). `requiresField` is the
// client field that must be filled for the table to be created/synced.
export interface ChannelTable {
  integrationType: string; // crm_tables.integration_type
  syncFunction: string;    // edge function name
  requiresField: ChannelFieldKey;
}

export interface ClientChannel {
  id: string;
  label: string;
  /** clients.services codes that activate this channel; empty array = always shown */
  services: string[];
  fields: ChannelField[];
  /** show the linked-Facebook-pages UI block under this channel */
  showFacebookPages?: boolean;
  /** dynamic tables to provision for this channel */
  tables: ChannelTable[];
}

export const CLIENT_CHANNELS: ClientChannel[] = [
  {
    id: "core",
    label: "אתר ואנליטיקס",
    services: [], // always shown
    fields: [
      { key: "website", label: "אתר ראשי לקידום", placeholder: "https://" },
      { key: "ga_property_id", label: "Google Analytics (GA4) Property", placeholder: "properties/123456789" },
    ],
    tables: [
      { integrationType: "google_analytics", syncFunction: "sync-google-analytics-data", requiresField: "ga_property_id" },
    ],
  },
  {
    id: "google_ads",
    label: "Google Ads (PPC)",
    services: ["ppc_google"],
    fields: [
      { key: "google_ads_account_id", label: "Google Ads Account ID", placeholder: "123-456-7890" },
    ],
    tables: [
      { integrationType: "google_ads", syncFunction: "sync-google-ads-data", requiresField: "google_ads_account_id" },
    ],
  },
  {
    id: "meta_ads",
    label: "Meta Ads (פייסבוק/אינסטגרם)",
    services: ["ppc_meta"],
    fields: [
      { key: "meta_ads_account_id", label: "Meta Ads Account ID", placeholder: "act_..." },
    ],
    showFacebookPages: true,
    tables: [
      { integrationType: "facebook_insights", syncFunction: "sync-facebook-insights", requiresField: "meta_ads_account_id" },
    ],
  },
  {
    id: "seo",
    label: "SEO (Ahrefs + Search Console)",
    services: ["seo"],
    fields: [
      { key: "ahrefs_domain", label: "Ahrefs Domain", placeholder: "example.com" },
      { key: "gsc_site_url", label: "Search Console Site", placeholder: "sc-domain:example.com" },
    ],
    tables: [
      { integrationType: "ahrefs", syncFunction: "sync-ahrefs-data", requiresField: "ahrefs_domain" },
      { integrationType: "google_search_console", syncFunction: "sync-google-search-console-data", requiresField: "gsc_site_url" },
    ],
  },
];

/** Is the channel active for a client with the given `services`? Empty services list => always-on channel. */
export function isChannelActive(channel: ClientChannel, services: string[] | null | undefined): boolean {
  if (channel.services.length === 0) return true;
  const s = Array.isArray(services) ? services : [];
  return channel.services.some((svc) => s.includes(svc));
}

/** All connection field keys across all channels (for building the save payload). */
export const ALL_CHANNEL_FIELD_KEYS: ChannelFieldKey[] = Array.from(
  new Set(CLIENT_CHANNELS.flatMap((c) => c.fields.map((f) => f.key)))
);
