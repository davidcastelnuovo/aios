import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SubmissionsFullView } from "@/components/landing-page-submissions/SubmissionsFullView";
import { Loader2, FileText, Globe } from "lucide-react";

export default function LandingPageSubmissions() {
  const { tenantId } = useCurrentTenant();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSite = searchParams.get("site");
  const [siteId, setSiteId] = useState<string | null>(initialSite);

  const { data: sites = [], isLoading } = useQuery({
    queryKey: ["wp-sites-for-submissions", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("social_media_wordpress_sites" as any)
        .select("id, site_name, site_url, client_id")
        .eq("tenant_id", tenantId)
        .eq("is_active", true);
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!tenantId,
  });

  // Auto-select first site if none chosen
  useEffect(() => {
    if (!siteId && sites.length > 0) {
      setSiteId(sites[0].id);
    }
  }, [sites, siteId]);

  // Sync siteId to URL
  useEffect(() => {
    if (siteId && siteId !== searchParams.get("site")) {
      setSearchParams({ site: siteId }, { replace: true });
    }
  }, [siteId, searchParams, setSearchParams]);

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4 max-w-7xl" dir="rtl">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Submissions בעמודי נחיתה</h1>
            <p className="text-sm text-muted-foreground">
              שליפה בזמן אמת מ-Elementor Pro Forms עם פילוח לפי מקור הגעה
            </p>
          </div>
        </div>

        {sites.length > 0 && (
          <Select value={siteId || ""} onValueChange={(v) => setSiteId(v)}>
            <SelectTrigger className="w-72">
              <Globe className="h-4 w-4 me-2" />
              <SelectValue placeholder="בחר אתר" />
            </SelectTrigger>
            <SelectContent>
              {sites.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.site_name || s.site_url}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </header>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : sites.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-2">
            <Globe className="h-10 w-10 text-muted-foreground/40 mx-auto" />
            <p className="text-sm text-muted-foreground">
              אין אתרי WordPress מחוברים. הוסף אתר בעמוד הגדרות WordPress.
            </p>
          </CardContent>
        </Card>
      ) : siteId ? (
        <SubmissionsFullView siteId={siteId} />
      ) : null}
    </div>
  );
}
