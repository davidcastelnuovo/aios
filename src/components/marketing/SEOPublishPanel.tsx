/**
 * SEOPublishPanel
 * Shown inside WorkItemSidePanel when the current stage is `target_seo`.
 * Lets the user pick a WordPress site and publish the article directly.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Loader2,
  CheckCircle2,
  ExternalLink,
  AlertTriangle,
  Globe,
  FileText,
  Tag,
  Send,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface WPSite {
  id: string;
  site_url: string;
  site_name?: string;
  username: string;
  app_password: string;
}

interface PublishResult {
  success: boolean;
  post_url?: string;
  post_id?: number;
  error?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  workItemId: string;
  tenantId: string;
  clientId: string;
  copyText?: string;
  title?: string;
}

export function SEOPublishPanel({
  workItemId,
  tenantId,
  clientId,
  copyText = "",
  title = "",
}: Props) {
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [postTitle, setPostTitle] = useState(title);
  const [postContent, setPostContent] = useState(copyText);
  const [postStatus, setPostStatus] = useState<"draft" | "publish">("draft");
  const [metaDescription, setMetaDescription] = useState("");
  const [focusKeyword, setFocusKeyword] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState<PublishResult | null>(null);

  // ─── Load WordPress sites ─────────────────────────────────────────────────

  const { data: sites = [], isLoading } = useQuery({
    queryKey: ["wp-sites", tenantId],
    queryFn: async () => {
      // Try client-specific sites first, then tenant-level
      const { data: clientSites } = await supabase
        .from("social_media_wordpress_sites")
        .select("id, site_url, site_name, username, app_password")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      return (clientSites ?? []) as WPSite[];
    },
  });

  // ─── Publish ──────────────────────────────────────────────────────────────

  const handlePublish = async () => {
    const site = sites.find((s) => s.id === selectedSiteId) ?? sites[0];
    if (!site) {
      toast.error("לא נמצא אתר WordPress מחובר");
      return;
    }
    if (!postTitle.trim()) {
      toast.error("נא להזין כותרת למאמר");
      return;
    }

    setPublishing(true);
    setResult(null);

    try {
      // Publish via WordPress REST API
      const credentials = btoa(`${site.username}:${site.app_password}`);
      const wpUrl = `${site.site_url.replace(/\/$/, "")}/wp-json/wp/v2/posts`;

      const body: Record<string, any> = {
        title: postTitle,
        content: postContent,
        status: postStatus,
      };

      // Add Yoast SEO meta if available
      if (metaDescription || focusKeyword) {
        body.meta = {
          ...(metaDescription ? { _yoast_wpseo_metadesc: metaDescription } : {}),
          ...(focusKeyword ? { _yoast_wpseo_focuskw: focusKeyword } : {}),
        };
      }

      const res = await fetch(wpUrl, {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`WordPress error ${res.status}: ${errText.slice(0, 200)}`);
      }

      const post = await res.json();

      // Save result to work item
      await supabase
        .from("marketing_work_items")
        .update({
          payload: {
            wp_post_id: post.id,
            wp_post_url: post.link,
            wp_site_id: site.id,
            wp_site_url: site.site_url,
            published_at: new Date().toISOString(),
            post_status: postStatus,
          },
          status: postStatus === "publish" ? "published" : "in_progress",
        })
        .eq("id", workItemId);

      setResult({ success: true, post_url: post.link, post_id: post.id });
      toast.success(
        postStatus === "publish" ? "המאמר פורסם בהצלחה!" : "הטיוטה נשמרה ב-WordPress"
      );
    } catch (err: any) {
      const msg = err.message ?? "שגיאה לא ידועה";
      setResult({ success: false, error: msg });
      toast.error(msg);
    } finally {
      setPublishing(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (result?.success) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-right" dir="rtl">
        <div className="flex items-center gap-2 text-emerald-700">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span className="font-semibold">
            {postStatus === "publish" ? "המאמר פורסם!" : "הטיוטה נשמרה!"}
          </span>
        </div>
        {result.post_url && (
          <a
            href={result.post_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 flex items-center gap-1 text-sm text-emerald-700 hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {result.post_url}
          </a>
        )}
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => setResult(null)}
        >
          פרסם מאמר נוסף
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border p-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100">
          <Search className="h-4 w-4 text-green-700" />
        </div>
        <div>
          <p className="text-sm font-semibold">פרסום SEO / GEO</p>
          <p className="text-xs text-muted-foreground">פרסם מאמר ישירות ל-WordPress</p>
        </div>
      </div>

      <Separator />

      {/* Site selector */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          טוען אתרים...
        </div>
      ) : sites.length === 0 ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            לא נמצא אתר WordPress מחובר. חבר אתר בהגדרות הסושיאל מדיה.
          </span>
        </div>
      ) : (
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">
            <Globe className="ml-1 inline h-3 w-3" />
            אתר WordPress
          </label>
          <Select
            value={selectedSiteId || (sites[0]?.id ?? "")}
            onValueChange={setSelectedSiteId}
          >
            <SelectTrigger>
              <SelectValue placeholder="בחר אתר..." />
            </SelectTrigger>
            <SelectContent>
              {sites.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.site_name ?? s.site_url}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Title */}
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">
          <FileText className="ml-1 inline h-3 w-3" />
          כותרת המאמר
        </label>
        <Input
          value={postTitle}
          onChange={(e) => setPostTitle(e.target.value)}
          placeholder="כותרת המאמר..."
        />
      </div>

      {/* Content */}
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">תוכן המאמר</label>
        <Textarea
          value={postContent}
          onChange={(e) => setPostContent(e.target.value)}
          placeholder="תוכן המאמר (HTML או טקסט)..."
          rows={6}
          className="font-mono text-xs"
        />
      </div>

      {/* SEO fields */}
      <div className="space-y-2 rounded-lg bg-muted/50 p-3">
        <p className="text-xs font-medium text-muted-foreground">
          <Tag className="ml-1 inline h-3 w-3" />
          הגדרות Yoast SEO (אופציונלי)
        </p>
        <Input
          value={focusKeyword}
          onChange={(e) => setFocusKeyword(e.target.value)}
          placeholder="מילת מפתח ראשית..."
          className="h-8 text-xs"
        />
        <Textarea
          value={metaDescription}
          onChange={(e) => setMetaDescription(e.target.value)}
          placeholder="Meta description (עד 160 תווים)..."
          rows={2}
          className="text-xs"
          maxLength={160}
        />
        {metaDescription && (
          <p className="text-right text-[10px] text-muted-foreground">
            {metaDescription.length}/160
          </p>
        )}
      </div>

      {/* Status + publish button */}
      <div className="flex gap-2">
        <Select value={postStatus} onValueChange={(v: any) => setPostStatus(v)}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="draft">שמור כטיוטה</SelectItem>
            <SelectItem value="publish">פרסם עכשיו</SelectItem>
          </SelectContent>
        </Select>
        <Button
          className="flex-1 gap-2"
          onClick={handlePublish}
          disabled={publishing || sites.length === 0}
        >
          {publishing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {publishing
            ? "מפרסם..."
            : postStatus === "publish"
            ? "פרסם ב-WordPress"
            : "שמור טיוטה"}
        </Button>
      </div>
    </div>
  );
}
