import { Card, CardContent } from "@/components/ui/card";
import { Eye, MessageSquare, Quote, PieChart } from "lucide-react";

interface StatsCardsProps {
  totalPrompts: number;
  owned: number;
  competitorWins: number;
  shareOfVoice: number;
}

export function StatsCards({ totalPrompts, owned, competitorWins, shareOfVoice }: StatsCardsProps) {
  const stats = [
    { label: "פרומפטים במעקב", value: totalPrompts, icon: MessageSquare, color: "text-blue-500" },
    { label: "פרומפטים שמובילים", value: owned, icon: Eye, color: "text-green-500" },
    { label: "המתחרה מנצח", value: competitorWins, icon: Quote, color: "text-amber-500" },
    { label: "נתח קול", value: `${shareOfVoice}%`, icon: PieChart, color: "text-emerald-600" },
  ];

  return (
    <>
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={`rounded-lg bg-accent p-2 ${stat.color}`}>
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
