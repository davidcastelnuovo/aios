import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase as generatedClient } from "./client";
import type { Database, Json, Tables } from "./types";

// Supplemental schema from committed migrations; the generated snapshot predates
// these columns/tables. Reuse the authenticated client and its RLS context.
// 20260624000000, 20260624000100, 20260624000200, 20260624000005.
export type AgentProfile = Tables<"ai_agents"> & {
  mood?: string | null;
  voice?: string | null;
  metadata?: Json;
  disabled_tools?: string[] | null;
  disabled_skins?: string[] | null;
  disabled_integrations?: string[] | null;
};
type AgentColumns = Pick<
  AgentProfile,
  | "mood"
  | "voice"
  | "metadata"
  | "disabled_tools"
  | "disabled_skins"
  | "disabled_integrations"
>;
type Table<Row, Required extends keyof Row> = {
  Row: Row;
  Insert: Pick<Row, Required> & Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};
type Policy = {
  id: string;
  tenant_id: string;
  agent_id: string;
  private_phones: Json;
  allowed_group_ids: string[];
  require_direct_address: boolean;
  open_member_groups: boolean;
  deny_message_he: string | null;
  created_at: string;
  updated_at: string;
};
type ClientGroup = {
  id: string;
  tenant_id: string;
  client_id: string;
  whatsapp_group_id: string;
  allow_client_contacts: boolean;
  allow_assigned_campaigners: boolean;
  info_boundary: "external_only" | "full";
  created_at: string;
  updated_at: string;
};
type Identity = {
  id: string;
  tenant_id: string;
  phone: string;
  entity_type: "campaigner" | "client_contact";
  entity_id: string;
  client_id: string | null;
  display_name: string | null;
  role_title: string | null;
  status: "pending" | "approved" | "rejected" | "revoked";
  approved_by: string | null;
  approved_at: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
  surfaces: string[];
  allowed_group_ids: string[] | null;
  scope_mode: "org" | "assigned_clients" | "single_client";
  dev_escalation_tier: "full" | "bugfix" | null;
  escalation_agents: string[];
};
type AccessDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables"> & {
    Tables: Omit<Database["public"]["Tables"], "ai_agents"> & {
      ai_agents: Omit<
        Database["public"]["Tables"]["ai_agents"],
        "Row" | "Insert" | "Update"
      > & {
        Row: AgentProfile;
        Insert: Database["public"]["Tables"]["ai_agents"]["Insert"] &
          AgentColumns;
        Update: Database["public"]["Tables"]["ai_agents"]["Update"] &
          AgentColumns;
      };
      // 20260910120000_carmen_conversation_access.sql
      carmen_access_policies: Table<Policy, "tenant_id" | "agent_id">;
      carmen_client_group_access: Table<
        ClientGroup,
        "tenant_id" | "client_id" | "whatsapp_group_id"
      >;
      // 20260729210000_carmen_whatsapp_identity_access.sql, extended above.
      carmen_whatsapp_identities: Table<
        Identity,
        "tenant_id" | "phone" | "entity_type" | "entity_id"
      >;
      // 20260723060000_user_api_keys.sql
      user_api_keys: Table<
        {
          user_id: string;
          provider: string;
          api_key: string;
          created_at: string;
          updated_at: string;
        },
        "user_id" | "api_key"
      >;
    };
  };
};
export const supabase = generatedClient as SupabaseClient<AccessDatabase>;
