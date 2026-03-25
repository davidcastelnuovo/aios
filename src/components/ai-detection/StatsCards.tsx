import { Card, CardContent } from "@/components/ui/card";
import { Eye, MessageSquare, Quote, Target } from "lucide-react";

interface StatsCardsProps {
  totalPrompts: number;
  totalMentions: number;
  totalCitations: number;
  avgPosition: number;
}

export function StatsCards({ totalPrompts, totalMentions, totalCitations, avgPosition }: StatsCardsProps) {
  const stats = [
    { label: "פרומפטים במעקב", value: totalPrompts, icon: MessageSquare, color: "text-blue-500" },
    { label: "אזכורים השבוע", value: totalMentions, icon: Eye, color: "text-green-500" },
    { label: "מקורות ציטוט", value: totalCitations, icon: Quote, color: "text-purple-500" },
    { label: "מיקום ממוצע", value: `#${avgPosition}`, icon: Target, color: "text-orange-500" },
  ];

  return (
    <>
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-accent ${stat.color}`}>
                <stat.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </>
  );
}
