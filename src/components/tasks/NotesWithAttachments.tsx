import { useState, useRef, useCallback } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { toast } from "sonner";
import { Paperclip, X, Loader2, FileText, Image as ImageIcon } from "lucide-react";

export interface TaskAttachment {
  name: string;
  path: string;
  type: string;
  size?: number;
  uploaded_at?: string;
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  attachments: TaskAttachment[];
  onAttachmentsChange: (a: TaskAttachment[]) => void;
  taskId?: string;
  placeholder?: string;
  rows?: number;
}

const MAX = 10 * 1024 * 1024;

function sanitize(name: string) {
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 ? name.slice(dot).toLowerCase() : "";
  const base = (dot > 0 ? name.slice(0, dot) : name)
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 50);
  return (base || "file") + ext;
}

export function NotesWithAttachments({
  value,
  onChange,
  attachments,
  onAttachmentsChange,
  taskId,
  placeholder = "הערות נוספות...",
  rows = 3,
}: Props) {
  const { tenantId } = useCurrentTenant();
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [signed, setSigned] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = useCallback(
    async (files: FileList | File[] | null) => {
      if (!files || !tenantId) return;
      const arr = Array.from(files);
      if (!arr.length) return;
      setUploading(true);
      const added: TaskAttachment[] = [];
      try {
        for (const file of arr) {
          if (file.size > MAX) {
            toast.error(`${file.name} גדול מדי (עד 10MB)`);
            continue;
          }
          const safe = sanitize(file.name);
          const path = `${tenantId}/${taskId || "draft"}/${Date.now()}_${safe}`;
          const { error } = await supabase.storage
            .from("task-attachments")
            .upload(path, file, { contentType: file.type });
          if (error) {
            console.error(error);
            toast.error(`שגיאה בהעלאת ${file.name}`);
            continue;
          }
          added.push({
            name: file.name,
            path,
            type: file.type,
            size: file.size,
            uploaded_at: new Date().toISOString(),
          });
        }
        if (added.length) {
          onAttachmentsChange([...attachments, ...added]);
          toast.success(`${added.length} קבצים צורפו`);
        }
      } finally {
        setUploading(false);
        if (fileRef.current) fileRef.current.value = "";
      }
    },
    [attachments, onAttachmentsChange, taskId, tenantId]
  );

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (const it of Array.from(items)) {
      if (it.kind === "file") {
        const f = it.getAsFile();
        if (f) files.push(f);
      }
    }
    if (files.length) {
      e.preventDefault();
      upload(files);
    }
  };

  const remove = async (i: number) => {
    const a = attachments[i];
    if (a.path) {
      await supabase.storage.from("task-attachments").remove([a.path]);
    }
    onAttachmentsChange(attachments.filter((_, idx) => idx !== i));
  };

  const open = async (a: TaskAttachment) => {
    if (signed[a.path]) {
      window.open(signed[a.path], "_blank");
      return;
    }
    const { data } = await supabase.storage
      .from("task-attachments")
      .createSignedUrl(a.path, 3600);
    if (data?.signedUrl) {
      setSigned((s) => ({ ...s, [a.path]: data.signedUrl }));
      window.open(data.signedUrl, "_blank");
    }
  };

  const getThumb = async (a: TaskAttachment) => {
    if (signed[a.path]) return;
    const { data } = await supabase.storage
      .from("task-attachments")
      .createSignedUrl(a.path, 3600);
    if (data?.signedUrl) setSigned((s) => ({ ...s, [a.path]: data.signedUrl }));
  };

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          upload(e.dataTransfer.files);
        }}
        className={`relative rounded-md border ${
          dragOver ? "border-primary bg-primary/5" : "border-input"
        }`}
      >
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onPaste={handlePaste}
          placeholder={placeholder}
          rows={rows}
          className="border-0 focus-visible:ring-0 resize-none"
        />
        <div className="flex items-center justify-between px-2 py-1 border-t bg-muted/30">
          <span className="text-xs text-muted-foreground">
            הדבק (Ctrl+V), גרור או לחץ לצירוף
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Paperclip className="h-4 w-4" />
            )}
            צרף קובץ
          </Button>
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => upload(e.target.files)}
          />
        </div>
      </div>

      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((a, i) => {
            const isImg = a.type?.startsWith("image/");
            if (isImg && !signed[a.path]) getThumb(a);
            return (
              <div
                key={i}
                className="group relative rounded-md border bg-muted/30 overflow-hidden"
              >
                {isImg && signed[a.path] ? (
                  <img
                    src={signed[a.path]}
                    alt={a.name}
                    className="h-20 w-20 object-cover cursor-pointer"
                    onClick={() => open(a)}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => open(a)}
                    className="flex flex-col items-center justify-center h-20 w-20 px-1 text-xs gap-1"
                  >
                    {isImg ? (
                      <ImageIcon className="h-6 w-6 text-muted-foreground" />
                    ) : (
                      <FileText className="h-6 w-6 text-muted-foreground" />
                    )}
                    <span className="truncate w-full text-center">{a.name}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="absolute top-0.5 right-0.5 bg-background/80 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
