import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useSignatureDocumentUrl } from "@/hooks/useSignatureDocumentUrl";
import { SignatureDocumentViewer } from "./SignatureDocumentViewer";
import { SignaturePageNavigation } from "./SignaturePageNavigation";
import { detectMediaKind } from "./signatureDocumentMedia";

interface Signer {
  id: string;
  name: string;
  email: string;
  status: string;
  signed_at?: string | null;
}

interface SignedDoc {
  id: string;
  title: string;
  content?: string | null;
  file_url?: string | null;
  signed_file_url?: string | null;
  lead_id?: string | null;
  client_id?: string | null;
  tenant_id?: string;
}

function FilePreview({
  label,
  path,
  forcePdf,
}: {
  label: string;
  path: string;
  forcePdf?: boolean;
}) {
  const { resolvedUrl, loading, error } = useSignatureDocumentUrl(path);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const kind = forcePdf ? "pdf" : detectMediaKind(path);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{label}</p>
        {resolvedUrl && (
          <a href={resolvedUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
            <Download className="h-4 w-4" />
            פתח
          </a>
        )}
      </div>
      {loading && <p className="text-sm text-muted-foreground">טוען את הקובץ...</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {resolvedUrl && kind !== "other" && (
        <>
          <SignaturePageNavigation page={page} count={pages} onChange={setPage} />
          <SignatureDocumentViewer
            fileUrl={resolvedUrl}
            mediaKind={kind}
            forcePdf={forcePdf || kind === "pdf"}
            page={page}
            onNumPagesChange={setPages}
            className="bg-white"
          />
        </>
      )}
      {resolvedUrl && kind === "other" && (
        <a href={resolvedUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">
          {label}
        </a>
      )}
    </div>
  );
}

function AssociateSignature({
  doc,
  tenantId,
}: {
  doc: SignedDoc;
  tenantId?: string;
}) {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const linked = !!(doc.lead_id || doc.client_id);

  const { data: linkedName } = useQuery({
    queryKey: ["signature-linked-name", doc.lead_id, doc.client_id],
    queryFn: async () => {
      if (doc.lead_id) {
        const { data, error } = await supabase.from("leads").select("contact_name, company_name").eq("id", doc.lead_id).maybeSingle();
        if (error) throw error;
        return data?.contact_name || data?.company_name || "ליד";
      }
      if (doc.client_id) {
        const { data, error } = await supabase.from("clients").select("name").eq("id", doc.client_id).maybeSingle();
        if (error) throw error;
        return data?.name || "לקוח";
      }
      return null;
    },
    enabled: linked,
  });

  const term = query.trim();
  const { data: matches = [], isFetching } = useQuery({
    queryKey: ["signature-associate", tenantId, term],
    queryFn: async () => {
      if (!tenantId) return [];
      const safe = term.replace(/[%_,]/g, "");
      const [leads, clients] = await Promise.all([
        supabase.from("leads").select("id, contact_name, company_name").eq("tenant_id", tenantId).is("archived_at", null).or(`contact_name.ilike.%${safe}%,company_name.ilike.%${safe}%`).limit(6),
        supabase.from("clients").select("id, name").eq("tenant_id", tenantId).ilike("name", `%${safe}%`).limit(6),
      ]);
      if (leads.error) throw leads.error;
      if (clients.error) throw clients.error;
      return [
        ...(leads.data ?? []).map((lead) => ({
          kind: "lead" as const,
          id: lead.id,
          label: lead.contact_name || lead.company_name || "ליד",
        })),
        ...(clients.data ?? []).map((client) => ({
          kind: "client" as const,
          id: client.id,
          label: client.name || "לקוח",
        })),
      ];
    },
    enabled: !!tenantId && !linked && term.length >= 2,
  });

  const link = useMutation({
    mutationFn: async (target: { kind: "lead" | "client"; id: string }) => {
      const patch = target.kind === "lead"
        ? { lead_id: target.id, client_id: null }
        : { client_id: target.id, lead_id: null };
      const { error } = await supabase.from("signature_documents").update(patch).eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("המסמך שויך");
      queryClient.invalidateQueries({ queryKey: ["signature-documents", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["signature-document", doc.id] });
      setQuery("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (linked) {
    return <p className="text-sm">משויך אל {linkedName || "..."}</p>;
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">המסמך לא משויך</p>
      <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="חפש ליד או לקוח לשיוך" />
      {isFetching && <p className="text-xs text-muted-foreground">מחפש...</p>}
      <div className="space-y-1">
        {matches.map((match) => (
          <Button
            key={`${match.kind}-${match.id}`}
            type="button"
            variant="outline"
            className="w-full justify-between"
            disabled={link.isPending}
            onClick={() => link.mutate(match)}
          >
            <span>{match.label}</span>
            <Badge variant="secondary">{match.kind === "lead" ? "ליד" : "לקוח"}</Badge>
          </Button>
        ))}
      </div>
    </div>
  );
}

export function SignedSignatureReview({
  doc,
  signers,
  tenantId,
}: {
  doc: SignedDoc;
  signers: Signer[];
  tenantId?: string;
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-sm font-medium">מי חתם</p>
        {signers.length === 0 ? (
          <p className="text-sm text-muted-foreground">אין חותמים</p>
        ) : (
          <div className="space-y-2">
            {signers.map((signer) => (
              <div key={signer.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">{signer.name}</p>
                  <p className="text-xs text-muted-foreground">{signer.email}</p>
                  {signer.signed_at && (
                    <p className="text-xs text-muted-foreground">{format(new Date(signer.signed_at), "dd/MM/yyyy HH:mm")}</p>
                  )}
                </div>
                <Badge className={signer.status === "signed" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}>
                  {signer.status === "signed" ? "חתם" : signer.status === "declined" ? "סירב" : "ממתין"}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      <AssociateSignature doc={doc} tenantId={tenantId} />

      <div className="space-y-2">
        <p className="text-sm font-medium">הקובץ החתום</p>
        {doc.signed_file_url ? (
          <FilePreview label="מסמך חתום" path={doc.signed_file_url} forcePdf />
        ) : (
          <p className="text-sm text-muted-foreground">הקובץ החתום עדיין נוצר. הרשימה תתעדכן בעוד רגע.</p>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">המסמך המקורי</p>
        {doc.file_url ? (
          <FilePreview label="מסמך מקורי" path={doc.file_url} />
        ) : doc.content ? (
          <div className="whitespace-pre-wrap text-sm bg-muted/50 p-4 rounded-lg max-h-60 overflow-y-auto">{doc.content}</div>
        ) : (
          <p className="text-sm text-muted-foreground">אין מסמך מקורי</p>
        )}
      </div>
    </div>
  );
}
