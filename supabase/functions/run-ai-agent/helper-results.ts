import type { Json } from "../../../src/integrations/supabase/types.ts";
import type { AgentRow } from "./database-contracts.ts";

export type SearchClient = Pick<
  AgentRow<"clients">,
  | "id"
  | "name"
  | "contact_name"
  | "phone"
  | "status"
  | "agency_id"
  | "tenant_id"
  | "meta_ads_account_id"
> & {
  agency_name: string | null;
  matched_via: string[];
  ad_accounts: Array<{
    table_id: string;
    table_name: string;
    integration_type: string | null;
    ad_account_id: Json;
    ad_account_name: Json;
    account_status: Json;
  }>;
};

export type MetaAdMetrics = {
  spend: number;
  leads: number;
  impressions: number;
  clicks: number;
  cpl: number | null;
};

export type AccountInsights = {
  spend: number;
  leads_count: number;
  impressions: number;
  clicks: number;
  cost_per_lead: number | null;
  reach?: number | null;
  no_delivery?: boolean;
};

export type DisconnectedClient = {
  client_id: string;
  client_name: string;
  reason: string;
};

export type ConnectedClient = AccountInsights & {
  client_id: string;
  client_name: string;
  ad_account: string;
  matched_by: "config" | "name" | null;
  matched_account_name: string | null;
  source: string;
};
