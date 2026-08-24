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
  const auto = stylesInGroup("auto");
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
            <SelectLabel>ברירת מחדל</SelectLabel>
            {auto.map((item) => (
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
          <SelectGroup>
            <SelectLabel>כיוון אופציונלי</SelectLabel>
            {reference.map((item) => (
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
          ברירת המחדל: הסגנון נבנה מהקופי, מצבעי הלוגו ומהנושא — לא מעשרת לוחות הרפרנס.
          כיוון אופציונלי הוא רמז לחומר בלבד. הטקסט העברי מתווסף אחר כך כשכבה.
          {selected.id !== "adaptive" ? ` נבחר כרגע: ${selected.label}.` : ""}
        </p>
      )}
    </div>
  );
}
