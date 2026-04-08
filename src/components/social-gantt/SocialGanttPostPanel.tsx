/**
 * SocialGanttPostPanel — Enhanced post detail panel
 * Replaces SocialGanttPreview with:
 *   - 2 text option cards (copy_text + copy_text_alt)
 *   - Media upload + gallery
 *   - Colored notes (4 highlight colors)
 *   - Inline emoji picker
 *   - Status selector + delete
 *   - Creative Agent + Copy Agent tabs (preserved from original)
 */

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Sparkles, PenLine, Image, Trash2, Save, MessageSquare, X,
  Copy, Check, Smile, Plus, Upload, RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CreativeAgent } from "./CreativeAgent";
import { CopyAgent } from "./CopyAgent";
import type { SocialPost } from "@/pages/SocialDashboard";

// ─── Types ─────────────────────────────────────────────────────────────────
interface SocialGanttPostPanelProps {
  post: SocialPost | null;
  onUpdatePost: (updates: Partial<SocialPost> & { id: string }) => void;
  onDeletePost: (id: string) => void;
  isUpdating: boolean;
  tenantId: string | null;
}

// ─── Emoji picker (lightweight, no external dep) ──────────────────────────
const EMOJI_GROUPS = [
  { label: "נפוצים", emojis: ["😊","🎯","🚀","💡","✅","⭐","🔥","💪","🎉","👍","❤️","🌟","💎","🏆","📱","💻","🌍","🎓","🔑","💰"] },
  { label: "פנים", emojis: ["😀","😃","😄","😁","😆","😅","🤣","😂","🙂","🙃","😉","😊","😇","🥰","😍","🤩","😘","😗","😚","😙"] },
  { label: "ידיים", emojis: ["👋","🤚","✋","🖖","👌","🤌","🤏","✌️","🤞","🤟","🤘","🤙","👈","👉","👆","👇","☝️","👍","👎","✊"] },
  { label: "סמלים", emojis: ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❣️","💕","💞","💓","💗","💖","💘","💝","💟","☮️"] },
  { label: "עסקים", emojis: ["📊","📈","📉","💹","💼","🗂️","📋","📌","📍","🗓️","⏰","🔔","📢","📣","💬","📧","📞","🖥️","⌨️","🖱️"] },
];

function EmojiPicker({ onSelect, onClose }: { onSelect: (e: string) => void; onClose: () => void }) {
  const [activeGroup, setActiveGroup] = useState(0);
  return (
    <div className="w-72 p-2" dir="rtl">
      <div className="flex gap-1 mb-2 flex-wrap">
        {EMOJI_GROUPS.map((g, i) => (
          <button
            key={g.label}
            onClick={() => setActiveGroup(i)}
            className={cn("text-xs px-2 py-0.5 rounded-full transition-colors",
              activeGroup === i ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
            )}
          >
            {g.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-10 gap-0.5">
        {EMOJI_GROUPS[activeGroup].emojis.map((emoji) => (
          <button
            key={emoji}
            onClick={() => { onSelect(emoji); onClose(); }}
            className="text-lg p-1 hover:bg-muted rounded transition-colors"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Editable text block with emoji support ────────────────────────────────
function EditableTextBlock({
  label, badgeLabel, badgeClass, value, onChange, onSave, onCancel, isEditing, onStartEdit,
}: {
  label: string; badgeLabel: string; badgeClass: string;
  value: string; onChange: (v: string) => void;
  onSave: () => void; onCancel: () => void;
  isEditing: boolean; onStartEdit: () => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [copied, setCopied] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);

  const insertEmoji = (emoji: string) => {
    const el = textareaRef.current;
    if (!el) { onChange(value + emoji); return; }
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const next = value.slice(0, start) + emoji + value.slice(end);
    onChange(next);
    setTimeout(() => { el.setSelectionRange(start + emoji.length, start + emoji.length); el.focus(); }, 0);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    toast.success("הטקסט הועתק");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn("rounded-lg border-2 p-4 space-y-3 transition-colors", isEditing ? "border-primary/50 bg-primary/5" : "border-border bg-card")}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {!isEditing && (
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onStartEdit}>
              <PenLine className="h-3 w-3 me-1" />
              ערוך
            </Button>
          )}
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={handleCopy}>
            {copied ? <Check className="h-3 w-3 me-1 text-green-500" /> : <Copy className="h-3 w-3 me-1" />}
            העתק
          </Button>
        </div>
        <span className={cn("text-xs font-semibold px-2.5 py-0.5 rounded-full", badgeClass)}>
          {badgeLabel}
        </span>
      </div>

      {/* Content */}
      {isEditing ? (
        <div className="space-y-2">
          <div className="relative">
            <Textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              rows={5}
              className="text-right resize-none pe-8"
              dir="rtl"
              placeholder={`כתוב ${label} כאן...`}
            />
            <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="absolute top-1 left-1 h-6 w-6 opacity-60 hover:opacity-100">
                  <Smile className="h-3.5 w-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-auto" align="start">
                <EmojiPicker onSelect={insertEmoji} onClose={() => setEmojiOpen(false)} />
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={onSave} className="h-7 text-xs">
              <Save className="h-3 w-3 me-1" />
              שמור
            </Button>
            <Button size="sm" variant="ghost" onClick={onCancel} className="h-7 text-xs">
              ביטול
            </Button>
          </div>
        </div>
      ) : (
        <div className="whitespace-pre-wrap text-sm leading-relaxed text-right min-h-[60px]" dir="rtl">
          {value || <span className="text-muted-foreground italic">אין טקסט עדיין</span>}
        </div>
      )}
    </div>
  );
}

// ─── Note colors ───────────────────────────────────────────────────────────
const NOTE_COLORS = [
  { id: "yellow", label: "צהוב", bg: "bg-yellow-100 dark:bg-yellow-900/30", border: "border-yellow-400", dot: "bg-yellow-400" },
  { id: "blue",   label: "כחול", bg: "bg-blue-100 dark:bg-blue-900/30",   border: "border-blue-400",   dot: "bg-blue-400"   },
  { id: "green",  label: "ירוק", bg: "bg-green-100 dark:bg-green-900/30", border: "border-green-400",  dot: "bg-green-400"  },
  { id: "pink",   label: "ורוד", bg: "bg-pink-100 dark:bg-pink-900/30",   border: "border-pink-400",   dot: "bg-pink-400"   },
];

// ─── Status options ────────────────────────────────────────────────────────
const statusOptions = [
  { value: "draft",     label: "טיוטה" },
  { value: "in_review", label: "בבדיקה" },
  { value: "approved",  label: "מאושר" },
  { value: "published", label: "פורסם" },
  { value: "rejected",  label: "נדחה" },
];

// ─── Main component ────────────────────────────────────────────────────────
export function SocialGanttPostPanel({ post, onUpdatePost, onDeletePost, isUpdating, tenantId }: SocialGanttPostPanelProps) {
  const [activeTab, setActiveTab] = useState("preview");

  // Text editing state
  const [editingCopy1, setEditingCopy1] = useState(false);
  const [copy1Draft, setCopy1Draft] = useState("");
  const [editingCopy2, setEditingCopy2] = useState(false);
  const [copy2Draft, setCopy2Draft] = useState("");

  // Notes state
  const [noteColor, setNoteColor] = useState("yellow");
  const [noteText, setNoteText] = useState("");

  // Media upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const startEditCopy1 = () => { setCopy1Draft(post?.copy_text || ""); setEditingCopy1(true); };
  const saveCopy1 = () => { onUpdatePost({ id: post!.id, copy_text: copy1Draft }); setEditingCopy1(false); };
  const cancelCopy1 = () => setEditingCopy1(false);

  // copy_text_alt stored in copy_prompt field (re-using existing column)
  const startEditCopy2 = () => { setCopy2Draft(post?.copy_prompt || ""); setEditingCopy2(true); };
  const saveCopy2 = () => { onUpdatePost({ id: post!.id, copy_prompt: copy2Draft }); setEditingCopy2(false); };
  const cancelCopy2 = () => setEditingCopy2(false);

  const saveNote = () => {
    if (!noteText.trim() || !post) return;
    const existing = post.notes ? JSON.parse(post.notes) : [];
    const updated = [...existing, { id: Date.now(), text: noteText.trim(), color: noteColor }];
    onUpdatePost({ id: post.id, notes: JSON.stringify(updated) });
    setNoteText("");
    toast.success("הערה נוספה");
  };

  const deleteNote = (noteId: number) => {
    if (!post) return;
    const existing = post.notes ? JSON.parse(post.notes) : [];
    const updated = existing.filter((n: any) => n.id !== noteId);
    onUpdatePost({ id: post.id, notes: JSON.stringify(updated) });
  };

  const parsedNotes = (() => {
    if (!post?.notes) return [];
    try { return JSON.parse(post.notes); } catch { return []; }
  })();

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !post) return;
    setUploadingMedia(true);
    try {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        onUpdatePost({ id: post.id, creative_url: dataUrl });
        toast.success("תמונה הועלתה");
        setUploadingMedia(false);
      };
      reader.readAsDataURL(file);
    } catch {
      toast.error("שגיאה בהעלאת הקובץ");
      setUploadingMedia(false);
    }
    e.target.value = "";
  }, [post, onUpdatePost]);

  // ── Empty state ───────────────────────────────────────────────────────────
  if (!post) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center space-y-2">
          <MessageSquare className="h-12 w-12 mx-auto opacity-20" />
          <p className="text-base font-medium">בחר פרסום מהגאנט</p>
          <p className="text-sm">לחץ על שורה כדי לפתוח את הפרטים</p>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="w-[400px] shrink-0 flex flex-col border-s bg-background overflow-hidden">
      <ScrollArea className="flex-1">
        <div className="p-5 space-y-5" dir="rtl">

          {/* ── Post header ── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent dir="rtl">
                  <AlertDialogHeader>
                    <AlertDialogTitle>מחיקת פוסט</AlertDialogTitle>
                    <AlertDialogDescription>האם למחוק את "{post.topic}"?</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>ביטול</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onDeletePost(post.id)}>מחק</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <Select value={post.status} onValueChange={(v) => onUpdatePost({ id: post.id, status: v as SocialPost["status"] })}>
                <SelectTrigger className="w-[110px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((s) => (
                    <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="text-right">
              <h2 className="text-lg font-bold leading-tight">{post.topic}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{post.platform} · {post.scheduled_date}</p>
            </div>
          </div>

          {/* ── Tabs ── */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full h-8">
              <TabsTrigger value="preview" className="flex-1 text-xs gap-1">
                <PenLine className="h-3 w-3" />
                תוכן
              </TabsTrigger>
              <TabsTrigger value="creative-agent" className="flex-1 text-xs gap-1">
                <Sparkles className="h-3 w-3" />
                קריאייטיב
              </TabsTrigger>
              <TabsTrigger value="copy-agent" className="flex-1 text-xs gap-1">
                <PenLine className="h-3 w-3" />
                קופי AI
              </TabsTrigger>
            </TabsList>

            {/* ── Preview tab ── */}
            <TabsContent value="preview" className="space-y-4 mt-4">

              {/* Media */}
              <Card>
                <CardHeader className="pb-2 pt-3 px-4">
                  <div className="flex items-center justify-between">
                    <div className="flex gap-1.5">
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => fileInputRef.current?.click()} disabled={uploadingMedia}>
                        <Upload className="h-3 w-3 me-1" />
                        {uploadingMedia ? "מעלה..." : "העלה"}
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setActiveTab("creative-agent")}>
                        <Sparkles className="h-3 w-3 me-1" />
                        AI
                      </Button>
                      {post.creative_url && (
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => onUpdatePost({ id: post.id, creative_url: null })}>
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    <CardTitle className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                      <Image className="h-3.5 w-3.5" />
                      קריאייטיב
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFileUpload} />
                  {post.creative_url ? (
                    <div className="rounded-lg overflow-hidden border">
                      {post.creative_url.startsWith("data:video") || post.creative_url.endsWith(".mp4") ? (
                        <video src={post.creative_url} controls className="w-full max-h-[280px]" />
                      ) : (
                        <img src={post.creative_url} alt={post.topic} className="w-full h-auto max-h-[280px] object-contain" />
                      )}
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/30 h-[140px] flex items-center justify-center cursor-pointer hover:border-primary/40 transition-colors"
                    >
                      <div className="text-center space-y-1">
                        <Upload className="h-8 w-8 mx-auto text-muted-foreground/40" />
                        <p className="text-xs text-muted-foreground">לחץ להעלאה או השתמש ב-AI</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Text options */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-right flex items-center gap-2 justify-end">
                  <PenLine className="h-3.5 w-3.5" />
                  חלופות טקסט
                </h3>

                <EditableTextBlock
                  label="אופציה 1"
                  badgeLabel="אופציה 1"
                  badgeClass="bg-primary/15 text-primary"
                  value={editingCopy1 ? copy1Draft : (post.copy_text || "")}
                  onChange={setCopy1Draft}
                  onSave={saveCopy1}
                  onCancel={cancelCopy1}
                  isEditing={editingCopy1}
                  onStartEdit={startEditCopy1}
                />

                <EditableTextBlock
                  label="אופציה 2"
                  badgeLabel="אופציה 2"
                  badgeClass="bg-accent/20 text-accent-foreground"
                  value={editingCopy2 ? copy2Draft : (post.copy_prompt || "")}
                  onChange={setCopy2Draft}
                  onSave={saveCopy2}
                  onCancel={cancelCopy2}
                  isEditing={editingCopy2}
                  onStartEdit={startEditCopy2}
                />
              </div>

              {/* Notes */}
              <Card>
                <CardHeader className="pb-2 pt-3 px-4">
                  <CardTitle className="text-xs font-semibold text-muted-foreground">הערות</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-3">
                  {/* Existing notes */}
                  {parsedNotes.length > 0 && (
                    <div className="space-y-2">
                      {parsedNotes.map((note: any) => {
                        const color = NOTE_COLORS.find((c) => c.id === note.color) || NOTE_COLORS[0];
                        return (
                          <div key={note.id} className={cn("flex items-start gap-2 rounded-lg border-r-4 px-3 py-2", color.bg, color.border)}>
                            <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0 mt-0.5 opacity-50 hover:opacity-100" onClick={() => deleteNote(note.id)}>
                              <X className="h-3 w-3" />
                            </Button>
                            <p className="text-sm leading-relaxed text-right flex-1" dir="rtl">{note.text}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* New note input */}
                  <div className="space-y-2">
                    <div className="flex gap-1.5 justify-end">
                      {NOTE_COLORS.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => setNoteColor(c.id)}
                          className={cn("w-5 h-5 rounded-full transition-transform", c.dot, noteColor === c.id && "ring-2 ring-offset-1 ring-foreground scale-110")}
                          title={c.label}
                        />
                      ))}
                    </div>
                    <div className="relative">
                      <Textarea
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        placeholder="הוסף הערה..."
                        rows={2}
                        dir="rtl"
                        className="text-right text-sm resize-none"
                        onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) saveNote(); }}
                      />
                    </div>
                    <Button size="sm" className="w-full h-7 text-xs" onClick={saveNote} disabled={!noteText.trim()}>
                      <Plus className="h-3 w-3 me-1" />
                      הוסף הערה
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Creative Agent tab ── */}
            <TabsContent value="creative-agent" className="mt-4">
              <CreativeAgent post={post} onUpdatePost={onUpdatePost} onBack={() => setActiveTab("preview")} tenantId={tenantId} />
            </TabsContent>

            {/* ── Copy Agent tab ── */}
            <TabsContent value="copy-agent" className="mt-4">
              <CopyAgent post={post} onUpdatePost={onUpdatePost} onBack={() => setActiveTab("preview")} tenantId={tenantId} />
            </TabsContent>
          </Tabs>
        </div>
      </ScrollArea>
    </div>
  );
}
