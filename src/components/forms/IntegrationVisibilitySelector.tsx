/**
 * IntegrationVisibilitySelector
 *
 * Lets the owner of a per-user integration choose who can use their connection:
 *   - private  → only the owner
 *   - org      → every member of the tenant
 *   - shared   → specific users (opens ManageIntegrationPermissionsDialog)
 *
 * The component reads the current visibility from the DB and persists changes
 * immediately when the user picks a new option.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Loader2, Lock, Globe, Users, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { ManageIntegrationPermissionsDialog } from "@/components/forms/ManageIntegrationPermissionsDialog";

type Visibility = "private" | "org" | "shared";

interface Props {
  integrationId: string;
  integrationName: string;
  ownerId: string | null;
  tenantId: string;
}

const VISIBILITY_OPTIONS: {
  value: Visibility;
  label: string;
  description: string;
  icon: React.ReactNode;
  badge?: string;
}[] = [
  {
    value: "private",
    label: "פרטי",
    description: "רק אתה יכול להשתמש בחיבור זה",
    icon: <Lock className="h-4 w-4 text-muted-foreground" />,
  },
  {
    value: "org",
    label: "כל הארגון",
    description: "כל חברי הארגון יכולים להשתמש בחיבור זה",
    icon: <Globe className="h-4 w-4 text-blue-500" />,
    badge: "מומלץ",
  },
  {
    value: "shared",
    label: "משתמשים ספציפיים",
    description: "בחר בדיוק אילו משתמשים יקבלו גישה",
    icon: <Users className="h-4 w-4 text-violet-500" />,
  },
];

export function IntegrationVisibilitySelector({
  integrationId,
  integrationName,
  ownerId,
  tenantId,
}: Props) {
  const queryClient = useQueryClient();
  const [permissionsOpen, setPermissionsOpen] = useState(false);

  // Fetch current visibility
  const { data: integration, isLoading } = useQuery({
    queryKey: ["integration-visibility", integrationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_integrations")
        .select("id, connection_visibility")
        .eq("id", integrationId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!integrationId,
  });

  const currentVisibility: Visibility =
    (integration?.connection_visibility as Visibility) || "private";

  // Mutation to update visibility
  const updateVisibility = useMutation({
    mutationFn: async (visibility: Visibility) => {
      const { error } = await supabase
        .from("tenant_integrations")
        .update({ connection_visibility: visibility })
        .eq("id", integrationId);
      if (error) throw error;
    },
    onSuccess: (_, visibility) => {
      queryClient.invalidateQueries({ queryKey: ["integration-visibility", integrationId] });
      queryClient.invalidateQueries({ queryKey: ["user-integrations"] });
      const labels: Record<Visibility, string> = {
        private: "פרטי",
        org: "כל הארגון",
        shared: "משתמשים ספציפיים",
      };
      toast.success(`נראות החיבור עודכנה ל: ${labels[visibility]}`);
      // If switching to 'shared', open the permissions dialog immediately
      if (visibility === "shared") {
        setPermissionsOpen(true);
      }
    },
    onError: (error: Error) => {
      toast.error("שגיאה בעדכון נראות: " + error.message);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        טוען הגדרות שיתוף...
      </div>
    );
  }

  return (
    <div className="space-y-3" dir="rtl">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">נראות החיבור</span>
        {updateVisibility.isPending && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      <RadioGroup
        value={currentVisibility}
        onValueChange={(v) => updateVisibility.mutate(v as Visibility)}
        disabled={updateVisibility.isPending}
        className="space-y-2"
      >
        {VISIBILITY_OPTIONS.map((opt) => (
          <label
            key={opt.value}
            htmlFor={`vis-${opt.value}-${integrationId}`}
            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors
              ${currentVisibility === opt.value
                ? "border-primary bg-primary/5"
                : "border-border hover:bg-accent/40"
              }
              ${updateVisibility.isPending ? "opacity-60 pointer-events-none" : ""}
            `}
          >
            <RadioGroupItem
              value={opt.value}
              id={`vis-${opt.value}-${integrationId}`}
              className="shrink-0"
            />
            <div className="flex items-center gap-2 shrink-0">{opt.icon}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{opt.label}</span>
                {opt.badge && (
                  <Badge variant="secondary" className="text-xs py-0">
                    {opt.badge}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {opt.description}
              </p>
            </div>
          </label>
        ))}
      </RadioGroup>

      {/* Button to manage specific user permissions when visibility = shared */}
      {currentVisibility === "shared" && (
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2"
          onClick={() => setPermissionsOpen(true)}
        >
          <Settings2 className="h-4 w-4" />
          נהל משתמשים עם גישה
        </Button>
      )}

      <ManageIntegrationPermissionsDialog
        open={permissionsOpen}
        onOpenChange={setPermissionsOpen}
        integrationId={integrationId}
        integrationName={integrationName}
        integrationOwnerId={ownerId || ""}
        tenantId={tenantId}
      />
    </div>
  );
}
