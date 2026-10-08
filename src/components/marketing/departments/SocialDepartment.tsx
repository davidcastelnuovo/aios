import { useQuery } from "@tanstack/react-query";
import { Loader2, Share2 } from "lucide-react";
import { ensurePipelineForClient } from "@/components/marketing/lib/ensurePipeline";
import { SocialContentGantt } from "@/components/marketing/SocialContentGantt";
import {
  ALL_CLIENTS_FILTER,
  type MarketingClientFilter,
} from "@/components/marketing/clientFilter";
import { ClientSelector } from "@/components/marketing/ClientSelector";

interface Props {
  clientFilter: MarketingClientFilter;
  tenantId: string;
  onClientChange: (id: string | null) => void;
}

export function SocialDepartment({ clientFilter, tenantId, onClientChange }: Props) {
  const needsClient = !clientFilter || clientFilter === ALL_CLIENTS_FILTER;

  const { data: pipeline, isLoading, error } = useQuery({
    queryKey: ["social-department-pipeline", clientFilter, tenantId],
    queryFn: async () => {
      if (!clientFilter || clientFilter === ALL_CLIENTS_FILTER) return null;
      const row = await ensurePipelineForClient({
        clientId: clientFilter,
        tenantId,
        track: "social_organic",
      });
      if (!row) throw new Error("לא ניתן לפתוח פייפליין סושיאל ללקוח");
      return row;
    },
    enabled: !needsClient,
  });

  if (needsClient) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <Share2 className="h-12 w-12 text-violet-400/50" />
        <div>
          <h2 className="text-lg font-bold">מחלק סושיאל</h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            גאנט תוכן, תזמון ופרסום אורגני — בחרו לקוח כדי לראות ולנהל את לוח הפוסטים שלו.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">לקוח:</span>
          <ClientSelector
            tenantId={tenantId}
            value={clientFilter}
            onChange={onClientChange}
            allowGeneral={false}
            allowAllClients={false}
          />
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-violet-500" />
      </div>
    );
  }

  if (error || !pipeline) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-destructive">
        {error instanceof Error ? error.message : "שגיאה בטעינת מחלקת הסושיאל"}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SocialContentGantt
        pipelineId={pipeline.id}
        tenantId={tenantId}
        clientId={clientFilter}
      />
    </div>
  );
}
