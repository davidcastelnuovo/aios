import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { SocialGanttSidebar } from "@/components/social-gantt/SocialGanttSidebar";
import { SocialGanttPreview } from "@/components/social-gantt/SocialGanttPreview";
import { SocialGanttHeader } from "@/components/social-gantt/SocialGanttHeader";
import { NewPostDialog } from "@/components/social-gantt/NewPostDialog";
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

export default function SocialGantt() {
  const { tenantId } = useCurrentTenant();
  const queryClient = useQueryClient();
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [isNewPostOpen, setIsNewPostOpen] = useState(false);
  const [filterPlatform, setFilterPlatform] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const { data: posts = [], isLoading } = useQuery({
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

  const updatePost = useMutation({
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
    onError: () => {
      toast.error("שגיאה בעדכון הפוסט");
    },
  });

  const createPost = useMutation({
    mutationFn: async (newPost: Omit<SocialPost, "id" | "created_at" | "updated_at">) => {
      const { error } = await (supabase as any).from("social_gantt_posts").insert(newPost);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social-gantt-posts"] });
      setIsNewPostOpen(false);
      toast.success("פוסט חדש נוצר");
    },
    onError: () => {
      toast.error("שגיאה ביצירת הפוסט");
    },
  });

  const deletePost = useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await supabase
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

  const selectedPost = posts.find((p) => p.id === selectedPostId) || null;

  const filteredPosts = posts.filter((post) => {
    if (filterPlatform !== "all" && post.platform !== filterPlatform) return false;
    if (filterStatus !== "all" && post.status !== filterStatus) return false;
    return true;
  });

  return (
    <div className="h-full flex flex-col">
      <SocialGanttHeader
        onNewPost={() => setIsNewPostOpen(true)}
        filterPlatform={filterPlatform}
        onFilterPlatform={setFilterPlatform}
        filterStatus={filterStatus}
        onFilterStatus={setFilterStatus}
        totalPosts={posts.length}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Right side - Topics & Dates list */}
        <SocialGanttSidebar
          posts={filteredPosts}
          selectedPostId={selectedPostId}
          onSelectPost={setSelectedPostId}
          isLoading={isLoading}
        />

        {/* Left side - Creative & Copy preview */}
        <SocialGanttPreview
          post={selectedPost}
          onUpdatePost={(updates) => updatePost.mutate(updates)}
          onDeletePost={(id) => deletePost.mutate(id)}
          isUpdating={updatePost.isPending}
          tenantId={tenantId}
        />
      </div>

      <NewPostDialog
        open={isNewPostOpen}
        onOpenChange={setIsNewPostOpen}
        onCreatePost={(post) => createPost.mutate(post)}
        tenantId={tenantId || ""}
        isCreating={createPost.isPending}
      />
    </div>
  );
}
