import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Image as ImageIcon, File, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { he } from "date-fns/locale";

interface ClientLinkedFilesProps {
  clientId?: string;
  leadId?: string;
  tenantId: string;
}

export function ClientLinkedFiles({ clientId, leadId, tenantId }: ClientLinkedFilesProps) {
  const { data: files = [] } = useQuery({
    queryKey: ["linked-files", clientId, leadId, tenantId],
    queryFn: async () => {
      let q = supabase.from("team_chat_files").select("*").eq("tenant_id", tenantId);
      if (clientId) q = q.eq("client_id", clientId);
      if (leadId) q = q.eq("lead_id", leadId);
      const { data } = await q.order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId && !!(clientId || leadId),
  });

  if (files.length === 0) {
    return (
      <div className="text-center py-6 text-sm text-muted-foreground">
        אין קבצים משויכים
      </div>
    );
  }

  const getIcon = (type: string) => {
    if (type === "image") return <ImageIcon className="h-4 w-4 text-blue-500" />;
    if (type === "link") return <ExternalLink className="h-4 w-4 text-green-500" />;
    return <FileText className="h-4 w-4 text-orange-500" />;
  };

  return (
    <div className="space-y-1.5">
      {files.map((file: any) => (
        <a
          key={file.id}
          href={file.file_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 p-2 rounded-lg border hover:bg-muted/50 transition-colors"
        >
          {getIcon(file.file_type)}
          <div className="flex-1 min-w-0">
            <p className="text-sm truncate">{file.file_name}</p>
            <p className="text-[10px] text-muted-foreground">
              {format(new Date(file.created_at), "d MMM yyyy HH:mm", { locale: he })}
              {file.file_size && ` · ${(file.file_size / 1024).toFixed(0)}KB`}
            </p>
          </div>
          <File className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </a>
      ))}
    </div>
  );
}
