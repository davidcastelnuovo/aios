import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { FormLabel } from "@/components/ui/form";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { toast } from "sonner";
import { 
  Upload, 
  Trash2, 
  Download, 
  FileText, 
  FileImage, 
  File,
  Loader2
} from "lucide-react";

export interface Attachment {
  name: string;
  path: string;
  size: number;
  type: string;
  uploaded_at: string;
}

interface AttachmentsFieldProps {
  attachments: Attachment[];
  onChange: (attachments: Attachment[]) => void;
  entityType: "lead" | "client";
  entityId: string;
  readOnly?: boolean;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function getFileIcon(type: string) {
  if (type.startsWith("image/")) {
    return <FileImage className="h-4 w-4 text-blue-500" />;
  }
  if (type.includes("pdf")) {
    return <FileText className="h-4 w-4 text-red-500" />;
  }
  return <File className="h-4 w-4 text-muted-foreground" />;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentsField({ 
  attachments, 
  onChange, 
  entityType, 
  entityId,
  readOnly = false 
}: AttachmentsFieldProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { tenantId } = useCurrentTenant();

  const handleUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0 || !tenantId || !entityId) return;

    setIsUploading(true);
    const newAttachments: Attachment[] = [];

    try {
      for (const file of Array.from(files)) {
        if (file.size > MAX_FILE_SIZE) {
          toast.error(`הקובץ ${file.name} גדול מדי (מקסימום 10MB)`);
          continue;
        }

        const filePath = `${tenantId}/${entityType}/${entityId}/${Date.now()}_${file.name}`;
        
        const { error } = await supabase.storage
          .from("entity-attachments")
          .upload(filePath, file);

        if (error) {
          console.error("Upload error:", error);
          toast.error(`שגיאה בהעלאת ${file.name}`);
          continue;
        }

        newAttachments.push({
          name: file.name,
          path: filePath,
          size: file.size,
          type: file.type,
          uploaded_at: new Date().toISOString(),
        });
      }

      if (newAttachments.length > 0) {
        onChange([...attachments, ...newAttachments]);
        toast.success(`${newAttachments.length} קבצים הועלו בהצלחה`);
      }
    } catch (err) {
      console.error("Upload failed:", err);
      toast.error("שגיאה בהעלאת קבצים");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }, [attachments, entityId, entityType, onChange, tenantId]);

  const handleDelete = async (index: number) => {
    const attachment = attachments[index];
    
    try {
      const { error } = await supabase.storage
        .from("entity-attachments")
        .remove([attachment.path]);

      if (error) {
        console.error("Delete error:", error);
        toast.error("שגיאה במחיקת הקובץ");
        return;
      }

      onChange(attachments.filter((_, i) => i !== index));
      toast.success("הקובץ נמחק");
    } catch (err) {
      console.error("Delete failed:", err);
      toast.error("שגיאה במחיקת הקובץ");
    }
  };

  const handleDownload = async (attachment: Attachment) => {
    try {
      const { data, error } = await supabase.storage
        .from("entity-attachments")
        .createSignedUrl(attachment.path, 60);

      if (error || !data?.signedUrl) {
        toast.error("שגיאה בהורדת הקובץ");
        return;
      }

      window.open(data.signedUrl, "_blank");
    } catch (err) {
      console.error("Download failed:", err);
      toast.error("שגיאה בהורדת הקובץ");
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleUpload(e.dataTransfer.files);
  };

  return (
    <div className="space-y-3">
      <FormLabel className="text-sm font-medium">קבצים מצורפים</FormLabel>
      
      {/* Existing attachments */}
      {attachments.length > 0 && (
        <div className="space-y-2">
          {attachments.map((attachment, index) => (
            <div 
              key={index} 
              className="flex items-center gap-2 p-2 rounded-lg border bg-muted/30"
            >
              {getFileIcon(attachment.type)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{attachment.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(attachment.size)}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handleDownload(attachment)}
                >
                  <Download className="h-4 w-4" />
                </Button>
                {!readOnly && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:bg-destructive/10"
                    onClick={() => handleDelete(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Upload area */}
      {!readOnly && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer
            ${isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/50"}
          `}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
          />
          {isUploading ? (
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>מעלה קבצים...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1 text-muted-foreground">
              <Upload className="h-6 w-6" />
              <span className="text-sm">גרור קבצים או לחץ להעלאה</span>
              <span className="text-xs">מקסימום 10MB לקובץ</span>
            </div>
          )}
        </div>
      )}
      
      {attachments.length === 0 && readOnly && (
        <p className="text-sm text-muted-foreground">אין קבצים מצורפים</p>
      )}
    </div>
  );
}
