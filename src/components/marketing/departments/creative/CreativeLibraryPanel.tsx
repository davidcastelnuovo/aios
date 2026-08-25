import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CREATIVE_COMPOSITIONS, type CompositionId } from "./compositions";
import { searchCreativeIcons } from "./iconLibrary";
import { OfferIconMark } from "./layerMarks";
import { CREATIVE_SHAPES } from "./shapeLibrary";

interface Props {
  brandColors?: string[];
  logoUrl?: string;
  currentCompositionId?: CompositionId;
  onAddIcon: (icon: string, color: string) => void;
  onAddShape: (shapeId: string, color: string) => void;
  onAddLogo?: () => void;
  onApplyColor: (color: string) => void;
  onApplyTemplate: (id: CompositionId) => void;
}

export function CreativeLibraryPanel({
  brandColors = [],
  logoUrl,
  currentCompositionId,
  onAddIcon,
  onAddShape,
  onAddLogo,
  onApplyColor,
  onApplyTemplate,
}: Props) {
  const [query, setQuery] = useState("");
  const [ink, setInk] = useState(brandColors[0] || "#111111");
  const icons = useMemo(() => searchCreativeIcons(query).slice(0, 36), [query]);
  const swatches = [...new Set([...brandColors, "#111111", "#ffffff", "#dc2626", "#2563eb"])].slice(0, 10);

  return (
    <div className="space-y-5">
      <div>
        <Label className="text-[11px] text-muted-foreground">טמפלייטים</Label>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {CREATIVE_COMPOSITIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onApplyTemplate(item.id)}
              className={`rounded-lg border px-2 py-2 text-right text-[11px] transition-colors ${
                currentCompositionId === item.id
                  ? "border-pink-400 bg-pink-50 dark:bg-pink-950/20"
                  : "hover:bg-muted/50"
              }`}
            >
              <div className="font-semibold">{item.label}</div>
              <div className="mt-0.5 text-[10px] text-muted-foreground">{item.id}</div>
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">מחליף רק שכבות — התמונה נשארת.</p>
      </div>

      <div>
        <Label className="text-[11px] text-muted-foreground">צורות</Label>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {CREATIVE_SHAPES.map((shape) => (
            <Button key={shape.id} size="sm" variant="outline" className="h-8 text-[11px]" onClick={() => onAddShape(shape.id, ink)}>
              {shape.label}
            </Button>
          ))}
        </div>
      </div>

      <div>
        <Label className="text-[11px] text-muted-foreground">אייקונים</Label>
        <Input
          className="mt-2 h-8 text-xs"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="חיפוש: מגפון, חיפוש, לייק…"
        />
        <div className="mt-2 grid grid-cols-6 gap-1.5">
          {icons.map((icon) => (
            <button
              key={icon.id}
              type="button"
              title={icon.label}
              onClick={() => onAddIcon(icon.id, ink)}
              className="flex h-9 items-center justify-center rounded-md border hover:bg-muted/60"
            >
              <OfferIconMark name={icon.id} color={ink} className="h-4 w-4" />
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label className="text-[11px] text-muted-foreground">צבע — מותג + בסיס</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {swatches.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => {
                setInk(color);
                onApplyColor(color);
              }}
              className="h-7 w-7 rounded-full border shadow-sm"
              style={{ background: color }}
              aria-label={color}
            />
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">לחיצה צובעת את השכבה הנבחרת. האייקון/הצורה הבאים ישתמשו בצבע הזה.</p>
      </div>

      {logoUrl && onAddLogo && (
        <Button size="sm" variant="outline" className="w-full" onClick={onAddLogo}>
          הוסף לוגו מהמותג
        </Button>
      )}
    </div>
  );
}
