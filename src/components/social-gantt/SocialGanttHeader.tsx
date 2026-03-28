import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SocialGanttHeaderProps {
  onNewPost: () => void;
  filterPlatform: string;
  onFilterPlatform: (value: string) => void;
  filterStatus: string;
  onFilterStatus: (value: string) => void;
  totalPosts: number;
}

const platforms = [
  { value: "all", label: "כל הפלטפורמות" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "tiktok", label: "TikTok" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "twitter", label: "X (Twitter)" },
];

const statuses = [
  { value: "all", label: "כל הסטטוסים" },
  { value: "draft", label: "טיוטה" },
  { value: "in_review", label: "בבדיקה" },
  { value: "approved", label: "מאושר" },
  { value: "published", label: "פורסם" },
  { value: "rejected", label: "נדחה" },
];

export function SocialGanttHeader({
  onNewPost,
  filterPlatform,
  onFilterPlatform,
  filterStatus,
  onFilterStatus,
  totalPosts,
}: SocialGanttHeaderProps) {
  return (
    <div className="border-b p-4 flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-3">
        <Calendar className="h-6 w-6 text-primary" />
        <h1 className="text-xl font-bold">גאנט סושיאל</h1>
        <Badge variant="secondary">{totalPosts} פוסטים</Badge>
      </div>

      <div className="flex items-center gap-3">
        <Select value={filterPlatform} onValueChange={onFilterPlatform}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {platforms.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={onFilterStatus}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statuses.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button onClick={onNewPost}>
          <Plus className="h-4 w-4 ml-2" />
          פוסט חדש
        </Button>
      </div>
    </div>
  );
}
