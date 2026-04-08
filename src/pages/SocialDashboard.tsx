/**
 * SocialDashboard — דשבורד סושיאל מאוחד
 *
 * 3 טאבים:
 *   1. גאנט — תכנון תוכן (social_gantt_posts) עם AI agents
 *   2. פוסטים — ניהול פוסטים מוכנים (social_media_posts)
 *   3. ערוצים — ניהול ערוצי פרסום + הגדרות WordPress
 */

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CalendarRange,
  ListChecks,
  Settings,
  Share2,
  Plus,
  Maximize2,
  Minimize2,
} from "lucide-react";

import { PostComposer } from "@/components/social-media/PostComposer";

// Social Gantt components (content planning with AI)
import { SocialGanttVisualView } from "@/components/social-gantt/SocialGanttVisualView";
import { SocialGanttPostPanel } from "@/components/social-gantt/SocialGanttPostPanel";
import { SocialGanttHeader } from "@/components/social-gantt/SocialGanttHeader";
import { DayIdeaPanel } from "@/components/social-gantt/DayIdeaPanel";

// Social Media Scheduler components (publishing)
import { PostsList } from "@/components/social-media/PostsList";
import { ChannelManager } from "@/components/social-media/ChannelManager";
import { WordPressSettings } from "@/components/social-media/WordPressSettings";

// Hooks & data
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useSocialMediaPosts } from "@/hooks/useSocialMedia";
import { toast } from "sonner";

export interface SocialPost {
  id: string;
  tenant_id: string;
  topic: string;
  scheduled_date: string;
  platform: "instagram" | "facebook" | "tiktok" | "linkedin" | "twitter";
  status: "draft" | "in_review" | "approved" | "published" | "rejected";
  copy_text: string | null;
  creative_url: string | null;
  creative_prompt: string | null;
  copy_prompt: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const platformColors: Record<string, string> = {
  instagram: "bg-pink-500",
  facebook: "bg-blue-600",
  tiktok: "bg-black",
  linkedin: "bg-blue-700",
  twitter: "bg-sky-500",
};

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "טיוטה", variant: "secondary" },
  in_review: { label: "בבדיקה", variant: "outline" },
  approved: { label: "מאושר", variant: "default" },
  published: { label: "פורסם", variant: "default" },
  rejected: { label: "נדחה", variant: "destructive" },
};

export default function SocialDashboard() {
  const { tenantId } = useCurrentTenant();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("gantt");

  // ─── Gantt state ───────────────────────────────────────────────
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [filterPlatform, setFilterPlatform] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [ganttFullscreen, setGanttFullscreen] = useState(false);

  // ─── Gantt data ────────────────────────────────────────────────
  const { data: ganttPosts = [], isLoading: ganttLoading } = useQuery({
    queryKey: ["social-gantt-posts", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await (supabase as any)
        .from("social_gantt_posts")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("scheduled_date", { ascending: true });
      if (error) throw error;
      return data as SocialPost[];
    },
    enabled: !!tenantId,
  });

  const updateGanttPost = useMutation({
    mutationFn: async (updates: Partial<SocialPost> & { id: string }) => {
      const { id, ...rest } = updates;
      const { error } = await (supabase as any)
        .from("social_gantt_posts")
        .update({ ...rest, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social-gantt-posts"] });
      toast.success("הפוסט עודכן בהצלחה");
    },
    onError: () => toast.error("שגיאה בעדכון הפוסט"),
  });

  const createGanttPost = useMutation({
    mutationFn: async (newPost: Omit<SocialPost, "id" | "created_at" | "updated_at">) => {
      const { error } = await (supabase as any).from("social_gantt_posts").insert(newPost);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social-gantt-posts"] });
      setIsComposerOpen(false);
      toast.success("פוסט חדש נוצר");
    },
    onError: () => toast.error("שגיאה ביצירת הפוסט"),
  });

  const deleteGanttPost = useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await (supabase as any)
        .from("social_gantt_posts")
        .delete()
        .eq("id", postId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social-gantt-posts"] });
      setSelectedPostId(null);
      toast.success("הפוסט נמחק");
    },
  });

  // ─── Demo seed ────────────────────────────────────────────────
  const seedDemoPosts = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error("No tenant");
      const base = "2026-04-";
      const demos: Omit<SocialPost, "id" | "created_at" | "updated_at">[] = [
        {
          tenant_id: tenantId,
          topic: "השקת קמפיין אביב",
          scheduled_date: base + "07",
          platform: "instagram",
          status: "approved",
          copy_text: "האביב הגיע ואיתו הזמן לחדש! 🌸 הכירו את הקולקציה החדשה שלנו — עיצובים רעננים שמחכים לכם. לחצו על הלינק בביו לגלות עוד.",
          copy_prompt: "האביב מביא איתו אנרגיות חדשות. גם אנחנו לא עמדנו מנגד — הכנו בשבילכם קולקציה שלמה שתשדרג לכם את הסגנון. מה מחכה לכם? לחצו ותגלו 👇",
          creative_url: null,
          creative_prompt: "bright spring flowers, pastel colors, modern lifestyle product photography",
          notes: JSON.stringify([{ id: "1", text: "לוודא שהלינק בביו מעודכן", color: "yellow" }]),
        },
        {
          tenant_id: tenantId,
          topic: "טיפ שבועי — פרודוקטיביות",
          scheduled_date: base + "08",
          platform: "linkedin",
          status: "approved",
          copy_text: "טיפ השבוע: תחילו את הבוקר עם 3 משימות קריטיות בלבד. מחקרים מראים שמיקוד בפחות משימות מגדיל פרודוקטיביות ב-40%. מה הטיפ שלכם לניהול זמן? ✍️",
          copy_prompt: "הסוד לפרודוקטיביות גבוהה הוא לא לעשות יותר — אלא לעשות פחות, אבל נכון. השבוע אנחנו חולקים את הטיפ שהכי שינה לנו את אופן העבודה. מה דעתכם?",
          creative_url: null,
          creative_prompt: "clean minimal desk setup, morning coffee, notebook with tasks, productivity",
          notes: null,
        },
        {
          tenant_id: tenantId,
          topic: "סטורי — מאחורי הקלעים",
          scheduled_date: base + "09",
          platform: "instagram",
          status: "draft",
          copy_text: "מה קורה מאחורי הקלעים? 👀 הצצה לתהליך העבודה שלנו — מהרעיון ועד למוצר המוגמר. שמרו את הסטורי לפני שייעלם!",
          copy_prompt: "הכל מתחיל ברעיון קטן... ומסתיים במשהו שאתם אוהבים. הצטרפו אלינו למסע מאחורי הקלעים 🎬",
          creative_url: null,
          creative_prompt: "behind the scenes office work, team collaboration, creative process, candid photo",
          notes: JSON.stringify([{ id: "2", text: "לצלם וידאו קצר ב-30 שניות", color: "blue" }]),
        },
        {
          tenant_id: tenantId,
          topic: "פוסט ערך — 5 טעויות נפוצות",
          scheduled_date: base + "10",
          platform: "facebook",
          status: "in_review",
          copy_text: "5 טעויות שכולם עושים בשיווק דיגיטלי (ואיך להימנע מהן):\n1️⃣ לא מגדירים קהל יעד ברור\n2️⃣ מתמקדים בכמות ולא באיכות\n3️⃣ מתעלמים מניתוח נתונים\n4️⃣ לא עקביים בפרסום\n5️⃣ מפחדים לנסות פורמטים חדשים\nאיזו טעות הכי מוכרת לכם? 👇",
          copy_prompt: "שיווק דיגיטלי יכול להיות מורכב — אבל הטעויות הנפוצות ביותר ניתנות למניעה בקלות. הכנו לכם רשימה של 5 דברים שכדאי להפסיק לעשות עכשיו. שמרו את הפוסט!",
          creative_url: null,
          creative_prompt: "infographic style, 5 mistakes in digital marketing, clean design, Hebrew text",
          notes: null,
        },
        {
          tenant_id: tenantId,
          topic: "ריל — טרנד השבוע",
          scheduled_date: base + "11",
          platform: "tiktok",
          status: "draft",
          copy_text: "הצטרפנו לטרנד הכי חם ברשת 🔥 ואתם? תייגו חבר שחייב לראות את זה! #טרנד #ויראלי",
          copy_prompt: "כולם מדברים על הטרנד הזה — ואנחנו לא יכולנו להישאר מאחור 😄 צפו עד הסוף!",
          creative_url: null,
          creative_prompt: "trending reels style, dynamic movement, vibrant colors, social media trend",
          notes: JSON.stringify([{ id: "3", text: "לבדוק איזה טרנד רלוונטי בשבוע הפרסום", color: "pink" }]),
        },
        {
          tenant_id: tenantId,
          topic: "לקוח מרוצה — עדות",
          scheduled_date: base + "13",
          platform: "instagram",
          status: "approved",
          copy_text: "\"השירות היה מעל ומעבר לציפיות שלנו. ממליצים בחום!\" — דנה כ., מנהלת שיווק ❤️\n\nאנחנו גאים בכל לקוח מרוצה. תודה על האמון! 🙏",
          copy_prompt: "כשלקוח מרוצה כותב לנו ככה — זה הדלק שמניע אותנו קדימה. תודה דנה! ❤️ אם גם אתם עבדתם איתנו, נשמח שתשתפו את החוויה שלכם.",
          creative_url: null,
          creative_prompt: "happy customer testimonial, warm colors, quote card design, professional",
          notes: null,
        },
        {
          tenant_id: tenantId,
          topic: "שאלה לקהל — סקר",
          scheduled_date: base + "14",
          platform: "instagram",
          status: "draft",
          copy_text: "שאלה לכם: מה הכלי הדיגיטלי שהכי עוזר לכם בעבודה? 🤔\nA. ChatGPT\nB. Notion\nC. Canva\nD. אחר (כתבו בתגובות!)\nהצביעו בסטורי! 👆",
          copy_prompt: "אנחנו תמיד רוצים ללמוד מכם — אז הפעם אנחנו שואלים: איזה כלי דיגיטלי לא תוכלו לעבוד בלעדיו? שתפו אותנו! 💬",
          creative_url: null,
          creative_prompt: "poll question graphic, digital tools icons, clean modern design, engagement post",
          notes: JSON.stringify([{ id: "4", text: "לפרסם גם בסטורי עם סקר", color: "green" }]),
        },
        {
          tenant_id: tenantId,
          topic: "תוכן חינוכי — מדריך",
          scheduled_date: base + "15",
          platform: "linkedin",
          status: "in_review",
          copy_text: "מדריך מהיר: איך לכתוב פוסט שמייצר מעורבות גבוהה?\n✅ פתחו עם שאלה או עובדה מפתיעה\n✅ השתמשו בפסקאות קצרות\n✅ הוסיפו CTA ברור בסוף\n✅ פרסמו בשעות הפעילות של הקהל\n\nשמרו את הפוסט לשימוש עתידי! 🔖",
          copy_prompt: "הסוד לפוסטים שמקבלים אלפי לייקים הוא לא מזל — זה מתכון ברור שניתן ללמוד. הנה 4 כללים שאנחנו מיישמים בכל פוסט שאנחנו כותבים.",
          creative_url: null,
          creative_prompt: "educational content, step by step guide, clean infographic, social media tips",
          notes: null,
        },
        {
          tenant_id: tenantId,
          topic: "פרסום מוצר — הכרזה",
          scheduled_date: base + "16",
          platform: "instagram",
          status: "draft",
          copy_text: "🎉 אנחנו נרגשים להכריז על המוצר החדש שלנו! אחרי חודשים של עבודה, הוא כאן. לחצו על הלינק בביו לגלות את כל הפרטים ולהזמין ראשונים.",
          copy_prompt: "זה הרגע שחיכינו לו! 🚀 המוצר שעבדנו עליו בשקט כל כך הרבה זמן — סוף סוף מוכן. ואתם הראשונים לשמוע. לחצו ותגלו.",
          creative_url: null,
          creative_prompt: "product launch announcement, exciting reveal, modern design, celebration",
          notes: JSON.stringify([{ id: "5", text: "לוודא שדף הנחיתה מוכן לפני הפרסום", color: "yellow" }]),
        },
        {
          tenant_id: tenantId,
          topic: "תוכן בידורי — מם",
          scheduled_date: base + "17",
          platform: "facebook",
          status: "draft",
          copy_text: "כשאתה מסביר ללקוח שהתקציב לא מספיק לכל מה שהוא רוצה 😅\n\nמי מזדהה? תייגו קולגה! 👇 #שיווק #חיי_שיווקן",
          copy_prompt: "אנחנו כולנו היינו שם... אותו רגע שבו אתה מנסה להסביר מציאות תקציבית בנימוס 😂 מי מזדהה?",
          creative_url: null,
          creative_prompt: "funny marketing meme, relatable office humor, clean design",
          notes: null,
        },
        {
          tenant_id: tenantId,
          topic: "שיתוף פעולה — קולאב",
          scheduled_date: base + "21",
          platform: "instagram",
          status: "draft",
          copy_text: "שמחים לבשר על שיתוף פעולה מיוחד עם @partner_brand! 🤝 ביחד נביא לכם תוכן, מוצרים ומבצעים שלא ראיתם עד היום. עקבו אחרינו לפרטים נוספים!",
          copy_prompt: "כששני מותגים שמאמינים באותם ערכים מתחברים — קורה משהו מיוחד. אנחנו נרגשים לשתף אתכם בשיתוף הפעולה החדש שלנו. הישארו מחוברים! 🔔",
          creative_url: null,
          creative_prompt: "brand collaboration announcement, two logos together, partnership, modern design",
          notes: JSON.stringify([{ id: "6", text: "לתאם עם השותף על תיוג הדדי", color: "blue" }]),
        },
        {
          tenant_id: tenantId,
          topic: "סיכום חודשי — אפריל",
          scheduled_date: base + "28",
          platform: "linkedin",
          status: "draft",
          copy_text: "אפריל 2026 בסיכום:\n📊 X% גידול בתנועה אורגנית\n💬 X% עלייה במעורבות\n🎯 השקנו X מוצרים חדשים\n\nתודה לכל מי שהיה איתנו בדרך! מה הייתה ההישג הגדול שלכם החודש? 👇",
          copy_prompt: "חודש אפריל היה מלא הישגים עבורנו — ואנחנו רוצים לחלוק אותם איתכם. הנה המספרים שמספרים את הסיפור. מה הייתה ההצלחה הכי גדולה שלכם החודש?",
          creative_url: null,
          creative_prompt: "monthly recap infographic, statistics, achievements, professional design",
          notes: null,
        },
      ];
      const { error } = await (supabase as any).from("social_gantt_posts").insert(demos);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social-gantt-posts"] });
      toast.success("12 פוסטי דמו נטענו בהצלחה! 🎉");
    },
    onError: (err: any) => toast.error("שגיאה בטעינת הדמו: " + err.message),
  });

  // ─── Scheduler data (for stats) ───────────────────────────────
  const { data: schedulerPosts = [] } = useSocialMediaPosts();

  // ─── Derived ──────────────────────────────────────────────────
  const selectedPost = ganttPosts.find((p) => p.id === selectedPostId) || null;
  const filteredGanttPosts = ganttPosts.filter((post) => {
    if (filterPlatform !== "all" && post.platform !== filterPlatform) return false;
    if (filterStatus !== "all" && post.status !== filterStatus) return false;
    return true;
  });

  // Stats for header
  const ganttDraft = ganttPosts.filter((p) => p.status === "draft").length;
  const ganttApproved = ganttPosts.filter((p) => p.status === "approved").length;
  const schedulerScheduled = schedulerPosts.filter((p) => p.status === "scheduled").length;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]" dir="rtl">
      {/* ── Page Header ─────────────────────────────────────────── */}
      <div className="flex items-start justify-between px-6 py-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shrink-0">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Share2 className="h-6 w-6 text-primary" />
            ניהול סושיאל מדיה
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            תכנון תוכן, ניהול פוסטים ופרסום — במקום אחד
          </p>
        </div>
        {/* Quick stats */}
        <div className="flex items-center gap-3 text-sm">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted">
            <span className="text-muted-foreground">טיוטות:</span>
            <span className="font-semibold">{ganttDraft}</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 text-green-700 dark:text-green-400">
            <span>מאושרים:</span>
            <span className="font-semibold">{ganttApproved}</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-700 dark:text-blue-400">
            <span>מתוזמנים:</span>
            <span className="font-semibold">{schedulerScheduled}</span>
          </div>
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────── */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex flex-col flex-1 min-h-0"
        dir="rtl"
      >
        <div className="px-6 pt-3 shrink-0 border-b">
          <TabsList className="h-9" dir="rtl">
            <TabsTrigger value="gantt" className="flex items-center gap-1.5 text-sm">
              <CalendarRange className="h-3.5 w-3.5" />
              גאנט תוכן
              {ganttDraft > 0 && (
                <Badge variant="secondary" className="h-4 px-1.5 text-[10px] me-1">
                  {ganttDraft}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="posts" className="flex items-center gap-1.5 text-sm">
              <ListChecks className="h-3.5 w-3.5" />
              פוסטים
              {schedulerPosts.length > 0 && (
                <Badge variant="secondary" className="h-4 px-1.5 text-[10px] me-1">
                  {schedulerPosts.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="channels" className="flex items-center gap-1.5 text-sm">
              <Settings className="h-3.5 w-3.5" />
              ערוצים
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ── Gantt Tab ──────────────────────────────────────────── */}
        <TabsContent value="gantt" className="flex-1 overflow-hidden mt-0" forceMount>
          {activeTab === "gantt" && (
            <div className="flex flex-col h-full min-h-0">
              <div className="shrink-0">
                <SocialGanttHeader
                  onNewPost={() => setSelectedDay(new Date())}
                  filterPlatform={filterPlatform}
                  onFilterPlatform={setFilterPlatform}
                  filterStatus={filterStatus}
                  onFilterStatus={setFilterStatus}
                  totalPosts={ganttPosts.length}
                  onLoadDemo={() => seedDemoPosts.mutate()}
                  isLoadingDemo={seedDemoPosts.isPending}
                />
              </div>
              <div className="flex-1 min-h-0">
                <SocialGanttVisualView
                  posts={filteredGanttPosts}
                  selectedPostId={selectedPostId}
                  onSelectPost={(id) => { setSelectedPostId(id); setSelectedDay(null); }}
                  onSelectDay={(day) => { setSelectedDay(day); setSelectedPostId(null); }}
                  isLoading={ganttLoading}
                />
              </div>
            </div>
          )}

          {/* ── Day Dialog (popup) ──────────────────────────────── */}
          <Dialog open={!!selectedDay && activeTab === "gantt"} onOpenChange={(open) => { if (!open) { setSelectedDay(null); setSelectedPostId(null); } }}>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" dir="rtl">
              <DialogHeader>
                <DialogTitle>
                  {selectedDay ? format(selectedDay, "EEEE, d בMMMM yyyy", { locale: he }) : ""}
                </DialogTitle>
              </DialogHeader>

              {selectedDay && (() => {
                const dayPosts = ganttPosts.filter(
                  (p) => p.scheduled_date.slice(0, 10) === format(selectedDay, "yyyy-MM-dd")
                );

                return (
                  <div className="space-y-4">
                    {/* Posts list for this day */}
                    {dayPosts.length > 0 ? (
                      <div className="space-y-2">
                        {dayPosts.map((post) => (
                          <div
                            key={post.id}
                            className={cn(
                              "border rounded-lg p-3 cursor-pointer transition-colors",
                              selectedPostId === post.id
                                ? "border-primary bg-primary/5"
                                : "hover:bg-muted/50"
                            )}
                            onClick={() =>
                              setSelectedPostId(
                                selectedPostId === post.id ? null : post.id
                              )
                            }
                          >
                            <div className="flex items-center gap-2">
                              <div className={cn(
                                "w-5 h-5 rounded flex items-center justify-center text-white shrink-0",
                                platformColors[post.platform]
                              )}>
                                {(() => {
                                  const Icon = platformIcons[post.platform] || Instagram;
                                  return <Icon className="h-3 w-3" />;
                                })()}
                              </div>
                              <span className="font-medium text-sm">{post.topic}</span>
                              <span className={cn(
                                "text-[10px] font-medium px-1.5 py-0.5 rounded-full ms-auto whitespace-nowrap",
                                statusLabels[post.status]?.variant === "destructive"
                                  ? "bg-destructive/15 text-destructive"
                                  : post.status === "approved" || post.status === "published"
                                  ? "bg-green-500/15 text-green-700 dark:text-green-400"
                                  : post.status === "in_review"
                                  ? "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400"
                                  : "bg-muted text-muted-foreground"
                              )}>
                                {statusLabels[post.status]?.label || post.status}
                              </span>
                            </div>

                            {/* Expanded post editor */}
                            {selectedPostId === post.id && (
                              <div className="mt-3 border-t pt-3" onClick={(e) => e.stopPropagation()}>
                                <SocialGanttPostPanel
                                  post={post}
                                  onUpdatePost={(updates) => updateGanttPost.mutate(updates)}
                                  onDeletePost={(id) => deleteGanttPost.mutate(id)}
                                  isUpdating={updateGanttPost.isPending}
                                  tenantId={tenantId}
                                  embedded
                                />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        אין פוסטים מתוכננים ליום הזה
                      </p>
                    )}

                    {/* Create new post for this day */}
                    <Separator />
                    <DayIdeaPanel
                      date={selectedDay}
                      tenantId={tenantId}
                      onCreatePost={(post) => createGanttPost.mutate(post)}
                      isCreating={createGanttPost.isPending}
                      onClose={() => {}}
                      embedded
                    />
                  </div>
                );
              })()}
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ── Posts Tab ──────────────────────────────────────────── */}
        <TabsContent value="posts" className="mt-0" forceMount>
          {activeTab === "posts" && (
            <div className="h-[calc(100vh-12rem)] overflow-y-auto">
              <div className="flex items-center justify-between px-6 py-3 border-b sticky top-0 bg-background z-10 shrink-0">
                <h2 className="text-base font-semibold">פוסטים מוכנים לפרסום</h2>
                <Button size="sm" onClick={() => setIsComposerOpen(true)}>
                  <Plus className="h-4 w-4 me-1" />
                  פוסט חדש
                </Button>
              </div>
              <div className="p-6">
                <PostsList />
              </div>
            </div>
          )}
          <Dialog open={isComposerOpen} onOpenChange={setIsComposerOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
              <DialogHeader>
                <DialogTitle>יצירת פוסט חדש</DialogTitle>
              </DialogHeader>
              <PostComposer onPostCreated={() => setIsComposerOpen(false)} />
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ── Channels Tab (includes WordPress) ──────────────────── */}
        <TabsContent value="channels" className="mt-0" forceMount>
          {activeTab === "channels" && (
            <div className="h-[calc(100vh-12rem)] overflow-y-auto p-6">
              <ChannelManager />
              <Separator className="my-8" />
              <WordPressSettings />
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
