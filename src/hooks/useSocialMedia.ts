import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";

export interface SocialMediaChannel {
  id: string;
  tenant_id: string;
  platform: "facebook" | "instagram" | "linkedin" | "youtube";
  channel_name: string;
  channel_id: string | null;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  avatar_url: string | null;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SocialMediaPost {
  id: string;
  tenant_id: string;
  created_by: string | null;
  title: string | null;
  content: string;
  media_urls: string[];
  post_type: "text" | "image" | "video" | "carousel" | "story" | "reel";
  status: "draft" | "scheduled" | "publishing" | "published" | "failed" | "cancelled";
  scheduled_at: string | null;
  published_at: string | null;
  wordpress_post_id: string | null;
  wordpress_site_url: string | null;
  publish_to_wordpress: boolean;
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SocialMediaPostChannel {
  id: string;
  post_id: string;
  channel_id: string;
  platform_post_id: string | null;
  status: "pending" | "publishing" | "published" | "failed";
  error_message: string | null;
  published_at: string | null;
  created_at: string;
}

export interface WordPressSite {
  id: string;
  tenant_id: string;
  site_url: string;
  username: string;
  app_password: string;
  site_name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Channels
export function useSocialMediaChannels() {
  const { tenantId } = useCurrentTenant();

  return useQuery({
    queryKey: ["social-media-channels", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("social_media_channels" as any)
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as SocialMediaChannel[];
    },
    enabled: !!tenantId,
  });
}

export function useCreateChannel() {
  const { tenantId } = useCurrentTenant();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (channel: {
      platform: SocialMediaChannel["platform"];
      channel_name: string;
      channel_id?: string;
      access_token?: string;
      refresh_token?: string;
      avatar_url?: string;
    }) => {
      if (!tenantId) throw new Error("No tenant");
      const { data, error } = await supabase
        .from("social_media_channels" as any)
        .insert({ ...channel, tenant_id: tenantId })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as SocialMediaChannel;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social-media-channels", tenantId] });
      toast.success("ערוץ נוסף בהצלחה");
    },
    onError: (error: Error) => {
      toast.error("שגיאה בהוספת ערוץ: " + error.message);
    },
  });
}

export function useDeleteChannel() {
  const { tenantId } = useCurrentTenant();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (channelId: string) => {
      const { error } = await supabase
        .from("social_media_channels" as any)
        .delete()
        .eq("id", channelId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social-media-channels", tenantId] });
      toast.success("ערוץ נמחק בהצלחה");
    },
    onError: (error: Error) => {
      toast.error("שגיאה במחיקת ערוץ: " + error.message);
    },
  });
}

// Posts
export function useSocialMediaPosts(statusFilter?: string) {
  const { tenantId } = useCurrentTenant();

  return useQuery({
    queryKey: ["social-media-posts", tenantId, statusFilter],
    queryFn: async () => {
      if (!tenantId) return [];
      let query = supabase
        .from("social_media_posts" as any)
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (statusFilter) {
        query = query.eq("status", statusFilter);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as SocialMediaPost[];
    },
    enabled: !!tenantId,
  });
}

export function usePostChannels(postId: string) {
  return useQuery({
    queryKey: ["social-media-post-channels", postId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("social_media_post_channels" as any)
        .select("*")
        .eq("post_id", postId);
      if (error) throw error;
      return (data || []) as unknown as SocialMediaPostChannel[];
    },
    enabled: !!postId,
  });
}

export function useCreatePost() {
  const { tenantId } = useCurrentTenant();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      title?: string;
      content: string;
      media_urls?: string[];
      post_type?: SocialMediaPost["post_type"];
      status: SocialMediaPost["status"];
      scheduled_at?: string;
      publish_to_wordpress?: boolean;
      wordpress_site_url?: string;
      channel_ids: string[];
    }) => {
      if (!tenantId) throw new Error("No tenant");
      const { channel_ids, ...postData } = params;

      const { data: post, error: postError } = await supabase
        .from("social_media_posts" as any)
        .insert({
          ...postData,
          tenant_id: tenantId,
          created_by: user?.id,
        })
        .select()
        .single();
      if (postError) throw postError;

      const typedPost = post as unknown as SocialMediaPost;

      if (channel_ids.length > 0) {
        const channelRecords = channel_ids.map((channel_id) => ({
          post_id: typedPost.id,
          channel_id,
        }));
        const { error: channelError } = await supabase
          .from("social_media_post_channels" as any)
          .insert(channelRecords);
        if (channelError) throw channelError;
      }

      return typedPost;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social-media-posts", tenantId] });
      toast.success("פוסט נוצר בהצלחה");
    },
    onError: (error: Error) => {
      toast.error("שגיאה ביצירת פוסט: " + error.message);
    },
  });
}

export function useUpdatePostStatus() {
  const { tenantId } = useCurrentTenant();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ postId, status }: { postId: string; status: SocialMediaPost["status"] }) => {
      const { error } = await supabase
        .from("social_media_posts" as any)
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", postId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social-media-posts", tenantId] });
    },
  });
}

export function useDeletePost() {
  const { tenantId } = useCurrentTenant();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await supabase
        .from("social_media_posts" as any)
        .delete()
        .eq("id", postId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social-media-posts", tenantId] });
      toast.success("פוסט נמחק בהצלחה");
    },
    onError: (error: Error) => {
      toast.error("שגיאה במחיקת פוסט: " + error.message);
    },
  });
}

// WordPress Sites
export function useWordPressSites() {
  const { tenantId } = useCurrentTenant();

  return useQuery({
    queryKey: ["wordpress-sites", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("social_media_wordpress_sites" as any)
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as WordPressSite[];
    },
    enabled: !!tenantId,
  });
}

export function useCreateWordPressSite() {
  const { tenantId } = useCurrentTenant();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (site: {
      site_url: string;
      username: string;
      app_password: string;
      site_name?: string;
    }) => {
      if (!tenantId) throw new Error("No tenant");
      const { data, error } = await supabase
        .from("social_media_wordpress_sites" as any)
        .insert({ ...site, tenant_id: tenantId })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as WordPressSite;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wordpress-sites", tenantId] });
      toast.success("אתר וורדפרס נוסף בהצלחה");
    },
    onError: (error: Error) => {
      toast.error("שגיאה בהוספת אתר: " + error.message);
    },
  });
}

export function useDeleteWordPressSite() {
  const { tenantId } = useCurrentTenant();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (siteId: string) => {
      const { error } = await supabase
        .from("social_media_wordpress_sites" as any)
        .delete()
        .eq("id", siteId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wordpress-sites", tenantId] });
      toast.success("אתר וורדפרס נמחק בהצלחה");
    },
    onError: (error: Error) => {
      toast.error("שגיאה במחיקת אתר: " + error.message);
    },
  });
}

// Publish action
export function usePublishPost() {
  const queryClient = useQueryClient();
  const { tenantId } = useCurrentTenant();

  return useMutation({
    mutationFn: async (postId: string) => {
      const { data, error } = await supabase.functions.invoke("social-media-publish", {
        body: { post_id: postId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social-media-posts", tenantId] });
      toast.success("הפוסט נשלח לפרסום");
    },
    onError: (error: Error) => {
      toast.error("שגיאה בפרסום: " + error.message);
    },
  });
}
