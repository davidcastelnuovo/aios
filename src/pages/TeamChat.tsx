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
import { Plus, Send, Hash, Lock, Users, Settings, Smile } from "lucide-react";
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

interface TeamMessage {
  id: string;
  channel_id: string;
  tenant_id: string;
  sender_id: string;
  content: string;
  parent_message_id: string | null;
  is_edited: boolean;
  created_at: string;
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
      const { data } = await supabase
        .from("tenant_users")
        .select("user_id, profiles:user_id(id, full_name, email)")
        .eq("tenant_id", tenantId);
      return (data || []) as any[];
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
function TeamMessageList({ messages, currentUserId }: { messages: TeamMessage[]; currentUserId?: string }) {
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
                <div key={msg.id} className={cn("group flex gap-2 hover:bg-muted/50 rounded px-2 py-0.5", sameAuthor ? "pt-0" : "pt-2")}>
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
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
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
  const { userId } = useCurrentUser();

  const sendMessage = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("team_messages").insert({
        channel_id: channelId,
        tenant_id: tenantId,
        sender_id: userId!,
        content: text.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setText("");
      onSent();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (text.trim()) sendMessage.mutate();
    }
  };

  return (
    <div className="p-3 border-t">
      <div className="flex gap-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="כתוב הודעה..."
          className="min-h-[40px] max-h-32 resize-none"
          rows={1}
        />
        <Button size="icon" onClick={() => text.trim() && sendMessage.mutate()} disabled={!text.trim() || sendMessage.isPending}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// =================== ChannelHeader ===================
function ChannelHeader({ channel, memberCount }: { channel: TeamChannel; memberCount: number }) {
  return (
    <div className="h-14 border-b flex items-center gap-3 px-4">
      <div className="h-8 w-8 rounded-lg flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: channel.color }}>
        {channel.is_private ? <Lock className="h-4 w-4" /> : <Hash className="h-4 w-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <h2 className="font-semibold text-sm">{channel.name}</h2>
        {channel.description && <p className="text-xs text-muted-foreground truncate">{channel.description}</p>}
      </div>
      <div className="flex items-center gap-1 text-muted-foreground text-xs">
        <Users className="h-3.5 w-3.5" />
        {memberCount}
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

  // Fetch channels
  const { data: channels = [], refetch: refetchChannels } = useQuery({
    queryKey: ["team-channels", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_channels")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as TeamChannel[];
    },
    enabled: !!tenantId,
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
            <ChannelHeader channel={activeChannel} memberCount={members.length} />
            <TeamMessageList messages={messages} currentUserId={userId} />
            <TeamMessageInput channelId={activeChannel.id} tenantId={tenantId} onSent={refetchMessages} />
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
