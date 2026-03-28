import { format, isToday, isTomorrow, isPast } from "date-fns";
import { he } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { SocialPost } from "@/pages/SocialGantt";
import { Instagram, Facebook, Linkedin, Twitter } from "lucide-react";

interface SocialGanttSidebarProps {
  posts: SocialPost[];
  selectedPostId: string | null;
  onSelectPost: (id: string) => void;
  isLoading: boolean;
}

const platformIcons: Record<string, React.ElementType> = {
  instagram: Instagram,
  facebook: Facebook,
  linkedin: Linkedin,
  twitter: Twitter,
  tiktok: () => (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.88-2.88 2.89 2.89 0 0 1 2.88-2.88c.28 0 .56.04.82.12v-3.5a6.37 6.37 0 0 0-.82-.05A6.34 6.34 0 0 0 3.15 15.3 6.34 6.34 0 0 0 9.49 21.64a6.34 6.34 0 0 0 6.34-6.34V8.73a8.19 8.19 0 0 0 4.76 1.52V6.8a4.84 4.84 0 0 1-1-.11z" />
    </svg>
  ),
};

const platformColors: Record<string, string> = {
  instagram: "bg-gradient-to-r from-purple-500 to-pink-500",
  facebook: "bg-blue-600",
  tiktok: "bg-black",
  linkedin: "bg-blue-700",
  twitter: "bg-gray-900",
};

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "טיוטה", variant: "secondary" },
  in_review: { label: "בבדיקה", variant: "outline" },
  approved: { label: "מאושר", variant: "default" },
  published: { label: "פורסם", variant: "default" },
  rejected: { label: "נדחה", variant: "destructive" },
};

function groupPostsByDate(posts: SocialPost[]) {
  const groups: Record<string, SocialPost[]> = {};
  for (const post of posts) {
    const dateKey = post.scheduled_date;
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(post);
  }
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
}

function formatDateLabel(dateStr: string) {
  const date = new Date(dateStr);
  if (isToday(date)) return "היום";
  if (isTomorrow(date)) return "מחר";
  return format(date, "EEEE, d MMMM", { locale: he });
}

export function SocialGanttSidebar({ posts, selectedPostId, onSelectPost, isLoading }: SocialGanttSidebarProps) {
  if (isLoading) {
    return (
      <div className="w-[360px] border-l p-4 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  const grouped = groupPostsByDate(posts);

  return (
    <div className="w-[360px] border-l flex flex-col bg-muted/30">
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          {grouped.length === 0 && (
            <div className="text-center text-muted-foreground py-12">
              <p className="text-lg font-medium">אין פוסטים</p>
              <p className="text-sm mt-1">צור פוסט חדש כדי להתחיל</p>
            </div>
          )}

          {grouped.map(([dateKey, datePosts]) => {
            const dateObj = new Date(dateKey);
            const isDatePast = isPast(dateObj) && !isToday(dateObj);

            return (
              <div key={dateKey}>
                <div className={cn(
                  "text-xs font-semibold mb-2 px-2",
                  isDatePast ? "text-muted-foreground" : "text-foreground",
                  isToday(dateObj) && "text-primary"
                )}>
                  {formatDateLabel(dateKey)}
                </div>

                <div className="space-y-2">
                  {datePosts.map((post) => {
                    const PlatformIcon = platformIcons[post.platform] || Instagram;
                    const status = statusLabels[post.status] || statusLabels.draft;

                    return (
                      <button
                        key={post.id}
                        onClick={() => onSelectPost(post.id)}
                        className={cn(
                          "w-full text-right rounded-lg border p-3 transition-all hover:shadow-md cursor-pointer",
                          selectedPostId === post.id
                            ? "border-primary bg-primary/5 shadow-sm"
                            : "border-border bg-background hover:border-primary/50"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <Badge variant={status.variant} className="text-[10px] shrink-0">
                            {status.label}
                          </Badge>
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div className={cn("w-6 h-6 rounded flex items-center justify-center text-white shrink-0", platformColors[post.platform])}>
                              <PlatformIcon className="h-3.5 w-3.5" />
                            </div>
                            <span className="font-medium text-sm truncate">{post.topic}</span>
                          </div>
                        </div>

                        {post.copy_text && (
                          <p className="text-xs text-muted-foreground mt-2 line-clamp-2 text-right">
                            {post.copy_text}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
