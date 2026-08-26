import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { CreativeImage } from "@/components/marketing/departments/creative/CreativeImage";
import { uploadCreativeAsset, type StyleReference } from "@/components/marketing/departments/creative/brandKit";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

interface Props {
  tenantId: string;
  itemId: string;
  references: StyleReference[];
  onChange: (next: StyleReference[]) => void;
  disabled?: boolean;
}

export function CreativeJobReferences({ tenantId, itemId, references, onChange, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const uploaded: StyleReference[] = [];
      for (const file of Array.from(files)) {
        const asset = await uploadCreativeAsset({
          supabase,
          tenantId,
          itemId,
          file,
          kind: "reference",
        });
        uploaded.push({ url: asset.url, name: asset.name });
      }
      onChange([...references, ...uploaded]);
      toast.success(uploaded.length === 1 ? "הרפרנס צורף לרג׳קט" : `${uploaded.length} רפרנסים צורפו`);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "העלאת הרפרנס נכשלה");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2" dir="rtl">
      <p className="text-[11px] text-muted-foreground">רפרנסים לטעם שאתם רוצים במקום — תאורה, קרופ, חומר. לא חובה.</p>
      {references.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {references.map((reference, index) => (
            <div key={`${reference.url}-${index}`} className="relative h-16 w-16 overflow-hidden rounded-lg border">
              <CreativeImage src={reference.url} alt={reference.name || "רפרנס"} className="h-full w-full object-cover" />
              <button
                type="button"
                className="absolute start-0.5 top-0.5 rounded bg-background/80 p-0.5 text-destructive"
                onClick={() => onChange(references.filter((_, itemIndex) => itemIndex !== index))}
                disabled={disabled || uploading}
                aria-label="הסר רפרנס"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        className="hidden"
        onChange={(event) => void upload(event.target.files)}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="gap-1.5"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || uploading}
      >
        {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
        הוסף רפרנס
      </Button>
    </div>
  );
}
