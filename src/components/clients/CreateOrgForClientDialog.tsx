import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { InlineDialog } from "@/components/ui/inline-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Building2, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CreateOrgForClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: { id: string; name: string; tenant_id?: string } | null;
  inline?: boolean;
  onCreated?: (tenantId: string) => void;
}

interface OrgCreatedResult {
  tenant: { id: string; name: string; slug: string };
  owner_status: "existing_user" | "invited" | "no_email";
  invited_email?: string;
  shared: { integrations: number; pages: number; sites: number };
  warnings: string[];
}

export function CreateOrgForClientDialog({
  open,
  onOpenChange,
  client,
  inline = false,
  onCreated,
}: CreateOrgForClientDialogProps) {
  const queryClient = useQueryClient();
  const [shareLlm, setShareLlm]       = useState(false);
  const [cloneCarmen, setCloneCarmen] = useState(true);
  const [result, setResult]           = useState<OrgCreatedResult | null>(null);

  // Preview: count pages/sites/integrations for the client
  const { data: preview } = useQuery({
    queryKey: ["create-org-preview", client?.id],
    enabled: open && !!client?.id,
    queryFn: async () => {
      if (!client?.id) return { pages: 0, sites: 0, integrations: 0 };

      const [{ count: pages }, { count: sites }, { count: integrations }] = await Promise.all([
        supabase.from("social_pages").select("id", { count: "exact", head: true }).eq("client_id", client.id),
        supabase.from("social_media_wordpress_sites").select("id", { count: "exact", head: true }).eq("tenant_id", client.tenant_id ?? ""),
        supabase.from("tenant_integrations").select("id", { count: "exact", head: true }).eq("tenant_id", client.tenant_id ?? "").eq("is_active", true),
      ]);

      return { pages: pages ?? 0, sites: sites ?? 0, integrations: integrations ?? 0 };
    },
  });

  const { data: primaryContact } = useQuery({
    queryKey: ["primary-contact", client?.id],
    enabled: open && !!client?.id,
    queryFn: async () => {
      if (!client?.id) return null;
      const { data } = await supabase
        .from("client_contacts")
        .select("contact_name, email, phone")
        .eq("client_id", client.id)
        .eq("is_primary", true)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (!open) { setResult(null); setShareLlm(false); setCloneCarmen(true); }
  }, [open]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!client) throw new Error("missing client");
      const { data, error } = await supabase.functions.invoke("create-org-for-client", {
        body: { client_id: client.id, share_llm: shareLlm, clone_carmen: cloneCarmen },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as OrgCreatedResult;
    },
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
      onCreated?.(data.tenant.id);
    },
    onError: (e: any) => {
      toast.error("שגיאה ביצירת הארגון: " + (e?.message || "אירעה שגיאה"));
    },
  });

  const ownerLabel = primaryContact?.email
    ? `${primaryContact.contact_name || ""}  (${primaryContact.email})`
    : "לא נמצא אימייל לאיש קשר ראשי";

  return (
    <InlineDialog
      open={open}
      onOpenChange={onOpenChange}
      inline={inline}
      title={
        <span className="flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          צור ארגון ללקוח
        </span>
      }
      description={`יוצר ארגון חדש עבור "${client?.name}" עם כל החיבורים, כרמן ואוטומציות`}
      footer={
        result ? (
          <Button variant="outline" onClick={() => onOpenChange(false)}>סגור</Button>
        ) : (
          <>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
              ביטול
            </Button>
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
              {mutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin ml-1" />יוצר...</>
              ) : (
                "צור ארגון"
              )}
            </Button>
          </>
        )
      }
    >
      {result ? (
        <ResultView result={result} />
      ) : (
        <div className="space-y-4">
          {/* Preview */}
          <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
            <p className="font-medium text-foreground">מה ישותף לארגון החדש:</p>
            <p className="text-muted-foreground">
              {preview?.integrations ?? "..."} חיבורים •{" "}
              {preview?.pages ?? "..."} עמודי רשת חברתית •{" "}
              {preview?.sites ?? "..."} אתרי WordPress
            </p>
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">Owner: </span>{ownerLabel}
            </p>
          </div>

          {/* Options */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="clone-carmen" className="flex flex-col gap-0.5">
                <span>צור כרמן ואוטומציות</span>
                <span className="text-xs text-muted-foreground font-normal">
                  משכפל את הסוכן, האוטומציות והמשפכים (מושבתים — ניתן להפעיל ידנית)
                </span>
              </Label>
              <Switch id="clone-carmen" checked={cloneCarmen} onCheckedChange={setCloneCarmen} />
            </div>

            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="share-llm" className="flex flex-col gap-0.5">
                <span>שתף מפתח AI (LLM)</span>
                <span className="text-xs text-muted-foreground font-normal">
                  הארגון החדש ישתמש במפתח ה-AI של הסוכנות שלך
                </span>
              </Label>
              <Switch id="share-llm" checked={shareLlm} onCheckedChange={setShareLlm} />
            </div>
          </div>
        </div>
      )}
    </InlineDialog>
  );
}

function ResultView({ result }: { result: OrgCreatedResult }) {
  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-start gap-2 text-green-600">
        <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
        <div>
          <p className="font-medium">הארגון נוצר בהצלחה</p>
          <p className="text-muted-foreground">{result.tenant.name}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label="חיבורים" value={result.shared.integrations} />
        <Stat label="עמודים" value={result.shared.pages} />
        <Stat label="אתרי WP" value={result.shared.sites} />
      </div>

      <p className="text-muted-foreground">
        {result.owner_status === "existing_user" && "Owner נוסף — משתמש קיים במערכת."}
        {result.owner_status === "invited" && `הזמנה נשלחה ל-${result.invited_email}.`}
        {result.owner_status === "no_email" && "לא נמצא אימייל לאיש קשר — יש להזמין owner ידנית."}
      </p>

      {result.warnings.length > 0 && (
        <div className="rounded-md border border-yellow-200 bg-yellow-50 p-2 space-y-1">
          <p className="flex items-center gap-1 font-medium text-yellow-700 text-xs">
            <AlertCircle className="h-3.5 w-3.5" />
            הערות
          </p>
          {result.warnings.map((w, i) => (
            <p key={i} className="text-xs text-yellow-700">{w}</p>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className={cn("rounded-md border p-2", value > 0 ? "bg-green-50 border-green-200" : "bg-muted/30")}>
      <p className="text-lg font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
