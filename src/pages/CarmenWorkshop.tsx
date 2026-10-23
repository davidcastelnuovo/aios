import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useCarmenSkins } from "@/hooks/useCarmenSkins";
import { useCommandCenterSidecar } from "@/contexts/CommandCenterSidecarContext";
import { WorkshopBoard } from "@/components/workshop/WorkshopBoard";
import { WorkshopProjects } from "@/components/workshop/WorkshopProjects";
import { WorkshopSkinBar } from "@/components/workshop/WorkshopSkinBar";
import {
  roleForSlug,
  type WorkshopRoleId,
} from "@/components/workshop/workshopRoles";

type ProjectRow = {
  id: string;
  title: string | null;
  payload: Record<string, unknown> | null;
};

const toolDepartment = (role: WorkshopRoleId) => {
  if (role === "copy") return "copy";
  if (role === "seo") return "seo";
  if (role === "design" || role === "video") return "creative";
  return null;
};

export default function CarmenWorkshop() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { tenant } = useCurrentTenant();
  const tenantId = tenant?.id;
  const skins = useCarmenSkins();
  const { setOpen } = useCommandCenterSidecar();
  const [projectId, setProjectId] = useState<string | null>(null);
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

  const selected =
    projects.data?.find((item) => item.id === projectId) ??
    projects.data?.[0] ??
    null;
  const department = toolDepartment(activeRole);
  const toolsHref = department
    ? `/t/${tenantSlug}/marketing/department/${department}`
    : null;

  return (
    <div className="flex h-[calc(100vh-4rem)] min-h-0 flex-col" dir="rtl">
      <header className="flex shrink-0 items-center gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold">הסדנה של כרמן</h1>
          <p className="text-xs text-muted-foreground">
            אותו פרויקט, מחליפים סקין
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
          newHref={toolsHref}
          onSelect={setProjectId}
        />
        <main className="min-w-0 flex-1 overflow-auto bg-muted/30 p-6">
          {selected ? (
            <WorkshopBoard
              title={selected.title?.trim() || "ללא שם"}
              payload={selected.payload}
              toolsHref={toolsHref}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              בחרו פרויקט מהרשימה, או התחילו חדש.
            </p>
          )}
        </main>
      </div>
    </div>
  );
}
