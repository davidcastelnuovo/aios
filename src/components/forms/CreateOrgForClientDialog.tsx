import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { InlineDialog } from "@/components/ui/inline-dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Building2, CheckCircle2, AlertCircle, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface CreateOrgForClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inline?: boolean;
  client: {
    id: string;
    name: string;
    contact_name?: string | null;
    email?: string | null;
    tenant_id?: string | null;
  };
  onSuccess?: () => void;
}

interface CreateOrgResult {
  success: boolean;
  tenant: { id: string; name: string; slug: string };
  owner_status: "existing_user" | "invited" | "no_email";
  invited_email?: string;
  shared: { integrations: number; pages: number; sites: number };
  cloned: Array<{ type: string; name?: string; id: string; skipped?: boolean }>;
  warnings: string[];
}

export function CreateOrgForClientDialog({
  open,
  onOpenChange,
  inline = false,
  client,
  onSuccess,
}: CreateOrgForClientDialogProps) {
  const [shareLLM, setShareLLM] = useState(false);
  const [cloneCarmen, setCloneCarmen] = useState(true);
  const [result, setResult] = useState<CreateOrgResult | null>(null);

  // Preview: count what will be shared
  const { data: preview, isLoading: previewLoading } = useQuery({
    queryKey: ["create-org-preview", client.id, client.tenant_id],
    queryFn: async () => {
      if (!client.tenant_id) return { integrations: 0, pages: 0, sites: 0, ownerEmail: null };

      const [integ, pages, sites, contact] = await Promise.all([
        supabase
          .from("tenant_integrations")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", client.tenant_id)
          .eq("is_active", true),
        supabase
          .from("social_pages")
          .select("id", { count: "exact", head: true })
          .eq("client_id", client.id),
        supabase
          .from("social_media_wordpress_sites")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", client.tenant_id),
        supabase
          .from("client_contacts")
          .select("email, contact_name")
          .eq("client_id", client.id)
          .eq("is_primary", true)
          .limit(1),
      ]);

      return {
        integrations: integ.count ?? 0,
        pages: pages.count ?? 0,
        sites: sites.count ?? 0,
        ownerEmail: contact.data?.[0]?.email ?? client.email ?? null,
        ownerName: contact.data?.[0]?.contact_name ?? client.contact_name ?? client.name,
      };
    },
    enabled: open && !!client.tenant_id,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) throw new Error("לא מחובר");

      const supabaseUrl = (supabase as any).supabaseUrl as string;
      const res = await fetch(`${supabaseUrl}/functions/v1/create-org-for-client`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          client_id: client.id,
          share_llm: shareLLM,
          clone_carmen: cloneCarmen,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "שגיאה ביצירת הארגון");
      return data as CreateOrgResult;
    },
    onSuccess: (data) => {
      setResult(data);
      toast.success(`ארגון "${data.tenant.name}" נוצר בהצלחה`);
      onSuccess?.();
    },
    onError: (err: Error) => {
      toast.error("שגיאה: " + err.message);
    },
  });

  const handleCreate = () => mutation.mutate();
  const handleClose = () => {
    setResult(null);
    onOpenChange(false);
  };

  const ownerStatusLabel = (status?: string) => {
    if (status === "existing_user") return "משתמש קיים הצורף לארגון";
    if (status === "invited") return "הזמנה נשלחה";
    return "אין אימייל — הוסף בעלים ידנית";
  };

  const footer = result ? (
    <Button onClick={handleClose}>סגור</Button>
  ) : (
    <>
      <Button variant="outline" onClick={handleClose} disabled={mutation.isPending}>
        ביטול
      </Button>
      <Button onClick={handleCreate} disabled={mutation.isPending || previewLoading} className="gap-2">
        {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        <Building2 className="h-4 w-4" />
        צור ארגון
      </Button>
    </>
  );

  return (
    <InlineDialog
      open={open}
      onOpenChange={handleClose}
      inline={inline}
      title={result ? `ארגון "${result.tenant.name}" נוצר` : `צור ארגון עבור ${client.name}`}
      description={
        result
          ? undefined
          : "יצירת tenant חדש מהלקוח הזה — עם בעלים, חיבורים משותפים, וכרמן מוכנה."
      }
      footer={footer}
      className="max-w-lg"
    >
      {result ? (
        // ── Success summary ──────────────────────────────────────────────
        <div className="space-y-3 text-sm" dir="rtl">
          <div className="flex items-center gap-2 text-green-600 font-medium">
            <CheckCircle2 className="h-4 w-4" />
            הארגון נוצר בהצלחה
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
            <span>בעלים:</span>
            <span className="font-medium text-foreground">{ownerStatusLabel(result.owner_status)}</span>
            {result.invited_email && (
              <>
                <span>הזמנה ל:</span>
                <span className="font-medium text-foreground">{result.invited_email}</span>
              </>
            )}
            <span>אינטגרציות שותפו:</span>
            <span className="font-medium text-foreground">{result.shared.integrations}</span>
            <span>עמודי רשת שותפו:</span>
            <span className="font-medium text-foreground">{result.shared.pages}</span>
            <span>אתרי WordPress שותפו:</span>
            <span className="font-medium text-foreground">{result.shared.sites}</span>
          </div>

          {result.cloned.length > 0 && (
            <div>
              <p className="text-muted-foreground mb-1">כרמן ואוטומציות (מושבתות):</p>
              <div className="flex flex-wrap gap-1">
                {result.cloned.map((c, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {c.type === "agent" ? "🤖 כרמן" : c.type === "automation" ? `⚡ ${c.name}` : `📋 ${c.name}`}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {result.warnings.length > 0 && (
            <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3 space-y-1">
              <div className="flex items-center gap-1 text-yellow-700 font-medium text-xs">
                <AlertCircle className="h-3.5 w-3.5" />
                אזהרות ({result.warnings.length})
              </div>
              {result.warnings.map((w, i) => (
                <p key={i} className="text-xs text-yellow-700">{w}</p>
              ))}
            </div>
          )}
        </div>
      ) : (
        // ── Configuration form ────────────────────────────────────────────
        <div className="space-y-4 text-sm" dir="rtl">
          {/* Owner preview */}
          {previewLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              טוען פרטים...
            </div>
          ) : (
            <div className="rounded-md border bg-muted/40 p-3 space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">בעלים</p>
              <p className="font-medium">{preview?.ownerName ?? client.name}</p>
              {preview?.ownerEmail ? (
                <p className="text-muted-foreground text-xs">{preview.ownerEmail} — תישלח הזמנה</p>
              ) : (
                <p className="text-yellow-600 text-xs">אין אימייל — הבעלים יצורף ידנית</p>
              )}
            </div>
          )}

          {/* What will be shared */}
          {!previewLoading && preview && (
            <div className="rounded-md border bg-muted/40 p-3 space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">יישותף</p>
              <div className="grid grid-cols-3 gap-2 text-center mt-2">
                <div>
                  <p className="text-lg font-bold">{preview.integrations}</p>
                  <p className="text-xs text-muted-foreground">חיבורים</p>
                </div>
                <div>
                  <p className="text-lg font-bold">{preview.pages}</p>
                  <p className="text-xs text-muted-foreground">עמודים</p>
                </div>
                <div>
                  <p className="text-lg font-bold">{preview.sites}</p>
                  <p className="text-xs text-muted-foreground">אתרי WP</p>
                </div>
              </div>
            </div>
          )}

          {/* Options */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="clone-carmen" className="flex flex-col gap-0.5">
                <span>שכפל כרמן ואוטומציות</span>
                <span className="text-xs text-muted-foreground font-normal">
                  מושבתות — יש להפעיל ידנית
                </span>
              </Label>
              <Switch
                id="clone-carmen"
                checked={cloneCarmen}
                onCheckedChange={setCloneCarmen}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="share-llm" className="flex flex-col gap-0.5">
                <span>שתף חיבור LLM</span>
                <span className="text-xs text-muted-foreground font-normal">
                  שיתוף מפתח OpenAI / ספק AI עם הארגון החדש
                </span>
              </Label>
              <Switch
                id="share-llm"
                checked={shareLLM}
                onCheckedChange={setShareLLM}
              />
            </div>
          </div>
        </div>
      )}
    </InlineDialog>
  );
}
