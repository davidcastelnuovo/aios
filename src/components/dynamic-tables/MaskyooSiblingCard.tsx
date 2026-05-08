import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { MaskyooCallsCard } from "./MaskyooCallsCard";
import { Card, CardContent } from "@/components/ui/card";
import { Phone, Settings } from "lucide-react";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";

interface CrmTableLike {
  id: string;
  tenant_id: string;
  client_id: string | null;
  integration_type: string | null;
  integration_settings: any;
}

interface MaskyooNumberRow {
  phone_last9: string;
  display_number: string;
  label: string | null;
  category: "organic" | "paid" | "general" | string | null;
  is_ignored: boolean;
}

/**
 * Looks up Maskyoo numbers assigned to this report's client (via the existing
 * `maskyoo_numbers` table managed in /maskyoo-settings) and renders the calls
 * KPI card. Shows an empty-state CTA when no number is linked yet.
 */
export function MaskyooSiblingCard({ table }: { table: CrmTableLike }) {
  const { tenant } = useCurrentTenant();
  const tenantSlug = tenant?.slug;

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
        .select("phone_last9, display_number, label, category, is_ignored")
        .eq("tenant_id", table.tenant_id)
        .eq("client_id", clientId)
        .eq("is_ignored", false);
      if (error) throw error;
      return (data || []) as MaskyooNumberRow[];
    },
  });

  if (!clientId || isLoading) return null;

  const numbers = (rows || []).map((r) => {
    const cat = (r.category || "general").toLowerCase();
    const accent: "emerald" | "blue" | "purple" =
      cat === "paid" ? "blue" : cat === "general" ? "purple" : "emerald";
    const label =
      r.label ||
      (cat === "paid" ? "ממומן" : cat === "general" ? "כללי" : "אורגני");
    return { label, number: r.display_number, accent };
  });

  if (numbers.length === 0) {
    return (
      <Card className="border-dashed border-emerald-300 bg-emerald-50/30 dark:bg-emerald-950/10">
        <CardContent className="p-4 flex items-center justify-between gap-3" dir="rtl">
          <div className="flex items-center gap-2 text-sm">
            <Phone className="h-4 w-4 text-emerald-600" />
            <span className="text-muted-foreground">
              לא חובר מספר מסקיו ללקוח. נהל מספרים כדי לראות שיחות בדוח.
            </span>
          </div>
          {tenantSlug && (
            <Link
              to={`/t/${tenantSlug}/maskyoo-settings`}
              className="text-xs inline-flex items-center gap-1 text-emerald-700 hover:underline"
            >
              <Settings className="h-3 w-3" />
              הגדרות מסקיו
            </Link>
          )}
        </CardContent>
      </Card>
    );
  }

  return <MaskyooCallsCard tenantId={table.tenant_id} numbers={numbers} days={30} />;
}
