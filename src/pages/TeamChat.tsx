import { useState, useEffect, useRef, useCallback } from "react";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Plus, Send, Hash, Lock, Users, UserPlus, X, Smile, Trash2, ListTodo, Paperclip, Link2, FileText, Image as ImageIcon, File } from "lucide-react";
import { ConvertMessageToTaskDialog } from "@/components/chat/ConvertMessageToTaskDialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { he } from "date-fns/locale";

// Types
interface TeamChannel {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  color: string;
  avatar_url: string | null;
  created_by: string;
  is_private: boolean;
  linked_client_id: string | null;
  linked_lead_id: string | null;
  created_at: string;
}

interface TeamAttachment {
  name: string;
  url: string;
  type: 'file' | 'link' | 'image';
  size?: number;
}

interface TeamMessage {
  id: string;
  channel_id: string;
  tenant_id: string;
  sender_id: string;
  content: string;
  parent_message_id: string | null;
  is_edited: boolean;
  created_at: string;
  attachments?: TeamAttachment[];
  sender_profile?: { full_name: string; email: string };
}

interface ChannelMember {
  id: string;
  channel_id: string;
  user_id: string;
  role: string;
  joined_at: string;
  profile?: { full_name: string; email: string };
}

// =================== CreateChannelDialog ===================
function CreateChannelDialog({ tenantId, onCreated }: { tenantId: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#3B82F6");
  const [isPrivate, setIsPrivate] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const { userId } = useCurrentUser();

  const { data: tenantUsers } = useQuery({
    queryKey: ["tenant-users-for-channel", tenantId],
    queryFn: async () => {
      const { data: tuData } = await supabase
        .from("tenant_users")
        .select("user_id")
        .eq("tenant_id", tenantId);
      if (!tuData || tuData.length === 0) return [];
      
      const userIds = tuData.map((tu: any) => tu.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);
      
      return (profiles || []).map((p: any) => ({ profiles: p }));
    },
    enabled: !!tenantId && open,
  });

  const createChannel = useMutation({
    mutationFn: async () => {
      // Create channel
      const { data: channel, error } = await supabase
        .from("team_channels")
        .insert({
          tenant_id: tenantId,
          name,
          description: description || null,
          color,
          is_private: isPrivate,
          created_by: userId!,
        })
        .select()
        .single();
      if (error) throw error;

      // Add creator as admin
      const members = [
        { channel_id: channel.id, user_id: userId!, role: "admin" },
        ...selectedMembers
          .filter((uid) => uid !== userId)
          .map((uid) => ({ channel_id: channel.id, user_id: uid, role: "member" })),
      ];

      const { error: memberError } = await supabase
        .from("team_channel_members")
        .insert(members);
      if (memberError) throw memberError;

      return channel;
    },
    onSuccess: () => {
      toast.success("הקבוצה נוצרה בהצלחה");
      setOpen(false);
      setName("");
      setDescription("");
      setSelectedMembers([]);
      onCreated();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const colors = ["#3B82F6", "#EF4444", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899", "#06B6D4", "#F97316"];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7">
          <Plus className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent dir="rtl" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>צור קבוצה חדשה</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>שם הקבוצה</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="למשל: צוות שיווק" />
          </div>
          <div>
            <Label>תיאור</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="תיאור קצר..." />
          </div>
          <div>
            <Label>צבע</Label>
            <div className="flex gap-2 mt-1">
              {colors.map((c) => (
                <button
                  key={c}
                  className={cn("h-7 w-7 rounded-full border-2 transition-all", color === c ? "border-foreground scale-110" : "border-transparent")}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} id="private" />
            <Label htmlFor="private" className="flex items-center gap-1">
              <Lock className="h-3 w-3" /> קבוצה פרטית
            </Label>
          </div>
          <div>
            <Label>הזמן חברים</Label>
            <div className="max-h-40 overflow-y-auto mt-1 space-y-1">
              {tenantUsers?.map((tu: any) => {
                const profile = tu.profiles;
                if (!profile || profile.id === userId) return null;
                const selected = selectedMembers.includes(profile.id);
                return (
                  <button
                    key={profile.id}
                    className={cn("w-full text-right px-3 py-1.5 rounded text-sm transition-colors", selected ? "bg-primary/10 text-primary" : "hover:bg-muted")}
                    onClick={() => setSelectedMembers((prev) => selected ? prev.filter((id) => id !== profile.id) : [...prev, profile.id])}
                  >
                    {profile.full_name || profile.email}
                  </button>
                );
              })}
            </div>
          </div>
          <Button className="w-full" onClick={() => createChannel.mutate()} disabled={!name.trim() || createChannel.isPending}>
            {createChannel.isPending ? "יוצר..." : "צור קבוצה"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// =================== ChannelSidebar ===================
function ChannelSidebar({
  channels,
  activeChannelId,
  onSelect,
  tenantId,
  onCreated,
  unreadCounts,
}: {
  channels: TeamChannel[];
  activeChannelId: string | null;
  onSelect: (id: string) => void;
  tenantId: string;
  onCreated: () => void;
  unreadCounts: Record<string, number>;
}) {
  return (
    <div className="w-64 border-l bg-muted/30 flex flex-col h-full">
      <div className="p-3 flex items-center justify-between border-b">
        <h3 className="font-semibold text-sm">ערוצים</h3>
        <CreateChannelDialog tenantId={tenantId} onCreated={onCreated} />
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-0.5">
          {channels.map((ch) => (
            <button
              key={ch.id}
              onClick={() => onSelect(ch.id)}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-right",
                activeChannelId === ch.id ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-muted-foreground"
              )}
            >
              {ch.is_private ? <Lock className="h-3.5 w-3.5 shrink-0" /> : <Hash className="h-3.5 w-3.5 shrink-0" />}
              <span className="flex-1 truncate">{ch.name}</span>
              {(unreadCounts[ch.id] || 0) > 0 && (
                <Badge variant="destructive" className="h-5 min-w-5 text-xs px-1">
                  {unreadCounts[ch.id]}
                </Badge>
              )}
            </button>
          ))}
          {channels.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-8">אין ערוצים עדיין. צור קבוצה חדשה!</p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// =================== TeamMessageList ===================
function TeamMessageList({ messages, currentUserId, onConvertToTask }: { messages: TeamMessage[]; currentUserId?: string; onConvertToTask?: (msg: TeamMessage) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const grouped = messages.reduce<{ date: string; msgs: TeamMessage[] }[]>((acc, msg) => {
    const dateStr = format(new Date(msg.created_at), "yyyy-MM-dd");
    const last = acc[acc.length - 1];
    if (last && last.date === dateStr) {
      last.msgs.push(msg);
    } else {
      acc.push({ date: dateStr, msgs: [msg] });
    }
    return acc;
  }, []);

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
      {grouped.map((group) => (
        <div key={group.date}>
          <div className="flex items-center gap-2 my-3">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">
              {format(new Date(group.date), "EEEE, d MMMM", { locale: he })}
            </span>
            <Separator className="flex-1" />
          </div>
          <div className="space-y-1">
            {group.msgs.map((msg, i) => {
              const prev = i > 0 ? group.msgs[i - 1] : null;
              const sameAuthor = prev && prev.sender_id === msg.sender_id;
              const isOwn = msg.sender_id === currentUserId;

              return (
                <div key={msg.id} className={cn("group flex gap-2 hover:bg-muted/50 rounded px-2 py-0.5 relative", sameAuthor ? "pt-0" : "pt-2")}>
                  <div className="w-8 shrink-0">
                    {!sameAuthor && (
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs" style={{ backgroundColor: isOwn ? "hsl(var(--primary))" : "hsl(var(--muted))" }}>
                          {(msg.sender_profile?.full_name || "?")[0]}
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    {!sameAuthor && (
                      <div className="flex items-baseline gap-2">
                        <span className="font-semibold text-sm">{msg.sender_profile?.full_name || "משתמש"}</span>
                        <span className="text-xs text-muted-foreground">{format(new Date(msg.created_at), "HH:mm")}</span>
                      </div>
                    )}
                    {msg.content && <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>}
                    {/* Attachments */}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-1">
                        {msg.attachments.map((att, idx) => (
                          <a
                            key={idx}
                            href={att.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-muted hover:bg-muted/80 text-xs transition-colors border"
                          >
                            {att.type === 'image' ? <ImageIcon className="h-3.5 w-3.5 text-blue-500" /> :
                             att.type === 'link' ? <Link2 className="h-3.5 w-3.5 text-green-500" /> :
                             <FileText className="h-3.5 w-3.5 text-orange-500" />}
                            <span className="max-w-[200px] truncate">{att.name}</span>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Convert to task button - visible on hover */}
                  <div className="absolute left-1 top-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="המרה למשימה"
                      onClick={() => onConvertToTask?.(msg)}
                    >
                      <ListTodo className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {messages.length === 0 && (
        <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
          אין הודעות עדיין. התחל שיחה!
        </div>
      )}
    </div>
  );
}

// =================== TeamMessageInput ===================
function TeamMessageInput({ channelId, tenantId, onSent }: { channelId: string; tenantId: string; onSent: () => void }) {
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<TeamAttachment[]>([]);
  const [linkInput, setLinkInput] = useState("");
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { userId } = useCurrentUser();

  const canSend = text.trim() || attachments.length > 0;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const newAttachments: TeamAttachment[] = [];
      for (const file of Array.from(files)) {
        const filePath = `${userId}/${Date.now()}-${file.name}`;
        const { error } = await supabase.storage.from("team-chat-files").upload(filePath, file);
        if (error) throw error;
        const { data: urlData } = supabase.storage.from("team-chat-files").getPublicUrl(filePath);
        const isImage = file.type.startsWith("image/");
        newAttachments.push({
          name: file.name,
          url: urlData.publicUrl,
          type: isImage ? 'image' : 'file',
          size: file.size,
        });
      }
      setAttachments((prev) => [...prev, ...newAttachments]);
    } catch (err: any) {
      toast.error("שגיאה בהעלאת הקובץ: " + err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const addLink = () => {
    const url = linkInput.trim();
    if (!url) return;
    const finalUrl = url.startsWith("http") ? url : `https://${url}`;
    setAttachments((prev) => [...prev, { name: finalUrl, url: finalUrl, type: 'link' }]);
    setLinkInput("");
    setShowLinkInput(false);
  };

  const removeAttachment = (idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const sendMessage = useMutation({
    mutationFn: async () => {
      const insertData: any = {
        channel_id: channelId,
        tenant_id: tenantId,
        sender_id: userId!,
        content: text.trim(),
      };
      if (attachments.length > 0) {
        insertData.attachments = attachments;
      }
      const { error } = await supabase.from("team_messages").insert(insertData);
      if (error) throw error;
    },
    onSuccess: () => {
      setText("");
      setAttachments([]);
      onSent();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSend) sendMessage.mutate();
    }
  };

  return (
    <div className="p-3 border-t space-y-2">
      {/* Attached files preview */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((att, idx) => (
            <div key={idx} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted text-xs border">
              {att.type === 'image' ? <ImageIcon className="h-3 w-3" /> :
               att.type === 'link' ? <Link2 className="h-3 w-3" /> :
               <File className="h-3 w-3" />}
              <span className="max-w-[150px] truncate">{att.name}</span>
              <button onClick={() => removeAttachment(idx)} className="hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Link input */}
      {showLinkInput && (
        <div className="flex gap-2">
          <Input
            value={linkInput}
            onChange={(e) => setLinkInput(e.target.value)}
            placeholder="הדבק קישור..."
            className="text-sm"
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLink(); } }}
            autoFocus
          />
          <Button size="sm" variant="outline" onClick={addLink} disabled={!linkInput.trim()}>הוסף</Button>
          <Button size="sm" variant="ghost" onClick={() => { setShowLinkInput(false); setLinkInput(""); }}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div className="flex gap-2 items-end">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          className="hidden"
          multiple
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip"
        />
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" disabled={uploading}>
              <Plus className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-40 p-1" side="top" align="start">
            <button
              className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded hover:bg-muted transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip className="h-4 w-4" />
              צרף קובץ
            </button>
            <button
              className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded hover:bg-muted transition-colors"
              onClick={() => setShowLinkInput(true)}
            >
              <Link2 className="h-4 w-4" />
              הוסף קישור
            </button>
          </PopoverContent>
        </Popover>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="כתוב הודעה..."
          className="min-h-[40px] max-h-32 resize-none"
          rows={1}
        />
        <Button size="icon" onClick={() => canSend && sendMessage.mutate()} disabled={!canSend || sendMessage.isPending || uploading}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// =================== ManageChannelMembersDialog ===================
function ManageChannelMembersDialog({
  channel,
  members,
  tenantId,
  currentUserId,
  onChanged,
}: {
  channel: TeamChannel;
  members: ChannelMember[];
  tenantId: string;
  currentUserId?: string;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const isAdmin = members.some((m) => m.user_id === currentUserId && m.role === "admin");

  // Fetch all tenant users
  const { data: tenantUsers = [] } = useQuery({
    queryKey: ["tenant-users-for-members", tenantId],
    queryFn: async () => {
      const { data: tuData } = await supabase
        .from("tenant_users")
        .select("user_id")
        .eq("tenant_id", tenantId);
      if (!tuData || tuData.length === 0) return [];
      
      const userIds = tuData.map((tu: any) => tu.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);
      
      return (profiles || []).map((p: any) => ({ profiles: p }));
    },
    enabled: !!tenantId && open,
  });

  // Fetch member profiles
  const { data: memberProfiles = [] } = useQuery({
    queryKey: ["team-member-profiles", channel.id],
    queryFn: async () => {
      const memberIds = members.map((m) => m.user_id);
      if (memberIds.length === 0) return [];
      const { data } = await supabase.from("profiles").select("id, full_name, email").in("id", memberIds);
      return data || [];
    },
    enabled: open && members.length > 0,
  });

  const memberUserIds = new Set(members.map((m) => m.user_id));
  const nonMembers = tenantUsers.filter((tu: any) => tu.profiles && !memberUserIds.has(tu.profiles.id));

  const addMember = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from("team_channel_members").insert({
        channel_id: channel.id,
        user_id: userId,
        role: "member",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("החבר נוסף בהצלחה");
      queryClient.invalidateQueries({ queryKey: ["team-channel-members", channel.id] });
      queryClient.invalidateQueries({ queryKey: ["team-member-profiles", channel.id] });
      onChanged();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const removeMember = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("team_channel_members")
        .delete()
        .eq("channel_id", channel.id)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("החבר הוסר מהקבוצה");
      queryClient.invalidateQueries({ queryKey: ["team-channel-members", channel.id] });
      queryClient.invalidateQueries({ queryKey: ["team-member-profiles", channel.id] });
      onChanged();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const getMemberProfile = (userId: string) => memberProfiles.find((p: any) => p.id === userId);
  const getMemberRole = (userId: string) => members.find((m) => m.user_id === userId)?.role;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
          <UserPlus className="h-4 w-4" />
          <span className="text-xs">ניהול חברים</span>
        </Button>
      </DialogTrigger>
      <DialogContent dir="rtl" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>ניהול חברי הקבוצה - {channel.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Current Members */}
          <div>
            <Label className="text-sm font-medium">חברים נוכחיים ({members.length})</Label>
            <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
              {members.map((member) => {
                const profile = getMemberProfile(member.user_id);
                const role = getMemberRole(member.user_id);
                const isCreator = member.user_id === channel.created_by;
                return (
                  <div key={member.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="text-xs">
                          {(profile?.full_name || profile?.email || "?")[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <span className="text-sm">{profile?.full_name || profile?.email || "משתמש"}</span>
                        {role === "admin" && (
                          <Badge variant="secondary" className="mr-2 text-[10px] px-1.5 py-0">מנהל</Badge>
                        )}
                      </div>
                    </div>
                    {isAdmin && !isCreator && member.user_id !== currentUserId && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => removeMember.mutate(member.user_id)}
                        disabled={removeMember.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Add Members */}
          {isAdmin && nonMembers.length > 0 && (
            <div>
              <Label className="text-sm font-medium">הוסף חברים</Label>
              <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                {nonMembers.map((tu: any) => {
                  const profile = tu.profiles;
                  return (
                    <button
                      key={profile.id}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-muted transition-colors"
                      onClick={() => addMember.mutate(profile.id)}
                      disabled={addMember.isPending}
                    >
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="text-xs">
                            {(profile.full_name || profile.email || "?")[0]}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{profile.full_name || profile.email}</span>
                      </div>
                      <Plus className="h-4 w-4 text-primary" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {isAdmin && nonMembers.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-2">כל חברי הארגון כבר בקבוצה</p>
          )}

          {!isAdmin && (
            <p className="text-xs text-muted-foreground text-center py-2">רק מנהלי הקבוצה יכולים להוסיף או להסיר חברים</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// =================== ChannelHeader ===================
function ChannelHeader({
  channel,
  members,
  tenantId,
  currentUserId,
  onMembersChanged,
}: {
  channel: TeamChannel;
  members: ChannelMember[];
  tenantId: string;
  currentUserId?: string;
  onMembersChanged: () => void;
}) {
  return (
    <div className="h-14 border-b flex items-center gap-3 px-4">
      <div className="h-8 w-8 rounded-lg flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: channel.color }}>
        {channel.is_private ? <Lock className="h-4 w-4" /> : <Hash className="h-4 w-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <h2 className="font-semibold text-sm">{channel.name}</h2>
        {channel.description && <p className="text-xs text-muted-foreground truncate">{channel.description}</p>}
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 text-muted-foreground text-xs">
          <Users className="h-3.5 w-3.5" />
          {members.length}
        </div>
        <ManageChannelMembersDialog
          channel={channel}
          members={members}
          tenantId={tenantId}
          currentUserId={currentUserId}
          onChanged={onMembersChanged}
        />
      </div>
    </div>
  );
}

// =================== Main TeamChat Page ===================
export default function TeamChat() {
  const { tenantId } = useCurrentTenant();
  const { userId } = useCurrentUser();
  const queryClient = useQueryClient();
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [taskMessage, setTaskMessage] = useState<TeamMessage | null>(null);

  // Fetch channels
  const { data: channels = [], refetch: refetchChannels } = useQuery({
    queryKey: ["team-channels", tenantId, userId],
    queryFn: async () => {
      // First get channel IDs where the user is a member
      const { data: memberships, error: memError } = await supabase
        .from("team_channel_members")
        .select("channel_id")
        .eq("user_id", userId!);
      if (memError) throw memError;
      
      const channelIds = (memberships || []).map((m: any) => m.channel_id);
      if (channelIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from("team_channels")
        .select("*")
        .in("id", channelIds)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as TeamChannel[];
    },
    enabled: !!tenantId && !!userId,
  });

  // Auto-select first channel
  useEffect(() => {
    if (channels.length > 0 && !activeChannelId) {
      setActiveChannelId(channels[0].id);
    }
  }, [channels, activeChannelId]);

  const activeChannel = channels.find((c) => c.id === activeChannelId);

  // Fetch messages for active channel
  const { data: messages = [], refetch: refetchMessages } = useQuery({
    queryKey: ["team-messages", activeChannelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_messages")
        .select("*")
        .eq("channel_id", activeChannelId!)
        .order("created_at", { ascending: true })
        .limit(200);
      if (error) throw error;

      // Fetch sender profiles
      const senderIds = [...new Set(data.map((m: any) => m.sender_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", senderIds);

      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
      return data.map((m: any) => ({
        ...m,
        sender_profile: profileMap.get(m.sender_id),
      })) as TeamMessage[];
    },
    enabled: !!activeChannelId,
  });

  // Fetch members for active channel
  const { data: members = [] } = useQuery({
    queryKey: ["team-channel-members", activeChannelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_channel_members")
        .select("*")
        .eq("channel_id", activeChannelId!);
      if (error) throw error;
      return data as ChannelMember[];
    },
    enabled: !!activeChannelId,
  });

  // Realtime subscription
  useEffect(() => {
    if (!activeChannelId) return;

    const channel = supabase
      .channel(`team-messages-${activeChannelId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "team_messages", filter: `channel_id=eq.${activeChannelId}` },
        () => refetchMessages()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeChannelId, refetchMessages]);

  // Unread counts (simplified - count messages after last read)
  const unreadCounts: Record<string, number> = {};

  if (!tenantId) return null;

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-background" dir="rtl">
      {/* Channel Sidebar */}
      <ChannelSidebar
        channels={channels}
        activeChannelId={activeChannelId}
        onSelect={setActiveChannelId}
        tenantId={tenantId}
        onCreated={refetchChannels}
        unreadCounts={unreadCounts}
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {activeChannel ? (
          <>
            <ChannelHeader channel={activeChannel} members={members} tenantId={tenantId} currentUserId={userId} onMembersChanged={() => queryClient.invalidateQueries({ queryKey: ["team-channel-members", activeChannelId] })} />
            <TeamMessageList messages={messages} currentUserId={userId} onConvertToTask={(msg) => setTaskMessage(msg)} />
            <TeamMessageInput channelId={activeChannel.id} tenantId={tenantId} onSent={refetchMessages} />
            <ConvertMessageToTaskDialog
              open={!!taskMessage}
              onOpenChange={(open) => { if (!open) setTaskMessage(null); }}
              messageText={taskMessage?.content || ""}
              contactId={activeChannel.linked_client_id || activeChannel.linked_lead_id || undefined}
              contactType={activeChannel.linked_client_id ? 'client' : activeChannel.linked_lead_id ? 'lead' : undefined}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center space-y-2">
              <Hash className="h-12 w-12 mx-auto opacity-20" />
              <p>בחר ערוץ או צור קבוצה חדשה</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
