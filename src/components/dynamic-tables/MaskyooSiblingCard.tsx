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

const ORGANIC_TYPES = new Set(["google_analytics", "google_search_console", "ahrefs"]);
const PAID_TYPES = new Set(["google_ads"]);

/**
 * Wraps MaskyooCallsCard and pulls Maskyoo numbers from sibling reports of the
 * same client — so the SEO report shows the organic line, the Google Ads
 * report shows the paid line, and either dashboard renders both when both
 * are configured on their respective sibling reports.
 */
export function MaskyooSiblingCard({ table }: { table: CrmTableLike }) {
  const clientId =
    (table.integration_settings?.clientId as string | undefined) ||
    (table.integration_settings?.client_id as string | undefined) ||
    table.client_id ||
    null;

  const { data: siblings } = useQuery({
    queryKey: ["maskyoo-sibling-tables", table.tenant_id, clientId],
    enabled: !!table.tenant_id && !!clientId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_tables")
        .select("id, integration_type, integration_settings, client_id")
        .eq("tenant_id", table.tenant_id)
        .eq("client_id", clientId);
      if (error) throw error;
      return data || [];
    },
  });

  // Build a deduped list of {label, number, accent} from siblings + the
  // current table itself (in case it isn't returned for any reason).
  const candidates = [
    ...(siblings || []),
    {
      id: table.id,
      integration_type: table.integration_type,
      integration_settings: table.integration_settings,
      client_id: table.client_id,
    },
  ];

  let organic: string | null = null;
  let paid: string | null = null;

  for (const t of candidates) {
    const num = (t.integration_settings?.maskyoo_number as string | undefined)?.trim();
    if (!num) continue;
    if (!t.integration_type) continue;
    if (PAID_TYPES.has(t.integration_type) && !paid) paid = num;
    else if (ORGANIC_TYPES.has(t.integration_type) && !organic) organic = num;
  }

  const numbers: { label: string; number: string; accent: "emerald" | "blue" }[] = [];
  if (organic) numbers.push({ label: "אורגני (SEO)", number: organic, accent: "emerald" });
  if (paid) numbers.push({ label: "ממומן (Google Ads)", number: paid, accent: "blue" });

  if (numbers.length === 0) return null;

  return <MaskyooCallsCard tenantId={table.tenant_id} numbers={numbers} days={30} />;
}
