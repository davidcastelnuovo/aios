import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Sparkles,
  PenLine,
  Image,
  RefreshCw,
  Check,
  X,
  Trash2,
  Save,
  MessageSquare,
} from "lucide-react";
import { CreativeAgent } from "./CreativeAgent";
import { CopyAgent } from "./CopyAgent";
import type { SocialPost } from "@/pages/SocialDashboard";

interface SocialGanttPreviewProps {
  post: SocialPost | null;
  onUpdatePost: (updates: Partial<SocialPost> & { id: string }) => void;
  onDeletePost: (id: string) => void;
  isUpdating: boolean;
  tenantId: string | null;
}

const statusOptions = [
  { value: "draft", label: "טיוטה" },
  { value: "in_review", label: "בבדיקה" },
  { value: "approved", label: "מאושר" },
  { value: "published", label: "פורסם" },
  { value: "rejected", label: "נדחה" },
];

export function SocialGanttPreview({
  post,
  onUpdatePost,
  onDeletePost,
  isUpdating,
  tenantId,
}: SocialGanttPreviewProps) {
  const [editingCopy, setEditingCopy] = useState(false);
  const [copyDraft, setCopyDraft] = useState("");
  const [activeTab, setActiveTab] = useState("preview");

  if (!post) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center space-y-2">
          <MessageSquare className="h-12 w-12 mx-auto opacity-30" />
          <p className="text-lg font-medium">בחר פוסט מהרשימה</p>
          <p className="text-sm">או צור פוסט חדש כדי להתחיל</p>
        </div>
      </div>
    );
  }

  const handleStartEditCopy = () => {
    setCopyDraft(post.copy_text || "");
    setEditingCopy(true);
  };

  const handleSaveCopy = () => {
    onUpdatePost({ id: post.id, copy_text: copyDraft });
    setEditingCopy(false);
  };

  const handleCancelEditCopy = () => {
    setEditingCopy(false);
    setCopyDraft("");
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6 max-w-3xl mx-auto">
          {/* Post Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Select
                value={post.status}
                onValueChange={(value) =>
                  onUpdatePost({ id: post.id, status: value as SocialPost["status"] })
                }
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>מחיקת פוסט</AlertDialogTitle>
                    <AlertDialogDescription>
                      האם אתה בטוח שברצונך למחוק את הפוסט "{post.topic}"?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>ביטול</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onDeletePost(post.id)}>
                      מחק
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            <div className="text-right">
              <h2 className="text-xl font-bold">{post.topic}</h2>
              <p className="text-sm text-muted-foreground">
                {post.platform} · {post.scheduled_date}
              </p>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full">
              <TabsTrigger value="preview" className="flex-1">
                <Image className="h-4 w-4 me-2" />
                תצוגה מקדימה
              </TabsTrigger>
              <TabsTrigger value="creative-agent" className="flex-1">
                <Sparkles className="h-4 w-4 me-2" />
                סוכן קריאייטיב
              </TabsTrigger>
              <TabsTrigger value="copy-agent" className="flex-1">
                <PenLine className="h-4 w-4 me-2" />
                סוכן קופי
              </TabsTrigger>
            </TabsList>

            {/* Preview Tab */}
            <TabsContent value="preview" className="space-y-4 mt-4">
              {/* Creative Preview */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveTab("creative-agent")}
                    >
                      <RefreshCw className="h-3.5 w-3.5 me-1" />
                      בקש קריאייטיב חדש
                    </Button>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Image className="h-4 w-4" />
                      קריאייטיב
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  {post.creative_url ? (
                    <div className="rounded-lg overflow-hidden border bg-muted">
                      <img
                        src={post.creative_url}
                        alt={post.topic}
                        className="w-full h-auto max-h-[400px] object-contain"
                      />
                    </div>
                  ) : (
                    <div className="rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/50 h-[300px] flex items-center justify-center">
                      <div className="text-center space-y-2">
                        <Sparkles className="h-10 w-10 mx-auto text-muted-foreground/50" />
                        <p className="text-sm text-muted-foreground">
                          עדיין אין קריאייטיב
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setActiveTab("creative-agent")}
                        >
                          <Sparkles className="h-3.5 w-3.5 me-1" />
                          צור קריאייטיב עם AI
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Copy Preview */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      {!editingCopy && (
                        <>
                          <Button variant="outline" size="sm" onClick={handleStartEditCopy}>
                            <PenLine className="h-3.5 w-3.5 me-1" />
                            ערוך
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setActiveTab("copy-agent")}
                          >
                            <RefreshCw className="h-3.5 w-3.5 me-1" />
                            בקש קופי חדש
                          </Button>
                        </>
                      )}
                    </div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <PenLine className="h-4 w-4" />
                      קופי
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  {editingCopy ? (
                    <div className="space-y-3">
                      <Textarea
                        value={copyDraft}
                        onChange={(e) => setCopyDraft(e.target.value)}
                        rows={6}
                        className="text-right"
                        placeholder="כתוב את הקופי כאן..."
                        dir="rtl"
                      />
                      <div className="flex gap-2 justify-start">
                        <Button size="sm" onClick={handleSaveCopy} disabled={isUpdating}>
                          <Save className="h-3.5 w-3.5 me-1" />
                          שמור
                        </Button>
                        <Button size="sm" variant="ghost" onClick={handleCancelEditCopy}>
                          ביטול
                        </Button>
                      </div>
                    </div>
                  ) : post.copy_text ? (
                    <div className="whitespace-pre-wrap text-sm leading-relaxed text-right" dir="rtl">
                      {post.copy_text}
                    </div>
                  ) : (
                    <div className="rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/50 py-8 flex items-center justify-center">
                      <div className="text-center space-y-2">
                        <PenLine className="h-8 w-8 mx-auto text-muted-foreground/50" />
                        <p className="text-sm text-muted-foreground">עדיין אין קופי</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setActiveTab("copy-agent")}
                        >
                          <Sparkles className="h-3.5 w-3.5 me-1" />
                          צור קופי עם AI
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Notes */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">הערות</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={post.notes || ""}
                    onChange={(e) =>
                      onUpdatePost({ id: post.id, notes: e.target.value })
                    }
                    placeholder="הוסף הערות לפוסט..."
                    rows={3}
                    dir="rtl"
                    className="text-right"
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Creative Agent Tab */}
            <TabsContent value="creative-agent" className="mt-4">
              <CreativeAgent
                post={post}
                onUpdatePost={onUpdatePost}
                onBack={() => setActiveTab("preview")}
                tenantId={tenantId}
              />
            </TabsContent>

            {/* Copy Agent Tab */}
            <TabsContent value="copy-agent" className="mt-4">
              <CopyAgent
                post={post}
                onUpdatePost={onUpdatePost}
                onBack={() => setActiveTab("preview")}
                tenantId={tenantId}
              />
            </TabsContent>
          </Tabs>
        </div>
      </ScrollArea>
    </div>
  );
}
