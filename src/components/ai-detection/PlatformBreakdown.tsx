import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface Platform {
  name: string;
  score: number;
  mentions: number;
  total: number;
  icon: string;
  color: string;
}

interface PlatformBreakdownProps {
  platforms: Platform[];
}

export function PlatformBreakdown({ platforms }: PlatformBreakdownProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">נראות לפי פלטפורמה</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {platforms.map((platform) => (
          <div key={platform.name} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">{platform.icon}</span>
                <span className="font-medium text-sm">{platform.name}</span>
              </div>
              <span className="text-sm font-bold">{platform.score}%</span>
            </div>
            <Progress value={platform.score} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {platform.mentions} אזכורים מתוך {platform.total} שאילתות
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
