import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Phone } from "lucide-react";

interface GreenAPIControlsProps {
  phone: string | null;
}

export function GreenAPIControls({ phone }: GreenAPIControlsProps) {
  return (
    <div className="space-y-3 p-3 bg-muted/30 rounded-lg border">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Badge variant="outline" className="bg-blue-500/10 text-blue-700 dark:text-blue-400">
          Green API
        </Badge>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground flex items-center gap-1">
          <Phone className="h-3 w-3" />
          מספר טלפון
        </Label>
        <div className="text-sm font-mono">{phone || "לא מוגדר"}</div>
      </div>
    </div>
  );
}
