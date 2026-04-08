import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useSocialMediaChannels, useCreatePost, useWordPressSites, SocialMediaChannel, SocialMediaPost } from "@/hooks/useSocialMedia";
import { Facebook, Instagram, Linkedin, Youtube, Send, Clock, Save, Loader2, Globe } from "lucide-react";
import { toast } from "sonner";

const platformIcons: Record<SocialMediaChannel["platform"], React.ElementType> = {
  facebook: Facebook,
  instagram: Instagram,
  linkedin: Linkedin,
  youtube: Youtube,
};

const postTypes: { value: SocialMediaPost["post_type"]; label: string }[] = [
  { value: "text", label: "טקסט" },
  { value: "image", label: "תמונה" },
  { value: "video", label: "וידאו" },
  { value: "carousel", label: "קרוסלה" },
  { value: "story", label: "סטורי" },
  { value: "reel", label: "ריל" },
];

interface PostComposerProps {
  onPostCreated?: () => void;
}

export function PostComposer({ onPostCreated }: PostComposerProps) {
  const { data: channels = [] } = useSocialMediaChannels();
  const { data: wpSites = [] } = useWordPressSites();
  const createPost = useCreatePost();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [postType, setPostType] = useState<SocialMediaPost["post_type"]>("text");
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [scheduledAt, setScheduledAt] = useState("");
  const [publishToWp, setPublishToWp] = useState(false);
  const [selectedWpSite, setSelectedWpSite] = useState("");

  const toggleChannel = (channelId: string) => {
    setSelectedChannels((prev) =>
      prev.includes(channelId) ? prev.filter((id) => id !== channelId) : [...prev, channelId]
    );
  };

  const handleSubmit = async (status: "draft" | "scheduled" | "publishing") => {
    if (!content.trim()) {
      toast.error("יש להזין תוכן לפוסט");
      return;
    }
    if (status !== "draft" && selectedChannels.length === 0 && !publishToWp) {
      toast.error("יש לבחור לפחות ערוץ אחד או לסמן פרסום בוורדפרס");
      return;
    }
    if (status === "scheduled" && !scheduledAt) {
      toast.error("יש לבחור תאריך ושעה לתזמון");
      return;
    }

    await createPost.mutateAsync({
      title: title || undefined,
      content,
      post_type: postType,
      status,
      scheduled_at: scheduledAt || undefined,
      publish_to_wordpress: publishToWp,
      wordpress_site_url: publishToWp ? selectedWpSite : undefined,
      channel_ids: selectedChannels,
    });

    // Reset form
    setTitle("");
    setContent("");
    setPostType("text");
    setSelectedChannels([]);
    setScheduledAt("");
    setPublishToWp(false);
    setSelectedWpSite("");
    onPostCreated?.();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>יצירת פוסט חדש</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Title */}
        <div>
          <Label>כותרת (אופציונלי)</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="כותרת הפוסט"
          />
        </div>

        {/* Content */}
        <div>
          <Label>תוכן הפוסט</Label>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="כתוב את תוכן הפוסט כאן..."
            rows={5}
          />
          <p className="text-xs text-muted-foreground mt-1">{content.length} תווים</p>
        </div>

        {/* Post Type */}
        <div>
          <Label>סוג פוסט</Label>
          <Select value={postType} onValueChange={(v) => setPostType(v as SocialMediaPost["post_type"])}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {postTypes.map((pt) => (
                <SelectItem key={pt.value} value={pt.value}>
                  {pt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Channel Selection */}
        <div>
          <Label className="mb-2 block">ערוצי פרסום</Label>
          {channels.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              אין ערוצים מחוברים. הוסף ערוצים בלשונית "ערוצים".
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {channels
                .filter((ch) => ch.is_active)
                .map((channel) => {
                  const Icon = platformIcons[channel.platform];
                  const isSelected = selectedChannels.includes(channel.id);
                  return (
                    <div
                      key={channel.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        isSelected ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                      }`}
                      onClick={() => toggleChannel(channel.id)}
                    >
                      <Checkbox checked={isSelected} />
                      <Icon className="h-4 w-4" />
                      <span className="text-sm">{channel.channel_name}</span>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* WordPress */}
        <div className="flex items-center gap-3 p-3 rounded-lg border">
          <Switch checked={publishToWp} onCheckedChange={setPublishToWp} />
          <Globe className="h-4 w-4" />
          <span className="text-sm">פרסם גם בוורדפרס</span>
        </div>
        {publishToWp && wpSites.length > 0 && (
          <Select value={selectedWpSite} onValueChange={setSelectedWpSite}>
            <SelectTrigger>
              <SelectValue placeholder="בחר אתר וורדפרס" />
            </SelectTrigger>
            <SelectContent>
              {wpSites.map((site) => (
                <SelectItem key={site.id} value={site.site_url}>
                  {site.site_name || site.site_url}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {publishToWp && wpSites.length === 0 && (
          <p className="text-sm text-muted-foreground">
            אין אתרי וורדפרס מוגדרים. הוסף אתר בלשונית "וורדפרס".
          </p>
        )}

        {/* Schedule */}
        <div>
          <Label>תזמון (אופציונלי)</Label>
          <Input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => handleSubmit("draft")}
            disabled={createPost.isPending}
          >
            {createPost.isPending ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : <Save className="h-4 w-4 me-2" />}
            שמור כטיוטה
          </Button>
          <Button
            variant="secondary"
            onClick={() => handleSubmit("scheduled")}
            disabled={createPost.isPending || !scheduledAt}
          >
            <Clock className="h-4 w-4 me-2" />
            תזמן פרסום
          </Button>
          <Button
            onClick={() => handleSubmit("publishing")}
            disabled={createPost.isPending}
          >
            <Send className="h-4 w-4 me-2" />
            פרסם עכשיו
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
