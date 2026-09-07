import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantPath } from "@/hooks/useTenantPath";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Copy, ExternalLink, FileSignature, Plus, Send } from "lucide-react";
import { splitContactName } from "@/components/signatures/signatureContactUtils";

interface LeadContact {
  id: string;
  contact_name?: string | null;
  company_name?: string | null;
  email?: string | null;
  phone?: string | null;
}

interface SendSignatureFromLeadPanelProps {
  lead: LeadContact;
  tenantId: string | undefined;
}

export function SendSignatureFromLeadPanel({ lead, tenantId }: SendSignatureFromLeadPanelProps) {
  const { buildPath } = useTenantPath();
  const [templateId, setTemplateId] = useState("");
  const [documentTitle, setDocumentTitle] = useState("");
  const [lastLinks, setLastLinks] = useState<Array<{ name: string; email: string; url: string }>>([]);

  const recipientName = lead.contact_name || lead.company_name || "";
  const recipientEmail = lead.email || "";
  const { firstName, lastName } = splitContactName(recipientName);

  const { data: templates = [], isLoading: loadingTemplates } = useQuery({
    queryKey: ["signature-templates", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("signature_documents")
        .select("id, title, template_name, document_type, created_at")
        .eq("tenant_id", tenantId!)
        .eq("is_template", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!templateId) throw new Error("בחר תבנית");
      if (!recipientEmail) throw new Error("לליד חסר אימייל");

      const { data, error } = await supabase.functions.invoke("send-signature-from-template", {
        body: {
          templateDocumentId: templateId,
          recipientName,
          recipientEmail,
          documentTitle: documentTitle.trim() || undefined,
          baseUrl: window.location.origin,
          contactDetails: {
            firstName,
            lastName: lastName || lead.company_name || undefined,
            phone: lead.phone || undefined,
          },
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      setLastLinks(data?.signingLinks || []);
      toast.success("המסמך נשלח לחתימה");
      if (data?.partial) toast.warning("חלק מהמיילים לא נשלחו");
    },
    onError: (err: Error) => toast.error(err.message || "שגיאה בשליחה"),
  });

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("הקישור הועתק");
  };

  return (
    <Card dir="rtl">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileSignature className="h-4 w-4" />
          שליחת מסמך לחתימה דיגיטלית
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
          <p><span className="text-muted-foreground">חותם:</span> {recipientName || "—"}</p>
          <p dir="ltr" className="text-left"><span className="text-muted-foreground" dir="rtl">אימייל:</span> {recipientEmail || "—"}</p>
          {lead.phone && <p><span className="text-muted-foreground">טלפון:</span> {lead.phone}</p>}
        </div>

        {!recipientEmail && (
          <p className="text-sm text-destructive">יש להוסיף אימייל לליד לפני שליחת מסמך לחתימה.</p>
        )}

        <div className="space-y-2">
          <Label>תבנית חתימה</Label>
          <Select value={templateId} onValueChange={setTemplateId} disabled={loadingTemplates}>
            <SelectTrigger>
              <SelectValue placeholder={loadingTemplates ? "טוען תבניות..." : "בחר תבנית..."} />
            </SelectTrigger>
            <SelectContent>
              {templates.length === 0 ? (
                <SelectItem value="__none" disabled>אין תבניות עדיין</SelectItem>
              ) : (
                templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.template_name || t.title}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>שם המסמך (אופציונלי)</Label>
          <Input
            value={documentTitle}
            onChange={(e) => setDocumentTitle(e.target.value)}
            placeholder={lead.company_name ? `חוזה - ${lead.company_name}` : "שם המסמך לשליחה..."}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => sendMutation.mutate()}
            disabled={!templateId || !recipientEmail || sendMutation.isPending}
          >
            <Send className="h-4 w-4 ml-2" />
            {sendMutation.isPending ? "שולח..." : "שלח לחתימה"}
          </Button>
          <Button variant="outline" asChild>
            <Link to={buildPath("signatures")}>
              <Plus className="h-4 w-4 ml-2" />
              צור תבנית חדשה
            </Link>
          </Button>
        </div>

        {lastLinks.length > 0 && (
          <div className="rounded-lg border p-3 space-y-2">
            <p className="text-sm font-medium">קישור לחתימה</p>
            {lastLinks.map((link) => (
              <div key={link.url} className="flex items-center gap-2 text-sm">
                <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate flex-1" dir="ltr">
                  {link.url}
                </a>
                <Button variant="ghost" size="icon" onClick={() => copyLink(link.url)}>
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" asChild>
                  <a href={link.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
