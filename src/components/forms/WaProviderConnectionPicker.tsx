import { useEffect, useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface Integration {
  id: string;
  integration_type: string;
  settings?: any;
  owner_name?: string | null;
}

interface Props {
  integrations: Integration[] | undefined;
  value: string | undefined;
  onChange: (id: string) => void;
}

export function WaProviderConnectionPicker({ integrations, value, onChange }: Props) {
  const list = integrations || [];
  const hasGreen = list.some((i) => i.integration_type === "green_api");
  const hasManus = list.some((i) => i.integration_type === "manus_wa");

  // Derive initial provider from currently selected integration if any
  const currentIntegration = list.find((i) => i.id === value);
  const [provider, setProvider] = useState<"green_api" | "manus_wa">(
    (currentIntegration?.integration_type as "green_api" | "manus_wa") ||
      (hasGreen ? "green_api" : hasManus ? "manus_wa" : "green_api"),
  );

  // Keep provider in sync if integration changes externally
  useEffect(() => {
    if (currentIntegration && currentIntegration.integration_type !== provider) {
      setProvider(currentIntegration.integration_type as "green_api" | "manus_wa");
    }
  }, [currentIntegration?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(
    () => list.filter((i) => i.integration_type === provider),
    [list, provider],
  );

  // Auto-pick when exactly one option of selected provider
  useEffect(() => {
    if (filtered.length === 0) return;
    const stillValid = value && filtered.some((i) => i.id === value);
    if (!stillValid) {
      if (filtered.length === 1) onChange(filtered[0].id);
      else if (value) onChange("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, filtered.length]);

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className="text-xs">ספק WhatsApp</Label>
        <RadioGroup
          value={provider}
          onValueChange={(v) => setProvider(v as "green_api" | "manus_wa")}
          className="flex gap-4"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="green_api" id="wa-prov-pick-green" disabled={!hasGreen && !hasManus} />
            <Label htmlFor="wa-prov-pick-green" className="cursor-pointer text-sm">
              Green API {hasGreen ? "" : "(אין חיבור)"}
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="manus_wa" id="wa-prov-pick-manus" disabled={!hasManus && !hasGreen} />
            <Label htmlFor="wa-prov-pick-manus" className="cursor-pointer text-sm">
              Manus WA {hasManus ? "" : "(אין חיבור)"}
            </Label>
          </div>
        </RadioGroup>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">חיבור</Label>
        <Select value={value || ""} onValueChange={onChange}>
          <SelectTrigger>
            <SelectValue placeholder={filtered.length ? "בחר חיבור..." : `אין חיבור ${provider === "manus_wa" ? "Manus" : "Green API"} פעיל`} />
          </SelectTrigger>
          <SelectContent className="bg-background z-[100]">
            {filtered.length === 0 ? (
              <div className="py-2 px-3 text-sm text-muted-foreground">לא נמצאו חיבורים</div>
            ) : (
              filtered.map((i) => {
                const idShort =
                  i.settings?.idInstance?.slice(-4) ||
                  i.settings?.instance_id?.slice(-4) ||
                  i.settings?.instanceId?.slice(-4) ||
                  "לא ידוע";
                const name = i.settings?.instance_name || i.settings?.connection_name || i.owner_name || "חיבור";
                return (
                  <SelectItem key={i.id} value={i.id}>
                    {name} ({idShort})
                  </SelectItem>
                );
              })
            )}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
