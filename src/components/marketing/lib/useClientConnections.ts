import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ClientConnections {
  client: {
    id: string;
    name: string;
    services: string[] | null;
    website: string | null;
    meta_ads_account_id: string | null;
    google_ads_account_id: string | null;
    ga_property_id: string | null;
    gsc_site_url: string | null;
    ahrefs_domain: string | null;
  } | null;
  socialPages: Array<{
    id: string;
    platform: string;
    page_id: string;
    page_name: string | null;
    is_active: boolean | null;
  }>;
  wpSites: Array<{
    id: string;
    site_url: string;
    site_name: string | null;
  }>;
}

export function useClientConnections(clientId: string | null | undefined) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["client-connections", clientId],
    enabled: !!clientId,
    queryFn: async (): Promise<ClientConnections> => {
      const clientRes = await supabase
        .from("clients")
        .select("id, name, services, website, meta_ads_account_id, google_ads_account_id, ga_property_id, gsc_site_url, ahrefs_domain")
        .eq("id", clientId!)
        .maybeSingle();
      const pagesRes = await supabase
        .from("social_pages")
        .select("id, platform, page_id, page_name, is_active")
        .eq("client_id", clientId!);
      const wpRes = await supabase
        .from("social_media_wordpress_sites")
        .select("id, site_url, site_name")
        .eq("client_id", clientId!);

      return {
        client: (clientRes.data as any) ?? null,
        socialPages: (pagesRes.data as any) ?? [],
        wpSites: (wpRes.data as any) ?? [],
      };
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["client-connections", clientId] });

  return { ...query, invalidate };
}

