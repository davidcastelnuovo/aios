import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CREATIVE_VISUAL_STYLES, type CreativeVisualStyleId } from "./visualStyles";

interface Props {
  value: CreativeVisualStyleId;
  onChange: (value: CreativeVisualStyleId) => void;
  compact?: boolean;
}

export function VisualStyleSelect({ value, onChange, compact }: Props) {
  const selected = CREATIVE_VISUAL_STYLES.find((style) => style.id === value) ?? CREATIVE_VISUAL_STYLES[0];

  return (
    <div>
      {!compact && <Label>סגנון ויזואלי</Label>}
      <Select value={value} onValueChange={(next) => onChange(next as CreativeVisualStyleId)}>
        <SelectTrigger className={compact ? "h-8 w-[168px]" : "mt-1"}>
          <SelectValue placeholder="בחר סגנון" />
        </SelectTrigger>
        <SelectContent>
          {CREATIVE_VISUAL_STYLES.map((style) => (
            <SelectItem key={style.id} value={style.id}>
              {compact ? style.label : (
                <>
                  <span className="font-medium">{style.label}</span>
                  <span className="ms-2 text-muted-foreground">· {style.hint}</span>
                </>
              )}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {!compact && (
        <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
          כל הפריימים והוריאציות יישארו בסגנון {selected.label}. הטקסט העברי מתווסף אחר כך כשכבה — לא בתוך התמונה.
        </p>
      )}
    </div>
  );
}
