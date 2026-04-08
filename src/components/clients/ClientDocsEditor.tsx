import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FolderLinksField } from "@/components/forms/FolderLinksField";
import { AttachmentsField } from "@/components/forms/AttachmentsField";
import { ClientLinkedFiles } from "@/components/clients/ClientLinkedFiles";
import { useFolderLinksAndAttachments } from "@/hooks/useFolderLinksAndAttachments";
import { FileText, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ClientDocsEditorProps {
  client: any;
  tenantId: string;
}

export function ClientDocsEditor({ client, tenantId }: ClientDocsEditorProps) {
  const queryClient = useQueryClient();
  const { folderLinks, setFolderLinks, attachments, setAttachments } = useFolderLinksAndAttachments(client);

  const handleFolderLinksChange = async (newLinks: any[]) => {
    setFolderLinks(newLinks);
    const { error } = await supabase
      .from("clients")
      .update({ folder_links: newLinks as any })
      .eq("id", client.id);
    if (error) {
      toast.error("שגיאה בעדכון קישורים");
    } else {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    }
  };

  const handleAttachmentsChange = async (newAttachments: any[]) => {
    setAttachments(newAttachments);
    const { error } = await supabase
      .from("clients")
      .update({ attachments: newAttachments as any })
      .eq("id", client.id);
    if (error) {
      toast.error("שגיאה בעדכון קבצים");
    } else {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} הועתק`);
  };

  const hasAdAccounts = client.meta_ads_account_id || client.google_ads_account_id;

  return (
    <div className="space-y-6">
      {hasAdAccounts && (
        <div className="space-y-2">
          <h3 className="font-semibold text-sm flex items-center gap-2 justify-end">
            חשבונות פרסום
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {client.meta_ads_account_id && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg border bg-muted/30 text-sm" dir="rtl">
                <span className="text-muted-foreground text-xs whitespace-nowrap">Meta Ads:</span>
                <span className="font-mono truncate flex-1">{client.meta_ads_account_id}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={() => copyToClipboard(client.meta_ads_account_id, "מזהה Meta Ads")}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
            {client.google_ads_account_id && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg border bg-muted/30 text-sm" dir="rtl">
                <span className="text-muted-foreground text-xs whitespace-nowrap">Google Ads:</span>
                <span className="font-mono truncate flex-1">{client.google_ads_account_id}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={() => copyToClipboard(client.google_ads_account_id, "מזהה Google Ads")}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
      <FolderLinksField links={folderLinks} onChange={handleFolderLinksChange} />
      <AttachmentsField
        attachments={attachments}
        onChange={handleAttachmentsChange}
        entityType="client"
        entityId={client.id}
      />
      <div className="space-y-2">
        <h3 className="font-semibold text-sm flex items-center gap-2 justify-end">
          קבצים משויכים מצ׳אט
          <FileText className="h-4 w-4 text-primary" />
        </h3>
        <ClientLinkedFiles clientId={client.id} tenantId={tenantId} />
      </div>
    </div>
  );
}