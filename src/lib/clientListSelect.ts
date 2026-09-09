/**
 * Supabase select fragment for the Clients list query.
 *
 * The client card (ClientsChatView) reads from this cached list — any `clients`
 * column shown in the card, grid, table, or export must appear here or it will
 * look empty even when set in the database.
 *
 * Tabs that fetch their own data (not from this list) include:
 * - connections → useClientConnections
 * - credentials → client_credentials
 * - meeting emails (extra contacts) → client_contacts
 * - docs linked chat files → team_chat_files
 * - recordings / tables / dashboards / wordpress / updates → per-tab queries
 */
export const CLIENT_LIST_COLUMNS = [
  "id",
  "name",
  "status",
  "agency_id",
  "tenant_id",
  "is_seo_client",
  "services",
  "created_at",
  "updated_at",
  "phone",
  "contact_name",
  "email",
  "website",
  "notes",
  "start_date",
  "end_date",
  "follow_up_date",
  "mood_status",
  "health_score",
  "tier",
  "industry",
  "monthly_budget",
  "retainer",
  "monthly_fixed_expense",
  "folder_link",
  "folder_links",
  "attachments",
  "whatsapp_group_id",
  "meta_ads_account_id",
  "google_ads_account_id",
  "ga_property_id",
  "gsc_site_url",
  "ahrefs_domain",
] as const;

export const CLIENT_LIST_SELECT = `
  ${CLIENT_LIST_COLUMNS.join(", ")},
  agencies (name),
  client_team (
    campaigner_id,
    campaigners!inner (
      id,
      full_name
    )
  )
`;
