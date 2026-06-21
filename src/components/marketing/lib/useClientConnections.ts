import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ClientConnections {
  client: {
    id: string;
    name: string;
    website: string | null;
    meta_ads_account_id: string | null;
    google_ads_account_id: string | null;
  } | null;
  socialPages: Array<{
    id: string;
    platform: string;
    page_id: string;
    page_name: string | null;
    is_active: boolean | null;
  }>;
  channels: Array<{
    id: string;
    platform: string;
    name: string | null;
    config: any;
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
      const [clientRes, pagesRes, channelsRes, wpRes] = await Promise.all([
        supabase
          .from("clients")
          .select("id, name, website, meta_ads_account_id, google_ads_account_id")
          .eq("id", clientId!)
          .maybeSingle(),
        supabase
          .from("social_pages")
          .select("id, platform, page_id, page_name, is_active")
          .eq("client_id", clientId!),
        supabase
          .from("social_media_channels")
          .select("id, platform, name, config")
          .eq("client_id", clientId!),
        supabase
          .from("social_media_wordpress_sites")
          .select("id, site_url, site_name")
          .eq("client_id", clientId!),
      ]);
      return {
        client: (clientRes.data as any) ?? null,
        socialPages: (pagesRes.data as any) ?? [],
        channels: (channelsRes.data as any) ?? [],
        wpSites: (wpRes.data as any) ?? [],
      };
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["client-connections", clientId] });

  return { ...query, invalidate };
}
