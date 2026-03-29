import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSocialMediaPosts, useSocialMediaChannels, useDeletePost, usePublishPost, useUpdatePostStatus, SocialMediaPost } from "@/hooks/useSocialMedia";
import { Trash2, Send, Loader2, Clock, CheckCircle2, XCircle, AlertCircle, FileText, Ban } from "lucide-react";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const statusConfig: Record<SocialMediaPost["status"], { label: string; icon: React.ElementType; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "טיוטה", icon: FileText, variant: "secondary" },
  scheduled: { label: "מתוזמן", icon: Clock, variant: "outline" },
  publishing: { label: "מפרסם...", icon: Loader2, variant: "default" },
  published: { label: "פורסם", icon: CheckCircle2, variant: "default" },
  failed: { label: "נכשל", icon: XCircle, variant: "destructive" },
  cancelled: { label: "בוטל", icon: Ban, variant: "secondary" },
};

export function PostsList() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { data: posts = [], isLoading } = useSocialMediaPosts(statusFilter === "all" ? undefined : statusFilter);
  const deletePost = useDeletePost();
  const publishPost = usePublishPost();
  const updateStatus = useUpdatePostStatus();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>פוסטים</CardTitle>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">הכל</SelectItem>
            <SelectItem value="draft">טיוטות</SelectItem>
            <SelectItem value="scheduled">מתוזמנים</SelectItem>
            <SelectItem value="published">פורסמו</SelectItem>
            <SelectItem value="failed">נכשלו</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : posts.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            אין פוסטים {statusFilter !== "all" ? "בסטטוס זה" : "עדיין"}
          </p>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => {
              const status = statusConfig[post.status];
              const StatusIcon = status.icon;
              return (
                <div
                  key={post.id}
                  className="p-4 rounded-lg border space-y-2"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      {post.title && (
                        <h4 className="font-medium truncate">{post.title}</h4>
                      )}
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                        {post.content}
                      </p>
                    </div>
                    <Badge variant={status.variant} className="mr-2 whitespace-nowrap">
                      <StatusIcon className={`h-3 w-3 ml-1 ${post.status === "publishing" ? "animate-spin" : ""}`} />
                      {status.label}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-3">
                      <span>
                        נוצר {format(new Date(post.created_at), "dd/MM/yyyy HH:mm", { locale: he })}
                      </span>
                      {post.scheduled_at && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          מתוזמן ל-{format(new Date(post.scheduled_at), "dd/MM/yyyy HH:mm", { locale: he })}
                        </span>
                      )}
                      {post.publish_to_wordpress && (
                        <Badge variant="outline" className="text-xs">WordPress</Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      {(post.status === "draft" || post.status === "failed") && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => publishPost.mutate(post.id)}
                          disabled={publishPost.isPending}
                        >
                          <Send className="h-3 w-3 ml-1" />
                          פרסם
                        </Button>
                      )}
                      {post.status === "scheduled" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => updateStatus.mutate({ postId: post.id, status: "cancelled" })}
                        >
                          <Ban className="h-3 w-3 ml-1" />
                          בטל
                        </Button>
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>מחק פוסט</AlertDialogTitle>
                            <AlertDialogDescription>
                              האם אתה בטוח שברצונך למחוק את הפוסט הזה?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>ביטול</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deletePost.mutate(post.id)}>
                              מחק
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>

                  {post.error_message && (
                    <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 rounded p-2">
                      <AlertCircle className="h-3 w-3" />
                      {post.error_message}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
