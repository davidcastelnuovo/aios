import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Facebook, Instagram, Globe, Megaphone, Search } from "lucide-react";

interface Props {
  clientId: string;
}

export function ClientConnectionsBar({ clientId }: Props) {
  const { data } = useQuery({
    queryKey: ["client-connections", clientId],
    queryFn: async () => {
      const [client, pages, wp] = await Promise.all([
        supabase
          .from("clients")
          .select("meta_ads_account_id, google_ads_account_id, website")
          .eq("id", clientId)
          .maybeSingle(),
        supabase.from("social_pages").select("platform").eq("client_id", clientId),
        supabase
          .from("social_media_wordpress_sites")
          .select("id")
          .limit(1),
      ]);
      return {
        meta_ads: !!client.data?.meta_ads_account_id,
        google_ads: !!client.data?.google_ads_account_id,
        website: !!client.data?.website,
        facebook: pages.data?.some((p: any) => p.platform === "facebook") ?? false,
        instagram: pages.data?.some((p: any) => p.platform === "instagram") ?? false,
        wordpress: (wp.data?.length ?? 0) > 0,
      };
    },
  });

  const items = [
    { key: "meta_ads", label: "Meta Ads", icon: Megaphone, on: data?.meta_ads },
    { key: "google_ads", label: "Google Ads", icon: Search, on: data?.google_ads },
    { key: "facebook", label: "Facebook", icon: Facebook, on: data?.facebook },
    { key: "instagram", label: "Instagram", icon: Instagram, on: data?.instagram },
    { key: "wordpress", label: "WordPress", icon: Globe, on: data?.wordpress },
  ];

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1.5">
        {items.map((it) => (
          <Tooltip key={it.key}>
            <TooltipTrigger asChild>
              <Badge
                variant={it.on ? "default" : "outline"}
                className={`gap-1 px-1.5 py-0.5 ${it.on ? "" : "opacity-50"}`}
              >
                <it.icon className="h-3 w-3" />
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              {it.label}: {it.on ? "מחובר" : "לא מחובר"}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
