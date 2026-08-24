import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CREATIVE_VISUAL_STYLES, stylesInGroup, type CreativeVisualStyleId } from "./visualStyles";

interface Props {
  value: CreativeVisualStyleId;
  onChange: (value: CreativeVisualStyleId) => void;
  compact?: boolean;
}

export function VisualStyleSelect({ value, onChange, compact }: Props) {
  const selected = CREATIVE_VISUAL_STYLES.find((item) => item.id === value) ?? CREATIVE_VISUAL_STYLES[0];
  const reference = stylesInGroup("reference");
  const more = stylesInGroup("more");

  return (
    <div>
      {!compact && <Label>סגנון ויזואלי</Label>}
      <Select value={value} onValueChange={(next) => onChange(next as CreativeVisualStyleId)}>
        <SelectTrigger className={compact ? "h-8 w-[196px]" : "mt-1"}>
          <SelectValue placeholder="בחר סגנון" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>רפרנס עיצוב</SelectLabel>
            {reference.map((item, index) => (
              <SelectItem key={item.id} value={item.id}>
                {compact ? `${String(index + 1).padStart(2, "0")} · ${item.label}` : (
                  <>
                    <span className="font-medium">{String(index + 1).padStart(2, "0")} · {item.label}</span>
                    <span className="ms-2 text-muted-foreground">· {item.hint}</span>
                  </>
                )}
              </SelectItem>
            ))}
          </SelectGroup>
          <SelectGroup>
            <SelectLabel>עוד סגנונות</SelectLabel>
            {more.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {compact ? item.label : (
                  <>
                    <span className="font-medium">{item.label}</span>
                    <span className="ms-2 text-muted-foreground">· {item.hint}</span>
                  </>
                )}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      {!compact && (
        <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
          כל הפריימים והוריאציות יישארו בסגנון {selected.label}. וריאציה חדשה תיקח סגנון רפרנס אחר. הטקסט העברי מתווסף אחר כך כשכבה — לא בתוך התמונה.
        </p>
      )}
    </div>
  );
}
