import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FolderLinksField } from "@/components/forms/FolderLinksField";
import { AttachmentsField } from "@/components/forms/AttachmentsField";
import { ClientLinkedFiles } from "@/components/clients/ClientLinkedFiles";
import { useFolderLinksAndAttachments } from "@/hooks/useFolderLinksAndAttachments";
import { FileText } from "lucide-react";

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

  return (
    <div className="space-y-6">
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
