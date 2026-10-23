import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useCarmenSkins } from "@/hooks/useCarmenSkins";
import { useCommandCenterSidecar } from "@/contexts/CommandCenterSidecarContext";
import { WorkshopCanvas } from "@/components/workshop/WorkshopCanvas";
import { WorkshopProjects } from "@/components/workshop/WorkshopProjects";
import { WorkshopSkinBar } from "@/components/workshop/WorkshopSkinBar";
import { roleForSlug } from "@/components/workshop/workshopRoles";

type ProjectRow = {
  id: string;
  title: string | null;
  payload: Record<string, unknown> | null;
};

export default function CarmenWorkshop() {
  const { tenant } = useCurrentTenant();
  const tenantId = tenant?.id;
  const skins = useCarmenSkins();
  const { setOpen } = useCommandCenterSidecar();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [blank, setBlank] = useState(false);
  const activeRole = roleForSlug(skins.activeSlug)?.id ?? "copy";

  useEffect(() => {
    setOpen(true);
  }, [setOpen]);

  const projects = useQuery({
    queryKey: ["carmen-workshop-projects", tenantId],
    enabled: !!tenantId,
    queryFn: async (): Promise<ProjectRow[]> => {
      const { data, error } = await supabase
        .from("marketing_work_items")
        .select("id,title,status,updated_at,payload")
        .eq("tenant_id", tenantId!)
        .neq("status", "archived")
        .order("updated_at", { ascending: false })
        .limit(40);
      if (error) throw error;
      return (data ?? []) as unknown as ProjectRow[];
    },
  });

  const selected = blank
    ? null
    : (projects.data?.find((item) => item.id === projectId) ??
      projects.data?.[0] ??
      null);

  return (
    <div className="flex h-[calc(100vh-4rem)] min-h-0 flex-col" dir="rtl">
      <header className="flex shrink-0 items-center gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold">הסדנה של כרמן</h1>
          <p className="text-xs text-muted-foreground">
            מחליפים סקין, כרמן עושה את העבודה
          </p>
        </div>
        <WorkshopSkinBar
          skins={skins.skins}
          activeRole={activeRole}
          onChoose={(slug) => {
            skins.setActiveSkin(slug).catch((error: unknown) => {
              toast.error(
                error instanceof Error ? error.message : "החלפת הסקין נכשלה",
              );
            });
          }}
        />
      </header>
      <div className="flex min-h-0 flex-1">
        <WorkshopProjects
          projects={projects.data ?? []}
          selectedId={selected?.id ?? null}
          loading={projects.isLoading}
          error={projects.isError}
          onCreate={() => {
            setBlank(true);
            setProjectId(null);
          }}
          onSelect={(id) => {
            setBlank(false);
            setProjectId(id);
          }}
        />
        <main className="relative min-h-0 min-w-0 flex-1">
          <div className="absolute inset-0">
            <WorkshopCanvas
              title={selected?.title ?? null}
              payload={selected?.payload ?? null}
              blank={blank || !selected}
              quiet={projects.isLoading && !blank}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
