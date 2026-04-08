import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useSocialMediaChannels, useCreateChannel, useDeleteChannel, SocialMediaChannel } from "@/hooks/useSocialMedia";
import { Facebook, Instagram, Linkedin, Youtube, Plus, Trash2, Loader2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const platformConfig: Record<SocialMediaChannel["platform"], { label: string; icon: React.ElementType; color: string }> = {
  facebook: { label: "Facebook", icon: Facebook, color: "bg-blue-600" },
  instagram: { label: "Instagram", icon: Instagram, color: "bg-gradient-to-br from-purple-600 to-pink-500" },
  linkedin: { label: "LinkedIn", icon: Linkedin, color: "bg-blue-700" },
  youtube: { label: "YouTube", icon: Youtube, color: "bg-red-600" },
};

export function ChannelManager() {
  const { data: channels = [], isLoading } = useSocialMediaChannels();
  const createChannel = useCreateChannel();
  const deleteChannel = useDeleteChannel();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    platform: "" as SocialMediaChannel["platform"] | "",
    channel_name: "",
    channel_id: "",
    access_token: "",
  });

  const handleCreate = async () => {
    if (!form.platform || !form.channel_name) return;
    await createChannel.mutateAsync({
      platform: form.platform as SocialMediaChannel["platform"],
      channel_name: form.channel_name,
      channel_id: form.channel_id || undefined,
      access_token: form.access_token || undefined,
    });
    setForm({ platform: "", channel_name: "", channel_id: "", access_token: "" });
    setOpen(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>ערוצים מחוברים</CardTitle>
          <CardDescription>נהל את ערוצי המדיה החברתית שלך</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 me-2" />
              הוסף ערוץ
            </Button>
          </DialogTrigger>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle>הוסף ערוץ חדש</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>פלטפורמה</Label>
                <Select
                  value={form.platform}
                  onValueChange={(v) => setForm({ ...form, platform: v as SocialMediaChannel["platform"] })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="בחר פלטפורמה" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(platformConfig).map(([key, cfg]) => (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center gap-2">
                          <cfg.icon className="h-4 w-4" />
                          {cfg.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>שם הערוץ / עמוד</Label>
                <Input
                  value={form.channel_name}
                  onChange={(e) => setForm({ ...form, channel_name: e.target.value })}
                  placeholder="לדוגמה: העמוד העסקי שלי"
                />
              </div>
              <div>
                <Label>מזהה ערוץ (Page ID / Channel ID)</Label>
                <Input
                  value={form.channel_id}
                  onChange={(e) => setForm({ ...form, channel_id: e.target.value })}
                  placeholder="אופציונלי"
                />
              </div>
              <div>
                <Label>Access Token</Label>
                <Input
                  type="password"
                  value={form.access_token}
                  onChange={(e) => setForm({ ...form, access_token: e.target.value })}
                  placeholder="הזן את ה-Access Token"
                />
              </div>
              <Button
                className="w-full"
                onClick={handleCreate}
                disabled={!form.platform || !form.channel_name || createChannel.isPending}
              >
                {createChannel.isPending && <Loader2 className="h-4 w-4 animate-spin me-2" />}
                הוסף ערוץ
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : channels.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            אין ערוצים מחוברים. הוסף ערוץ כדי להתחיל לפרסם.
          </p>
        ) : (
          <div className="space-y-3">
            {channels.map((channel) => {
              const cfg = platformConfig[channel.platform];
              const Icon = cfg.icon;
              return (
                <div
                  key={channel.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg text-white ${cfg.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium">{channel.channel_name}</p>
                      <p className="text-sm text-muted-foreground">{cfg.label}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={channel.is_active ? "default" : "secondary"}>
                      {channel.is_active ? "פעיל" : "לא פעיל"}
                    </Badge>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>מחק ערוץ</AlertDialogTitle>
                          <AlertDialogDescription>
                            האם אתה בטוח שברצונך למחוק את הערוץ "{channel.channel_name}"?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>ביטול</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteChannel.mutate(channel.id)}>
                            מחק
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
