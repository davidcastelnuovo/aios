import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";

export default function Reports() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">דוחות</h2>
        <p className="text-muted-foreground mt-1">תצוגות וניתוחים מתקדמים</p>
      </div>

      <Card className="shadow-card">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <BarChart3 className="h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">דוחות מתקדמים</h3>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            בקרוב: דוחות הוצאות לפי ספק, סיכום חודשי, עומס משימות לפי קמפיינר ועוד
          </p>
        </CardContent>
      </Card>
    </div>
  );
}