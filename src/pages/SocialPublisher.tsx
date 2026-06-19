import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { toast } from "sonner";
import { Loader2, Send, Image as ImageIcon, Film, RefreshCw, EyeOff, MessageSquare, Check, ChevronsUpDown } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { he } from "date-fns/locale";
import { cn } from "@/lib/utils";

type Page = {
  id: string;
  platform: "facebook" | "instagram";
  page_id: string;
  page_name: string;
  picture_url: string | null;
};

type Comment = {
  id: string;
  platform: string;
  author_name: string;
  message: string;
  external_post_id: string | null;
  replied_at: string | null;
  hidden_at: string | null;
  created_at_external: string | null;
  page_id: string;
};

const POST_TYPES = [
  { value: "post", label: "פוסט טקסט" },
  { value: "photo", label: "תמונה" },
  { value: "video", label: "וידאו" },
  { value: "reel", label: "Reel" },
  { value: "story", label: "Story" },
  { value: "link", label: "קישור" },
];

function PageSearchableSelect({
  value,
  onChange,
  pages,
  placeholder = "בחר עמוד...",
  allowAll = false,
}: {
  value: string;
  onChange: (val: string) => void;
  pages: Page[];
  placeholder?: string;
  allowAll?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = pages.find((p) => p.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {value === "all" && allowAll
            ? "כל העמודים"
            : selected
              ? `${selected.platform === "instagram" ? "📷" : "📘"} ${selected.page_name}`
              : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput placeholder="חפש עמוד..." className="h-9" />
          <CommandList>
            <CommandEmpty>לא נמצאו עמודים</CommandEmpty>
            <CommandGroup>
              {allowAll && (
                <CommandItem
                  value="all"
                  onSelect={() => { onChange("all"); setOpen(false); }}
                >
                  <Check className={cn("ml-2 h-4 w-4", value === "all" ? "opacity-100" : "opacity-0")} />
                  כל העמודים
                </CommandItem>
              )}
              {pages.map((p) => (
                <CommandItem
                  key={p.id}
                  value={p.page_name}
                  onSelect={() => { onChange(p.id); setOpen(false); }}
                >
                  <Check className={cn("ml-2 h-4 w-4", value === p.id ? "opacity-100" : "opacity-0")} />
                  {p.platform === "instagram" ? "📷" : "📘"} {p.page_name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default function SocialPublisher() {
  const { tenant } = useCurrentTenant();
  const [pages, setPages] = useState<Page[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Composer state
  const [pageId, setPageId] = useState("");
  const [postType, setPostType] = useState("post");
  const [caption, setCaption] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [link, setLink] = useState("");
  const [uploading, setUploading] = useState(false);

  // Reply state
  const [replyForId, setReplyForId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  const load = async () => {
    if (!tenant?.id) return;
    setLoading(true);
    const [{ data: p }, { data: c }] = await Promise.all([
      supabase.from("social_pages").select("id, platform, page_id, page_name, picture_url").eq("tenant_id", tenant.id).eq("is_active", true).order("page_name"),
      supabase.from("social_comments").select("id, platform, author_name, message, external_post_id, replied_at, hidden_at, created_at_external, page_id").eq("tenant_id", tenant.id).eq("is_from_page", false).is("hidden_at", null).order("created_at_external", { ascending: false, nullsFirst: false }).limit(100),
    ]);
    setPages((p || []) as Page[]);
    setComments((c || []) as Comment[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [tenant?.id]);

  useEffect(() => {
    if (!tenant?.id) return;
    const ch = supabase.channel("social_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "social_comments", filter: `tenant_id=eq.${tenant.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tenant?.id]);

  const syncPages = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("social-pages-sync", { body: { tenant_id: tenant?.id } });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
      toast.success(`סונכרנו ${(data as any).count} עמודים`);
      load();
    } catch (e: any) { toast.error(e.message); } finally { setSyncing(false); }
  };

  const fetchComments = async () => {
    if (!pageId) { toast.error("בחר עמוד קודם"); return; }
    setBusyId("fetch");
    try {
      const { data, error } = await supabase.functions.invoke("social-comments", {
        body: { action: "fetch", tenant_id: tenant?.id, page_id: pageId },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
      toast.success(`נמשכו ${(data as any).fetched} תגובות`);
      load();
    } catch (e: any) { toast.error(e.message); } finally { setBusyId(null); }
  };

  const onUploadFile = async (file: File) => {
    if (!tenant?.id) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${tenant.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("social-media").upload(path, file);
      if (error) throw error;
      const { data: signed } = await supabase.storage.from("social-media").createSignedUrl(path, 60 * 60 * 24 * 7);
      if (signed?.signedUrl) {
        setMediaUrl(signed.signedUrl);
        toast.success("המדיה הועלתה");
      }
    } catch (e: any) { toast.error(e.message); } finally { setUploading(false); }
  };

  const publish = async () => {
    if (!pageId || !postType) { toast.error("בחר עמוד וסוג פוסט"); return; }
    if (["photo", "video", "reel", "story"].includes(postType) && !mediaUrl) {
      toast.error("חסרה מדיה"); return;
    }
    setPublishing(true);
    try {
      const { data, error } = await supabase.functions.invoke("social-publish", {
        body: { tenant_id: tenant?.id, page_id: pageId, post_type: postType, caption, media_url: mediaUrl, link },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || (data as any)?.message || error?.message);
      toast.success("פורסם בהצלחה ✨");
      setCaption(""); setMediaUrl(""); setLink("");
    } catch (e: any) { toast.error(e.message); } finally { setPublishing(false); }
  };

  const reply = async (commentId: string) => {
    if (!replyText.trim()) return;
    setBusyId(commentId);
    try {
      const { data, error } = await supabase.functions.invoke("social-comments", {
        body: { action: "reply", tenant_id: tenant?.id, comment_row_id: commentId, message: replyText },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
      toast.success("נשלחה תגובה");
      setReplyForId(null); setReplyText(""); load();
    } catch (e: any) { toast.error(e.message); } finally { setBusyId(null); }
  };

  const hideComment = async (commentId: string) => {
    setBusyId(commentId);
    try {
      const { data, error } = await supabase.functions.invoke("social-comments", {
        body: { action: "hide", tenant_id: tenant?.id, comment_row_id: commentId },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
      toast.success("התגובה הוסתרה"); load();
    } catch (e: any) { toast.error(e.message); } finally { setBusyId(null); }
  };

  const selectedPage = pages.find((p) => p.id === pageId);

  return (
    <div className="p-6 space-y-4 max-w-6xl mx-auto" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">ניהול רשתות חברתיות</h1>
          <p className="text-sm text-muted-foreground">פרסום פוסטים, Reels וסטוריס + מענה לתגובות בפייסבוק ואינסטגרם</p>
        </div>
        <Button variant="outline" onClick={syncPages} disabled={syncing}>
          {syncing ? <Loader2 className="ms-2 h-4 w-4 animate-spin" /> : <RefreshCw className="ms-2 h-4 w-4" />}
          סנכרן עמודים
        </Button>
      </div>

      {pages.length === 0 && !loading && (
        <Card className="p-6 text-center">
          <p className="mb-3">אין עמודים מחוברים. הקלק "סנכרן עמודים" כדי למשוך אותם מפייסבוק.</p>
          <p className="text-sm text-muted-foreground">אם זה החיבור הראשון — חבר את פייסבוק ב-Lead Integrations וחזור.</p>
        </Card>
      )}

      <Tabs defaultValue="compose">
        <TabsList>
          <TabsTrigger value="compose"><Send className="ms-2 h-4 w-4" />פרסום</TabsTrigger>
          <TabsTrigger value="comments">
            <MessageSquare className="ms-2 h-4 w-4" />תגובות
            {comments.filter((c) => !c.replied_at).length > 0 && (
              <Badge variant="destructive" className="ms-2">{comments.filter((c) => !c.replied_at).length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* COMPOSE */}
        <TabsContent value="compose" className="space-y-4">
          <Card className="p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">עמוד יעד</label>
                <PageSearchableSelect
                  value={pageId}
                  onChange={setPageId}
                  pages={pages}
                  placeholder="בחר עמוד..."
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">סוג פוסט</label>
                <Select value={postType} onValueChange={setPostType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {POST_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">טקסט / Caption</label>
              <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={4} placeholder="כתוב את התוכן..." />
            </div>

            {(postType === "photo" || postType === "video" || postType === "reel" || postType === "story") && (
              <div>
                <label className="text-sm font-medium mb-1 block">מדיה</label>
                <div className="flex gap-2 items-center">
                  <Input value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} placeholder="URL ציבורי או העלה קובץ..." />
                  <input ref={fileInputRef} type="file" hidden accept="image/*,video/*"
                    onChange={(e) => e.target.files?.[0] && onUploadFile(e.target.files[0])} />
                  <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> :
                      postType === "video" || postType === "reel" ? <Film className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            )}

            {postType === "link" && (
              <div>
                <label className="text-sm font-medium mb-1 block">לינק</label>
                <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://..." />
              </div>
            )}

            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {selectedPage ? `מפרסם ל: ${selectedPage.page_name} (${selectedPage.platform})` : ""}
              </p>
              <Button onClick={publish} disabled={publishing || !pageId}>
                {publishing ? <Loader2 className="ms-2 h-4 w-4 animate-spin" /> : <Send className="ms-2 h-4 w-4" />}
                פרסם
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* COMMENTS */}
        <TabsContent value="comments" className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="w-72">
              <PageSearchableSelect
                value={pageId || "all"}
                onChange={setPageId}
                pages={pages}
                placeholder="עמוד לסינון"
                allowAll
              />
            </div>
            <Button variant="outline" onClick={fetchComments} disabled={busyId === "fetch"}>
              {busyId === "fetch" ? <Loader2 className="ms-2 h-4 w-4 animate-spin" /> : <RefreshCw className="ms-2 h-4 w-4" />}
              משוך תגובות חדשות
            </Button>
          </div>

          {comments.length === 0 ? (
            <Card className="p-6 text-center text-muted-foreground">אין תגובות שלא טופלו</Card>
          ) : (
            comments
              .filter((c) => !pageId || pageId === "all" || c.page_id === pageId)
              .map((c) => (
                <Card key={c.id} className={`p-4 ${c.replied_at ? "opacity-60" : ""}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold">{c.author_name}</span>
                        <Badge variant="outline" className="text-xs">{c.platform}</Badge>
                        {c.replied_at && <Badge variant="secondary" className="text-xs">✓ נענה</Badge>}
                        {c.created_at_external && (
                          <span className="text-xs text-muted-foreground">
                            לפני {formatDistanceToNow(new Date(c.created_at_external), { locale: he })}
                          </span>
                        )}
                      </div>
                      <p className="text-sm">{c.message}</p>

                      {replyForId === c.id ? (
                        <div className="mt-3 flex gap-2">
                          <Input value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="כתוב תגובה..." autoFocus />
                          <Button size="sm" onClick={() => reply(c.id)} disabled={busyId === c.id}>
                            {busyId === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "שלח"}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => { setReplyForId(null); setReplyText(""); }}>בטל</Button>
                        </div>
                      ) : !c.replied_at && (
                        <div className="mt-2 flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => setReplyForId(c.id)}>
                            <MessageSquare className="ms-1 h-3 w-3" />הגב
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => hideComment(c.id)} disabled={busyId === c.id}>
                            <EyeOff className="ms-1 h-3 w-3" />הסתר
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
