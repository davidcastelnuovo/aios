/**
 * SocialDashboard — דשבורד סושיאל מאוחד
 *
 * מאחד את SocialMediaScheduler (social_media_posts) ו-SocialGantt (social_gantt_posts)
 * לממשק אחד עם 5 טאבים:
 *   1. גאנט — תכנון תוכן (social_gantt_posts) עם AI agents
 *   2. פוסטים — ניהול פוסטים מוכנים (social_media_posts)
 *   3. לוח שנה — תצוגת לוח שנה מאוחדת
 *   4. ערוצים — ניהול ערוצי פרסום
 *   5. הגדרות — WordPress ועוד
 */

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CalendarRange,
  ListChecks,
  Calendar,
  Settings,
  Globe,
  Share2,
  Plus,
} from "lucide-react";
import { PostComposer } from "@/components/social-media/PostComposer";

// Social Gantt components (content planning with AI)
import { SocialGanttSidebar } from "@/components/social-gantt/SocialGanttSidebar";
import { SocialGanttPreview } from "@/components/social-gantt/SocialGanttPreview";
import { SocialGanttHeader } from "@/components/social-gantt/SocialGanttHeader";
import { NewPostDialog } from "@/components/social-gantt/NewPostDialog";

// Social Media Scheduler components (publishing)
import { PostsList } from "@/components/social-media/PostsList";
import { ScheduleCalendar } from "@/components/social-media/ScheduleCalendar";
import { VisualPostCalendar } from "@/components/social-media/VisualPostCalendar";
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
  const [isNewPostOpen, setIsNewPostOpen] = useState(false);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [filterPlatform, setFilterPlatform] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

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
      setIsNewPostOpen(false);
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
        className="flex flex-col flex-1 min-h-0 overflow-hidden"
      >
        <div className="px-6 pt-3 shrink-0 border-b">
          <TabsList className="h-9">
            <TabsTrigger value="gantt" className="flex items-center gap-1.5 text-sm">
              <CalendarRange className="h-3.5 w-3.5" />
              גאנט תוכן
              {ganttDraft > 0 && (
                <Badge variant="secondary" className="h-4 px-1.5 text-[10px] ml-1">
                  {ganttDraft}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="posts" className="flex items-center gap-1.5 text-sm">
              <ListChecks className="h-3.5 w-3.5" />
              פוסטים
              {schedulerPosts.length > 0 && (
                <Badge variant="secondary" className="h-4 px-1.5 text-[10px] ml-1">
                  {schedulerPosts.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="calendar" className="flex items-center gap-1.5 text-sm">
              <Calendar className="h-3.5 w-3.5" />
              לוח שנה
            </TabsTrigger>
            <TabsTrigger value="channels" className="flex items-center gap-1.5 text-sm">
              <Settings className="h-3.5 w-3.5" />
              ערוצים
            </TabsTrigger>
            <TabsTrigger value="wordpress" className="flex items-center gap-1.5 text-sm">
              <Globe className="h-3.5 w-3.5" />
              וורדפרס
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ── Gantt Tab ──────────────────────────────────────────── */}
        <TabsContent value="gantt" className="flex-1 overflow-hidden mt-0 flex flex-col">
          <SocialGanttHeader
            onNewPost={() => setIsNewPostOpen(true)}
            filterPlatform={filterPlatform}
            onFilterPlatform={setFilterPlatform}
            filterStatus={filterStatus}
            onFilterStatus={setFilterStatus}
            totalPosts={ganttPosts.length}
          />
          <div className="flex-1 flex overflow-hidden">
            <SocialGanttSidebar
              posts={filteredGanttPosts}
              selectedPostId={selectedPostId}
              onSelectPost={setSelectedPostId}
              isLoading={ganttLoading}
            />
            <SocialGanttPreview
              post={selectedPost}
              onUpdatePost={(updates) => updateGanttPost.mutate(updates)}
              onDeletePost={(id) => deleteGanttPost.mutate(id)}
              isUpdating={updateGanttPost.isPending}
              tenantId={tenantId}
            />
          </div>
          <NewPostDialog
            open={isNewPostOpen}
            onOpenChange={setIsNewPostOpen}
            onCreatePost={(post) => createGanttPost.mutate(post)}
            tenantId={tenantId || ""}
            isCreating={createGanttPost.isPending}
          />
        </TabsContent>

        {/* ── Posts Tab ──────────────────────────────────────────── */}
        <TabsContent value="posts" className="flex-1 overflow-auto mt-0 min-h-0 data-[state=active]:flex data-[state=active]:flex-col">
          <div className="flex items-center justify-between px-6 py-3 border-b shrink-0">
            <h2 className="text-base font-semibold">פוסטים מוכנים לפרסום</h2>
            <Button size="sm" onClick={() => setIsComposerOpen(true)}>
              <Plus className="h-4 w-4 ml-1" />
              פוסט חדש
            </Button>
          </div>
          <div className="p-6">
            <PostsList />
          </div>
          <Dialog open={isComposerOpen} onOpenChange={setIsComposerOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
              <DialogHeader>
                <DialogTitle>יצירת פוסט חדש</DialogTitle>
              </DialogHeader>
              <PostComposer onPostCreated={() => setIsComposerOpen(false)} />
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ── Calendar Tab ───────────────────────────────────────── */}
        <TabsContent value="calendar" className="m-0 h-[calc(100vh-4rem)] flex flex-col">
          <VisualPostCalendar />
        </TabsContent>

        {/* ── Channels Tab ───────────────────────────────────────── */}
        <TabsContent value="channels" className="flex-1 overflow-auto mt-0 p-6">
          <ChannelManager />
        </TabsContent>

        {/* ── WordPress Tab ──────────────────────────────────────── */}
        <TabsContent value="wordpress" className="flex-1 overflow-auto mt-0 p-6">
          <WordPressSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
