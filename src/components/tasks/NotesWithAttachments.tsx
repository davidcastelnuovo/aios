import { useState, useRef, useCallback, useEffect, type ReactNode } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { toast } from "sonner";
import { Paperclip, X, Loader2, FileText, Image as ImageIcon, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { claimClipboardPaste, filesFromClipboardData, isClipboardTypingTarget } from "@/lib/clipboardFiles";

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
  /** stacked = notes with attach bar; notes = notes cube only; files = files cube only; cubes = notes + files side by side */
  variant?: "stacked" | "cubes" | "notes" | "files";
  notesTitle?: string;
  notesFooter?: ReactNode;
  thumbSize?: "sm" | "lg";
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

function formatSize(size?: number) {
  if (!size) return "";
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function NotesWithAttachments({
  value,
  onChange,
  attachments,
  onAttachmentsChange,
  taskId,
  placeholder = "הוסף הערות למשימה...",
  rows = 5,
  variant = "stacked",
  notesTitle = "הערות",
  notesFooter,
  thumbSize = "sm",
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

  const takeClipboardFiles = useCallback(
    (clipboardData: DataTransfer | null | undefined, preventDefault: () => void) => {
      const files = filesFromClipboardData(clipboardData ?? null);
      if (!files.length) return false;
      if (!claimClipboardPaste()) return true;
      preventDefault();
      void upload(files);
      return true;
    },
    [upload],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      takeClipboardFiles(e.clipboardData, () => e.preventDefault());
    },
    [takeClipboardFiles],
  );

  const listenForPagePaste = variant === "files" || variant === "cubes" || variant === "stacked";
  useEffect(() => {
    if (!listenForPagePaste) return;
    const onPaste = (event: ClipboardEvent) => {
      const files = filesFromClipboardData(event.clipboardData);
      if (!files.length) return;
      const hasImage = files.some((file) => file.type.startsWith("image/"));
      if (isClipboardTypingTarget(event.target) && !hasImage) return;
      takeClipboardFiles(event.clipboardData, () => event.preventDefault());
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [listenForPagePaste, takeClipboardFiles]);

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

  const fileInput = (
    <input
      ref={fileRef}
      type="file"
      multiple
      className="hidden"
      onChange={(e) => upload(e.target.files)}
    />
  );

  const largeThumbs = thumbSize === "lg";
  const thumbs = (
    <div className={cn("flex flex-wrap gap-2", largeThumbs && "gap-3")}>
      {attachments.map((a, i) => {
        const isImg = a.type?.startsWith("image/");
        if (isImg && !signed[a.path]) void getThumb(a);
        return (
          <div
            key={`${a.path}-${i}`}
            className="group relative rounded-lg border bg-card overflow-hidden"
          >
            {isImg && signed[a.path] ? (
              <button type="button" onClick={() => open(a)} className="block">
                <img
                  src={signed[a.path]}
                  alt={a.name}
                  className={cn("object-cover", largeThumbs ? "h-36 w-36" : "h-20 w-20")}
                />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => open(a)}
                className={cn(
                  "flex flex-col items-start justify-center px-2 py-2 text-xs gap-1 text-right",
                  largeThumbs ? "min-h-[9rem] w-[10.5rem]" : "min-h-[5rem] w-[8.5rem]",
                )}
              >
                {isImg ? (
                  <ImageIcon className={cn(largeThumbs ? "h-8 w-8" : "h-6 w-6", "text-muted-foreground")} />
                ) : (
                  <FileText className={cn(largeThumbs ? "h-8 w-8" : "h-6 w-6", "text-red-500")} />
                )}
                <span className="truncate w-full font-medium">{a.name}</span>
                {a.size ? (
                  <span className="text-[10px] text-muted-foreground">{formatSize(a.size)}</span>
                ) : null}
              </button>
            )}
            <button
              type="button"
              onClick={() => remove(i)}
              className="absolute top-0.5 left-0.5 bg-card/90 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition"
              aria-label="הסר קובץ"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );

  const notesCube = (
    <div className="rounded-xl border border-border/60 bg-card p-3 flex flex-col min-h-[180px] h-full shadow-sm text-right">
      <div className="flex items-center gap-1.5 text-sm font-medium mb-2">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        {notesTitle}
      </div>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onPaste={handlePaste}
        placeholder={placeholder}
        rows={rows}
        className="flex-1 min-h-[72px] border-0 bg-transparent focus-visible:ring-0 resize-none p-0"
      />
      {notesFooter ? <div className="mt-3 pt-3 border-t space-y-2">{notesFooter}</div> : null}
    </div>
  );

  const filesCube = (
    <div
      tabIndex={0}
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
      onPaste={handlePaste}
      className={cn(
        "rounded-xl border border-border/60 bg-card p-3 flex flex-col shadow-sm text-right outline-none focus-visible:ring-2 focus-visible:ring-ring",
        largeThumbs ? "min-h-[200px]" : "min-h-[180px]",
        dragOver && "border-primary bg-primary/5",
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <Paperclip className="h-4 w-4 text-muted-foreground" />
          קבצים
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
          צרף
        </Button>
      </div>
      {attachments.length > 0 ? (
        <div className="flex-1">{thumbs}</div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          onPaste={handlePaste}
          className={cn(
            "flex-1 rounded-lg border border-dashed border-muted-foreground/30 text-xs text-muted-foreground px-3 py-4 text-center hover:bg-muted/20 transition-colors",
            largeThumbs && "min-h-[140px]",
          )}
        >
          גרור לכאן, Ctrl+V, או לחץ לבחירה
        </button>
      )}
      {attachments.length > 0 && (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          onPaste={handlePaste}
          className="mt-3 rounded-lg border border-dashed border-muted-foreground/30 text-xs text-muted-foreground px-3 py-2 text-center hover:bg-muted/20 transition-colors"
        >
          גרור, Ctrl+V, או לחץ להוספה
        </button>
      )}
      {fileInput}
    </div>
  );

  if (variant === "notes") return notesCube;
  if (variant === "files") return filesCube;

  if (variant === "cubes") {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3" dir="rtl">
        {notesCube}
        {filesCube}
      </div>
    );
  }

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
        className={cn(
          "relative rounded-md border",
          dragOver ? "border-primary bg-primary/5" : "border-input",
        )}
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
          {fileInput}
        </div>
      </div>
      {attachments.length > 0 && thumbs}
    </div>
  );
}
