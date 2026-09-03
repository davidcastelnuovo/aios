import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { InlineDialog } from "@/components/ui/inline-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Building2, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  countSelection,
  defaultSelectionFromResources,
  loadShareableResourcesForClient,
  type CreateOrgShareSelection,
  type ShareableResource,
  type ShareableResourceKind,
} from "@/lib/createOrgSharing";

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
  copied_client_id?: string | null;
  shared: {
    integrations: number;
    pages: number;
    sites: number;
    tables: number;
    automations: number;
  };
  warnings: string[];
}

const SECTION_LABELS: Record<ShareableResourceKind, string> = {
  integration: "חיבורים",
  social_page: "עמודי רשת חברתית",
  wordpress_site: "אתרי WordPress",
  crm_table: "טבלאות דוחות",
  automation: "אוטומציות",
};

const SECTION_ORDER: ShareableResourceKind[] = [
  "integration",
  "social_page",
  "wordpress_site",
  "crm_table",
  "automation",
];

function emptySelection(): CreateOrgShareSelection {
  return {
    integration_ids: [],
    social_page_ids: [],
    wordpress_site_ids: [],
    crm_table_ids: [],
    automation_ids: [],
  };
}

function selectionKey(kind: ShareableResourceKind): keyof CreateOrgShareSelection {
  switch (kind) {
    case "integration": return "integration_ids";
    case "social_page": return "social_page_ids";
    case "wordpress_site": return "wordpress_site_ids";
    case "crm_table": return "crm_table_ids";
    case "automation": return "automation_ids";
  }
}

export function CreateOrgForClientDialog({
  open,
  onOpenChange,
  client,
  inline = false,
  onCreated,
}: CreateOrgForClientDialogProps) {
  const queryClient = useQueryClient();
  const [shareLlm, setShareLlm] = useState(false);
  const [cloneCarmen, setCloneCarmen] = useState(true);
  const [copyClientDetails, setCopyClientDetails] = useState(true);
  const [selection, setSelection] = useState<CreateOrgShareSelection>(emptySelection());
  const [result, setResult] = useState<OrgCreatedResult | null>(null);

  const { data: resources = [], isLoading: resourcesLoading } = useQuery({
    queryKey: ["create-org-resources", client?.id, client?.tenant_id],
    enabled: open && !!client?.id && !!client?.tenant_id,
    queryFn: async () => {
      if (!client?.id || !client?.tenant_id) return [];
      return loadShareableResourcesForClient(client.id, client.tenant_id);
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
    if (!open) {
      setResult(null);
      setShareLlm(false);
      setCloneCarmen(true);
      setCopyClientDetails(true);
      setSelection(emptySelection());
    }
  }, [open]);

  useEffect(() => {
    if (open && resources.length > 0) {
      setSelection(defaultSelectionFromResources(resources));
    }
  }, [open, resources]);

  const groupedResources = useMemo(() => {
    const groups = new Map<ShareableResourceKind, ShareableResource[]>();
    for (const kind of SECTION_ORDER) groups.set(kind, []);
    for (const resource of resources) {
      groups.get(resource.kind)?.push(resource);
    }
    return groups;
  }, [resources]);

  const selectedCount = countSelection(selection);

  const toggleResource = (resource: ShareableResource, checked: boolean) => {
    const key = selectionKey(resource.kind);
    setSelection((prev) => {
      const current = new Set(prev[key]);
      if (checked) current.add(resource.id);
      else current.delete(resource.id);
      return { ...prev, [key]: Array.from(current) };
    });
  };

  const toggleSection = (kind: ShareableResourceKind, checked: boolean) => {
    const key = selectionKey(kind);
    const ids = (groupedResources.get(kind) || []).map((r) => r.id);
    setSelection((prev) => ({ ...prev, [key]: checked ? ids : [] }));
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!client) throw new Error("missing client");
      const { data, error } = await supabase.functions.invoke("create-org-for-client", {
        body: {
          client_id: client.id,
          share_llm: shareLlm,
          clone_carmen: cloneCarmen,
          copy_client_details: copyClientDetails,
          share_integration_ids: selection.integration_ids,
          share_social_page_ids: selection.social_page_ids,
          share_wordpress_site_ids: selection.wordpress_site_ids,
          share_crm_table_ids: selection.crm_table_ids,
          share_automation_ids: selection.automation_ids,
        },
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
      description={`יוצר תת-ארגון עבור "${client?.name}" — בחר מה לשתף`}
      footer={
        result ? (
          <Button variant="outline" onClick={() => onOpenChange(false)}>סגור</Button>
        ) : (
          <>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
              ביטול
            </Button>
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || resourcesLoading}>
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
          <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
            <p className="font-medium text-foreground">סיכום</p>
            <p className="text-muted-foreground">
              {resourcesLoading
                ? "טוען משאבים..."
                : `${selectedCount} פריטים נבחרו לשיתוף`}
            </p>
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">Owner: </span>{ownerLabel}
            </p>
          </div>

          <ScrollArea className="h-[min(320px,45vh)] rounded-md border p-3">
            {resourcesLoading ? (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
                טוען חיבורים ומשאבים...
              </div>
            ) : resources.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                לא נמצאו משאבים לשיתוף — ניתן עדיין ליצור ארגון עם פרטי הלקוח בלבד.
              </p>
            ) : (
              <div className="space-y-4">
                {SECTION_ORDER.map((kind) => {
                  const items = groupedResources.get(kind) || [];
                  if (!items.length) return null;
                  const key = selectionKey(kind);
                  const selectedInSection = items.filter((item) => selection[key].includes(item.id)).length;
                  const allSelected = selectedInSection === items.length;

                  return (
                    <section key={kind} className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`section-${kind}`}
                            checked={allSelected}
                            onCheckedChange={(checked) => toggleSection(kind, checked === true)}
                          />
                          <Label htmlFor={`section-${kind}`} className="font-medium">
                            {SECTION_LABELS[kind]} ({selectedInSection}/{items.length})
                          </Label>
                        </div>
                      </div>
                      <div className="space-y-2 pr-6">
                        {items.map((item) => (
                          <label
                            key={item.id}
                            className={cn(
                              "flex items-start gap-2 rounded-md border p-2 cursor-pointer",
                              selection[key].includes(item.id) ? "border-primary/40 bg-primary/5" : "border-transparent",
                            )}
                          >
                            <Checkbox
                              checked={selection[key].includes(item.id)}
                              onCheckedChange={(checked) => toggleResource(item, checked === true)}
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{item.label}</p>
                              {item.subtitle && (
                                <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
                              )}
                              {item.clientRelated && (
                                <p className="text-[11px] text-primary mt-0.5">קשור ללקוח</p>
                              )}
                            </div>
                          </label>
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="copy-client" className="flex flex-col gap-0.5">
                <span>העתק פרטי לקוח</span>
                <span className="text-xs text-muted-foreground font-normal">
                  יוצר כרטיס לקוח בארגון החדש עם אנשי קשר ופרטי חיבור
                </span>
              </Label>
              <Switch id="copy-client" checked={copyClientDetails} onCheckedChange={setCopyClientDetails} />
            </div>

            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="clone-carmen" className="flex flex-col gap-0.5">
                <span>צור כרמן</span>
                <span className="text-xs text-muted-foreground font-normal">
                  משכפל את הסוכן (מושבת — ניתן להפעיל ידנית)
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
        <Stat label="טבלאות" value={result.shared.tables} />
        <Stat label="אוטומציות" value={result.shared.automations} />
      </div>

      <p className="text-muted-foreground">
        {result.owner_status === "existing_user" && "Owner נוסף — משתמש קיים במערכת."}
        {result.owner_status === "invited" && `הזמנה נשלחה ל-${result.invited_email}.`}
        {result.owner_status === "no_email" && "לא נמצא אימייל לאיש קשר — יש להזמין owner ידנית."}
        {result.copied_client_id && " כרטיס לקוח הועתק לארגון החדש."}
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
