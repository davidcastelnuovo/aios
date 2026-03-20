import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "./DataTable";
import { DataCards } from "./DataCards";
import { DataStats } from "./DataStats";
import type { DisplayData } from "./AIOSChatBar";

interface DataCanvasProps {
  panels: DisplayData[];
  onRemovePanel: (index: number) => void;
}

export function DataCanvas({ panels, onRemovePanel }: DataCanvasProps) {
  if (panels.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center space-y-2">
          <p className="text-sm">הנתונים יוצגו כאן לפי הבקשות שלך</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      {panels.map((panel, index) => (
        <Card key={index} className="border border-border">
          <CardHeader className="flex flex-row items-center justify-between py-3 px-4">
            <CardTitle className="text-base font-semibold">{panel.title}</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onRemovePanel(index)}
            >
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            {panel.view_type === "table" && (
              <DataTable columns={panel.columns || []} data={panel.data} />
            )}
            {panel.view_type === "cards" && (
              <DataCards data={panel.data} />
            )}
            {panel.view_type === "stats" && (
              <DataStats data={panel.data} />
            )}
            {panel.view_type === "list" && (
              <DataTable columns={panel.columns || []} data={panel.data} />
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
