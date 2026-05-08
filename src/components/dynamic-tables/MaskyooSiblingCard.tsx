import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MaskyooCallsCard } from "./MaskyooCallsCard";

interface CrmTableLike {
  id: string;
  tenant_id: string;
  client_id: string | null;
  integration_type: string | null;
  integration_settings: any;
}

interface MaskyooNumberRow {
  display_number: string;
  category: "organic" | "paid" | "general" | string | null;
  is_ignored: boolean;
}

/**
 * Renders the SEO calls KPI card for the report's client.
 * Always shown when a client is linked (manual edit works even without
 * any Maskyoo number assigned).
 */
export function MaskyooSiblingCard({ table }: { table: CrmTableLike }) {
  const clientId =
    (table.integration_settings?.clientId as string | undefined) ||
    (table.integration_settings?.client_id as string | undefined) ||
    table.client_id ||
    null;

  const { data: rows, isLoading } = useQuery({
    queryKey: ["maskyoo-numbers-by-client", table.tenant_id, clientId],
    enabled: !!table.tenant_id && !!clientId,
    staleTime: 60_000,
    queryFn: async (): Promise<MaskyooNumberRow[]> => {
      const { data, error } = await supabase
        .from("maskyoo_numbers")
        .select("display_number, category, is_ignored")
        .eq("tenant_id", table.tenant_id)
        .eq("client_id", clientId)
        .eq("is_ignored", false);
      if (error) throw error;
      return (data || []) as MaskyooNumberRow[];
    },
  });

  if (!clientId || isLoading) return null;

  // Map to organic/paid only — "general" lines fall under organic by default.
  const numbers = (rows || [])
    .map((r) => {
      const cat = (r.category || "organic").toLowerCase();
      const category: "organic" | "paid" = cat === "paid" ? "paid" : "organic";
      return { number: r.display_number, category };
    });

  return (
    <MaskyooCallsCard
      tenantId={table.tenant_id}
      clientId={clientId}
      numbers={numbers}
    />
  );
}
