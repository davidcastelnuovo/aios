import type { Database, Json } from "../_shared/database.types.ts";
import type { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

// Use generated row/query inference for helpers without migrating sibling dispatch slices.
// The merged database baseline includes these entries, but the generated snapshot is still stale.
// Remove the overlay after refreshing generated types: https://linear.app/aios-co/issue/AIO-116
type AgentDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables" | "Functions"> & {
    Tables: Omit<Database["public"]["Tables"], "crm_tables"> & {
      crm_tables: Omit<Database["public"]["Tables"]["crm_tables"], "Row"> & {
        Row: AgentRow<"crm_tables"> & { campaign_active: boolean };
      };
    };
    Functions: Database["public"]["Functions"] & {
      claude_notify_david: {
        Args: { p_message: string; p_tenant?: string; p_chat_id?: string };
        Returns: Json;
      };
    };
  };
};

export type AgentDatabaseClient = ReturnType<
  typeof createClient<AgentDatabase>
>;

export type AgentRow<Name extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][Name]["Row"];
