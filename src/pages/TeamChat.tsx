import { useState, useEffect, useRef, useCallback } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Plus, Send, Hash, Lock, Users, UserPlus, X, Smile, Trash2, ListTodo, Paperclip, Link2, FileText, Image as ImageIcon, File, Mic, Square, Loader2, Building2, User, Target, Settings, Pencil, ArrowRight, Check, Upload, Sparkles, Camera } from "lucide-react";
import { ConvertMessageToTaskDialog } from "@/components/chat/ConvertMessageToTaskDialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { useAgency } from "@/contexts/AgencyContext";
import { LinkFileToEntityDialog } from "@/components/chat/LinkFileToEntityDialog";

// Types
interface ChannelCategory {
  id: string;
  tenant_id: string;
  name: string;
  icon: string;
  sort_order: number;
}

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
  agency_id: string | null;
  category: string | null;
  category_id: string | null;
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
  const [selectedAgencyId, setSelectedAgencyId] = useState<string>("");
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [selectedLeadId, setSelectedLeadId] = useState<string>("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
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

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ["team-channel-categories", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("team_channel_categories").select("*").eq("tenant_id", tenantId).order("sort_order");
      return (data || []) as ChannelCategory[];
    },
    enabled: !!tenantId && open,
  });

  // Fetch agencies
  const { data: agencies = [] } = useQuery({
    queryKey: ["agencies-for-channel", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("agencies").select("id, name").eq("tenant_id", tenantId).order("name");
      return data || [];
    },
    enabled: !!tenantId && open,
  });

  // Fetch clients for selected agency
  const { data: clients = [] } = useQuery({
    queryKey: ["clients-for-channel", tenantId, selectedAgencyId],
    queryFn: async () => {
      let q = supabase.from("clients").select("id, name").eq("tenant_id", tenantId);
      if (selectedAgencyId) q = q.eq("agency_id", selectedAgencyId);
      const { data } = await q.order("name");
      return data || [];
    },
    enabled: !!tenantId && open,
  });

  // Fetch leads for selected agency
  const { data: leads = [] } = useQuery({
    queryKey: ["leads-for-channel", tenantId, selectedAgencyId],
    queryFn: async () => {
      let q = supabase.from("leads").select("id, company_name, contact_name").eq("tenant_id", tenantId);
      if (selectedAgencyId) q = q.eq("agency_id", selectedAgencyId);
      const { data } = await q.order("created_at", { ascending: false }).limit(100);
      return data || [];
    },
    enabled: !!tenantId && open,
  });

  const createChannel = useMutation({
    mutationFn: async () => {
      const insertData: any = {
        tenant_id: tenantId,
        name,
        description: description || null,
        color,
        is_private: isPrivate,
        created_by: userId!,
      };
      if (selectedCategoryId) insertData.category_id = selectedCategoryId;
      if (selectedAgencyId) insertData.agency_id = selectedAgencyId;
      if (selectedClientId) insertData.linked_client_id = selectedClientId;
      if (selectedLeadId) insertData.linked_lead_id = selectedLeadId;

      const { data: channel, error } = await supabase
        .from("team_channels")
        .insert(insertData)
        .select()
        .single();
      if (error) throw error;

      // Add creator as admin
      const members = [
        { channel_id: channel.id, user_id: userId!, role: "admin", tenant_id: tenantId },
        ...selectedMembers
          .filter((uid) => uid !== userId)
          .map((uid) => ({ channel_id: channel.id, user_id: uid, role: "member", tenant_id: tenantId })),
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
      setSelectedAgencyId("");
      setSelectedClientId("");
      setSelectedLeadId("");
      setSelectedCategoryId("");
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
        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
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

          {/* Category Selector */}
          {categories.length > 0 && (
            <div>
              <Label>קטגוריה</Label>
              <Select value={selectedCategoryId} onValueChange={(v) => setSelectedCategoryId(v === "none" ? "" : v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="ללא קטגוריה" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">ללא קטגוריה</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.icon} {cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Agency Selector */}
          <div>
            <Label className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" /> שייך לסוכנות</Label>
            <Select value={selectedAgencyId} onValueChange={(v) => { setSelectedAgencyId(v === "none" ? "" : v); setSelectedClientId(""); setSelectedLeadId(""); }}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="ללא שיוך" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">ללא שיוך</SelectItem>
                {agencies.map((a: any) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Client Selector */}
          <div>
            <Label className="flex items-center gap-1"><User className="h-3.5 w-3.5" /> שייך ללקוח</Label>
            <Select value={selectedClientId} onValueChange={(v) => { setSelectedClientId(v === "none" ? "" : v); if (v !== "none") setSelectedLeadId(""); }}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="ללא שיוך" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">ללא שיוך</SelectItem>
                {clients.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Lead Selector */}
          <div>
            <Label className="flex items-center gap-1"><Target className="h-3.5 w-3.5" /> שייך לליד</Label>
            <Select value={selectedLeadId} onValueChange={(v) => { setSelectedLeadId(v === "none" ? "" : v); if (v !== "none") setSelectedClientId(""); }}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="ללא שיוך" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">ללא שיוך</SelectItem>
                {leads.map((l: any) => (
                  <SelectItem key={l.id} value={l.id}>{l.company_name || l.contact_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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

// =================== ManageCategoriesDialog ===================
function ManageCategoriesDialog({ tenantId }: { tenantId: string }) {
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState("📁");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editIcon, setEditIcon] = useState("");
  const queryClient = useQueryClient();

  const { data: categories = [] } = useQuery({
    queryKey: ["team-channel-categories", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("team_channel_categories").select("*").eq("tenant_id", tenantId).order("sort_order");
      return (data || []) as ChannelCategory[];
    },
    enabled: !!tenantId && open,
  });

  const addCategory = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("team_channel_categories").insert({
        tenant_id: tenantId,
        name: newName,
        icon: newIcon,
        sort_order: categories.length,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewName("");
      setNewIcon("📁");
      queryClient.invalidateQueries({ queryKey: ["team-channel-categories", tenantId] });
      toast.success("קטגוריה נוספה");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateCategory = useMutation({
    mutationFn: async ({ id, name, icon }: { id: string; name: string; icon: string }) => {
      const { error } = await supabase.from("team_channel_categories").update({ name, icon }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ["team-channel-categories", tenantId] });
      toast.success("קטגוריה עודכנה");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("team_channel_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-channel-categories", tenantId] });
      toast.success("קטגוריה נמחקה");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const icons = ["📁", "👥", "👤", "🚀", "⚡", "💬", "📊", "🎯", "🔧", "💡", "📋", "🏢"];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7">
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent dir="rtl" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>ניהול קטגוריות</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Existing categories */}
          <div className="space-y-2">
            {categories.map((cat) => (
              <div key={cat.id} className="flex items-center gap-2 p-2 rounded-lg border bg-muted/30">
                {editingId === cat.id ? (
                  <>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="text-lg">{editIcon}</button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-2" dir="rtl">
                        <div className="grid grid-cols-6 gap-1">
                          {icons.map((ic) => (
                            <button key={ic} className={cn("text-lg p-1 rounded hover:bg-muted", editIcon === ic && "bg-primary/10")} onClick={() => setEditIcon(ic)}>{ic}</button>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                    <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8 flex-1" />
                    <Button size="sm" variant="ghost" className="h-8" onClick={() => updateCategory.mutate({ id: cat.id, name: editName, icon: editIcon })}>✓</Button>
                    <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditingId(null)}>✕</Button>
                  </>
                ) : (
                  <>
                    <span className="text-lg">{cat.icon}</span>
                    <span className="flex-1 text-sm font-medium">{cat.name}</span>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setEditingId(cat.id); setEditName(cat.name); setEditIcon(cat.icon); }}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => deleteCategory.mutate(cat.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </>
                )}
              </div>
            ))}
            {categories.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">אין קטגוריות עדיין</p>
            )}
          </div>

          <Separator />

          {/* Add new */}
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <button className="text-lg border rounded p-1">{newIcon}</button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2" dir="rtl">
                <div className="grid grid-cols-6 gap-1">
                  {icons.map((ic) => (
                    <button key={ic} className={cn("text-lg p-1 rounded hover:bg-muted", newIcon === ic && "bg-primary/10")} onClick={() => setNewIcon(ic)}>{ic}</button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="שם קטגוריה חדשה" className="h-9 flex-1" />
            <Button size="sm" onClick={() => addCategory.mutate()} disabled={!newName.trim() || addCategory.isPending}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
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
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  const { data: categories = [] } = useQuery({
    queryKey: ["team-channel-categories", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("team_channel_categories").select("*").eq("tenant_id", tenantId).order("sort_order");
      return (data || []) as ChannelCategory[];
    },
    enabled: !!tenantId,
  });

  const toggleCategory = (key: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Group channels: by category_id, uncategorized go into a special group
  const uncategorized = channels.filter((ch) => !ch.category_id);
  const categorized = categories.map((cat) => ({
    id: cat.id,
    icon: cat.icon,
    label: cat.name,
    channels: channels.filter((ch) => ch.category_id === cat.id),
  })).filter((cat) => cat.channels.length > 0);

  const renderChannelItem = (ch: TeamChannel) => (
    <button
      key={ch.id}
      onClick={() => onSelect(ch.id)}
      className={cn(
        "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-right",
        activeChannelId === ch.id ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-muted-foreground"
      )}
    >
      {ch.avatar_url ? (
        <img src={ch.avatar_url} alt={ch.name} className="h-4 w-4 rounded shrink-0 object-cover" />
      ) : (
        ch.is_private ? <Lock className="h-3.5 w-3.5 shrink-0" /> : <Hash className="h-3.5 w-3.5 shrink-0" />
      )}
      <span className="flex-1 truncate">{ch.name}</span>
      {(unreadCounts[ch.id] || 0) > 0 && (
        <Badge variant="destructive" className="h-5 min-w-5 text-xs px-1">
          {unreadCounts[ch.id]}
        </Badge>
      )}
    </button>
  );

  return (
    <div className="w-full md:w-64 border-l bg-muted/30 flex flex-col h-full">
      <div className="p-3 flex items-center justify-between border-b">
        <div className="flex items-center gap-1">
          <ManageCategoriesDialog tenantId={tenantId} />
          <CreateChannelDialog tenantId={tenantId} onCreated={onCreated} />
        </div>
        <h3 className="font-semibold text-sm">ערוצים</h3>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {/* Uncategorized channels */}
          {uncategorized.length > 0 && categories.length > 0 && (
            <div>
              <button
                onClick={() => toggleCategory("__uncategorized")}
                className="w-full flex items-center gap-1.5 px-2 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                <span className="text-[11px]">📌</span>
                <span className="flex-1 text-right">כללי</span>
                <span className="text-[10px]">{uncategorized.length}</span>
              </button>
              {!collapsedCategories.has("__uncategorized") && (
                <div className="space-y-0.5">{uncategorized.map(renderChannelItem)}</div>
              )}
            </div>
          )}

          {/* If no categories exist, show all channels flat */}
          {categories.length === 0 && (
            <div className="space-y-0.5">{channels.map(renderChannelItem)}</div>
          )}

          {/* Categorized channels */}
          {categorized.map((cat) => (
            <div key={cat.id}>
              <button
                onClick={() => toggleCategory(cat.id)}
                className="w-full flex items-center gap-1.5 px-2 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                <span className="text-[11px]">{cat.icon}</span>
                <span className="flex-1 text-right">{cat.label}</span>
                <span className="text-[10px]">{cat.channels.length}</span>
              </button>
              {!collapsedCategories.has(cat.id) && (
                <div className="space-y-0.5">{cat.channels.map(renderChannelItem)}</div>
              )}
            </div>
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
function TeamMessageList({ messages, currentUserId, onConvertToTask, onEditMessage, onDeleteMessage }: { messages: TeamMessage[]; currentUserId?: string; onConvertToTask?: (msg: TeamMessage) => void; onEditMessage?: (msg: TeamMessage, newContent: string) => void; onDeleteMessage?: (msg: TeamMessage) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [deleteConfirmMsg, setDeleteConfirmMsg] = useState<TeamMessage | null>(null);

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

  const startEdit = (msg: TeamMessage) => {
    setEditingId(msg.id);
    setEditText(msg.content);
  };

  const saveEdit = (msg: TeamMessage) => {
    if (editText.trim() && editText.trim() !== msg.content) {
      onEditMessage?.(msg, editText.trim());
    }
    setEditingId(null);
    setEditText("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText("");
  };

  return (
    <>
      <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0 p-4 space-y-4">
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
                const isEditing = editingId === msg.id;

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
                          {msg.is_edited && <span className="text-[10px] text-muted-foreground">(נערך)</span>}
                        </div>
                      )}
                      {isEditing ? (
                        <div className="space-y-1">
                          <Textarea
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            className="min-h-[40px] max-h-32 resize-none text-sm"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveEdit(msg); }
                              if (e.key === "Escape") cancelEdit();
                            }}
                          />
                          <div className="flex gap-1">
                            <Button size="sm" variant="default" className="h-6 text-xs px-2" onClick={() => saveEdit(msg)}>
                              <Check className="h-3 w-3 ml-1" /> שמור
                            </Button>
                            <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={cancelEdit}>ביטול</Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {msg.content && (
                            <p className="text-sm whitespace-pre-wrap break-words">
                              {msg.content}
                              {sameAuthor && msg.is_edited && <span className="text-[10px] text-muted-foreground mr-1">(נערך)</span>}
                            </p>
                          )}
                        </>
                      )}
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
                    {/* Action buttons - visible on hover */}
                    <div className="absolute left-1 top-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5">
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="המרה למשימה" onClick={() => onConvertToTask?.(msg)}>
                        <ListTodo className="h-3.5 w-3.5" />
                      </Button>
                      {isOwn && !isEditing && (
                        <>
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="ערוך הודעה" onClick={() => startEdit(msg)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" title="מחק הודעה" onClick={() => setDeleteConfirmMsg(msg)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
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

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteConfirmMsg} onOpenChange={(open) => { if (!open) setDeleteConfirmMsg(null); }}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת הודעה</AlertDialogTitle>
            <AlertDialogDescription>האם אתה בטוח שברצונך למחוק את ההודעה? פעולה זו לא ניתנת לביטול.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { if (deleteConfirmMsg) { onDeleteMessage?.(deleteConfirmMsg); setDeleteConfirmMsg(null); } }}>
              מחק
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// =================== TeamMessageInput ===================
function TeamMessageInput({ channelId, tenantId, onSent, onFilesUploaded }: { channelId: string; tenantId: string; onSent: () => void; onFilesUploaded?: (files: { id: string; file_name: string; file_url: string }[]) => void }) {
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<TeamAttachment[]>([]);
  const [linkInput, setLinkInput] = useState("");
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { userId } = useCurrentUser();

  // Track uploaded file IDs for linking
  const uploadedFileIdsRef = useRef<{ id: string; file_name: string; file_url: string }[]>([]);

  const canSend = text.trim() || attachments.length > 0;

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType });
        if (audioBlob.size < 100) return;

        setIsTranscribing(true);
        try {
          const formData = new FormData();
          formData.append('audio', audioBlob, 'recording.webm');

          const res = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-voice`,
            {
              method: 'POST',
              headers: {
                'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
                'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
              },
              body: formData,
            }
          );
          const result = await res.json();
          if (result.error) throw new Error(result.error);
          if (result.text) {
            setText(prev => prev ? prev + ' ' + result.text : result.text);
          }
        } catch (err: any) {
          toast.error("שגיאה בתמלול: " + err.message);
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err: any) {
      toast.error("לא ניתן לגשת למיקרופון: " + err.message);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const uploadFiles = async (files: FileList | File[]) => {
    if (!userId) {
      toast.error("שגיאה: משתמש לא מזוהה. נסה לרענן את הדף.");
      return;
    }
    setUploading(true);
    try {
      const newAttachments: TeamAttachment[] = [];
      const newFileRecords: { id: string; file_name: string; file_url: string }[] = [];
      
      for (const file of Array.from(files)) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const filePath = `${userId}/${Date.now()}-${safeName}`;
        const { error: uploadError } = await supabase.storage.from("team-chat-files").upload(filePath, file);
        if (uploadError) {
          console.error("Storage upload error:", uploadError);
          throw uploadError;
        }
        const { data: urlData } = supabase.storage.from("team-chat-files").getPublicUrl(filePath);
        const isImage = file.type.startsWith("image/");
        
        newAttachments.push({
          name: file.name,
          url: urlData.publicUrl,
          type: isImage ? 'image' : 'file',
          size: file.size,
        });

        // Track in DB
        const { data: fileRecord, error: dbError } = await supabase.from("team_chat_files").insert({
          tenant_id: tenantId,
          channel_id: channelId,
          uploaded_by: userId,
          file_name: file.name,
          file_url: urlData.publicUrl,
          file_type: isImage ? 'image' : 'file',
          file_size: file.size,
        }).select("id, file_name, file_url").single();

        if (dbError) {
          console.error("DB insert error:", dbError);
          // Don't throw - file is already uploaded, just skip tracking
        }

        if (fileRecord) {
          newFileRecords.push(fileRecord);
        }
      }
      setAttachments((prev) => [...prev, ...newAttachments]);
      uploadedFileIdsRef.current = [...uploadedFileIdsRef.current, ...newFileRecords];
      toast.success(`${Array.from(files).length} קבצים הועלו בהצלחה`);
    } catch (err: any) {
      console.error("Upload error details:", err);
      toast.error("שגיאה בהעלאת הקובץ: " + (err.message || err.statusCode || JSON.stringify(err)));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await uploadFiles(files);
  };

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await uploadFiles(files);
    }
  }, [userId, tenantId, channelId]);

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
      const { data: msg, error } = await supabase.from("team_messages").insert(insertData).select("id").single();
      if (error) throw error;

      // Update file records with message_id
      if (uploadedFileIdsRef.current.length > 0 && msg) {
        const fileIds = uploadedFileIdsRef.current.map(f => f.id);
        await supabase.from("team_chat_files").update({ message_id: msg.id }).in("id", fileIds);
      }

      return msg;
    },
    onSuccess: () => {
      // Offer to link files if any were uploaded
      if (uploadedFileIdsRef.current.length > 0) {
        onFilesUploaded?.(uploadedFileIdsRef.current);
      }
      setText("");
      setAttachments([]);
      uploadedFileIdsRef.current = [];
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
    <div
      className={cn("p-3 border-t space-y-2 transition-colors shrink-0", isDragOver && "bg-primary/5 border-primary")}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragOver && (
        <div className="text-center py-3 text-sm text-primary font-medium">
          שחרר קבצים כאן להעלאה 📎
        </div>
      )}

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
          placeholder="כתוב הודעה... (גרור קבצים לכאן)"
          className="min-h-[40px] max-h-32 resize-none"
          rows={1}
        />
        <Button
          size="icon"
          variant={isRecording ? "destructive" : "ghost"}
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isTranscribing || uploading}
          className="h-9 w-9 shrink-0"
          title={isRecording ? "עצור הקלטה" : "הקלט הודעה קולית"}
        >
          {isTranscribing ? <Loader2 className="h-4 w-4 animate-spin" /> : isRecording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </Button>
        <Button size="icon" onClick={() => canSend && sendMessage.mutate()} disabled={!canSend || sendMessage.isPending || uploading || isTranscribing}>
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
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const queryClient = useQueryClient();

  const isAdmin = members.some((m) => m.user_id === currentUserId && m.role === "admin");

  // Fetch existing invite link
  const { data: existingInvite } = useQuery({
    queryKey: ["team-channel-invite", channel.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("team_channel_invites")
        .select("token")
        .eq("channel_id", channel.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      return data;
    },
    enabled: open && isAdmin,
  });

  useEffect(() => {
    if (existingInvite?.token) {
      setInviteLink(`${window.location.origin}/chat-invite/${existingInvite.token}`);
    }
  }, [existingInvite]);

  const generateInviteLink = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("team_channel_invites")
        .insert({
          channel_id: channel.id,
          tenant_id: tenantId,
          created_by: currentUserId!,
        })
        .select("token")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      const link = `${window.location.origin}/chat-invite/${data.token}`;
      setInviteLink(link);
      queryClient.invalidateQueries({ queryKey: ["team-channel-invite", channel.id] });
      toast.success("קישור הזמנה נוצר בהצלחה");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const copyInviteLink = () => {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      toast.success("הקישור הועתק");
      setTimeout(() => setCopied(false), 2000);
    }
  };

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
        tenant_id: tenantId,
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

          {/* Invite Link Section */}
          {isAdmin && (
            <>
              <Separator className="my-3" />
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Link2 className="h-4 w-4" />
                  קישור הזמנה חיצוני
                </h4>
                <p className="text-xs text-muted-foreground">שתף קישור עם אנשים מחוץ למערכת. הם יוכלו להירשם ולקבל גישה לצ׳אט הזה בלבד.</p>
                {inviteLink ? (
                  <div className="flex gap-2">
                    <Input value={inviteLink} readOnly className="text-xs" dir="ltr" />
                    <Button size="sm" variant="outline" onClick={copyInviteLink}>
                      {copied ? "הועתק!" : "העתק"}
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" className="w-full" onClick={() => generateInviteLink.mutate()} disabled={generateInviteLink.isPending}>
                    {generateInviteLink.isPending ? "יוצר..." : "צור קישור הזמנה"}
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// =================== ChannelAvatarDialog ===================
function ChannelAvatarDialog({ channel, tenantId, onUpdated }: { channel: TeamChannel; tenantId: string; onUpdated: () => void }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'upload' | 'ai'>('upload');
  const [aiPrompt, setAiPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `avatars/${channel.id}-${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from("team-chat-files").upload(filePath, file);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("team-chat-files").getPublicUrl(filePath);
      
      const { error } = await supabase.from("team_channels").update({ avatar_url: urlData.publicUrl }).eq("id", channel.id);
      if (error) throw error;
      
      toast.success("האווטר עודכן בהצלחה");
      onUpdated();
      setOpen(false);
    } catch (err: any) {
      toast.error("שגיאה בהעלאה: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const generateWithAI = async () => {
    if (!aiPrompt.trim()) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-channel-avatar", {
        body: { prompt: aiPrompt, channelId: channel.id, tenantId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      toast.success("האווטר נוצר בהצלחה!");
      onUpdated();
      setOpen(false);
    } catch (err: any) {
      toast.error("שגיאה ביצירת אווטר: " + err.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="h-8 w-8 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0 cursor-pointer hover:opacity-80 transition-opacity overflow-hidden" style={{ backgroundColor: channel.color }}>
          {channel.avatar_url ? (
            <img src={channel.avatar_url} alt={channel.name} className="h-full w-full object-cover" />
          ) : (
            channel.is_private ? <Lock className="h-4 w-4" /> : <Hash className="h-4 w-4" />
          )}
        </button>
      </DialogTrigger>
      <DialogContent dir="rtl" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>שנה אווטר ערוץ</DialogTitle>
          <DialogDescription>העלה תמונה או צור אווטר באמצעות AI</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Button variant={tab === 'upload' ? 'default' : 'outline'} size="sm" onClick={() => setTab('upload')} className="flex-1 gap-1.5">
              <Upload className="h-4 w-4" /> העלאת תמונה
            </Button>
            <Button variant={tab === 'ai' ? 'default' : 'outline'} size="sm" onClick={() => setTab('ai')} className="flex-1 gap-1.5">
              <Sparkles className="h-4 w-4" /> יצירה ב-AI
            </Button>
          </div>

          {tab === 'upload' ? (
            <div className="space-y-3">
              <input type="file" ref={fileInputRef} onChange={handleUpload} className="hidden" accept="image/*" />
              <Button variant="outline" className="w-full h-24 border-dashed" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : (
                  <div className="flex flex-col items-center gap-1">
                    <Camera className="h-6 w-6 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">לחץ לבחירת תמונה</span>
                  </div>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <Input value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} placeholder="תאר את האווטר שאתה רוצה..." />
              <p className="text-xs text-muted-foreground">למשל: &quot;לוגו מעוצב לקבוצת שיווק בצבעים כחול וכתום&quot;</p>
              <Button className="w-full" onClick={generateWithAI} disabled={!aiPrompt.trim() || generating}>
                {generating ? <><Loader2 className="h-4 w-4 animate-spin ml-2" /> יוצר...</> : <><Sparkles className="h-4 w-4 ml-2" /> צור אווטר</>}
              </Button>
            </div>
          )}

          {channel.avatar_url && (
            <div className="space-y-2">
              <Label className="text-xs">אווטר נוכחי:</Label>
              <div className="flex items-center gap-3">
                <img src={channel.avatar_url} alt="current avatar" className="h-12 w-12 rounded-lg object-cover" />
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={async () => {
                  await supabase.from("team_channels").update({ avatar_url: null }).eq("id", channel.id);
                  toast.success("האווטר הוסר");
                  onUpdated();
                  setOpen(false);
                }}>
                  <Trash2 className="h-3.5 w-3.5 ml-1" /> הסר אווטר
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// =================== EditChannelDialog ===================
function EditChannelDialog({ channel, tenantId, isAdmin, onUpdated, onDeleted }: { channel: TeamChannel; tenantId: string; isAdmin: boolean; onUpdated: () => void; onDeleted: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(channel.name);
  const [description, setDescription] = useState(channel.description || "");
  const [color, setColor] = useState(channel.color);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (open) {
      setName(channel.name);
      setDescription(channel.description || "");
      setColor(channel.color);
    }
  }, [open, channel]);

  const colors = ["#3B82F6", "#EF4444", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899", "#06B6D4", "#F97316"];

  const updateChannel = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("team_channels").update({ name, description: description || null, color }).eq("id", channel.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("הערוץ עודכן בהצלחה");
      onUpdated();
      setOpen(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteChannel = async () => {
    setDeleting(true);
    try {
      // Delete members, messages, then channel
      await supabase.from("team_channel_members").delete().eq("channel_id", channel.id);
      await supabase.from("team_messages").delete().eq("channel_id", channel.id);
      const { error } = await supabase.from("team_channels").delete().eq("id", channel.id);
      if (error) throw error;
      toast.success("הערוץ נמחק בהצלחה");
      onDeleted();
      setOpen(false);
    } catch (err: any) {
      toast.error("שגיאה במחיקה: " + err.message);
    } finally {
      setDeleting(false);
    }
  };

  if (!isAdmin) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" title="הגדרות ערוץ">
            <Settings className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>הגדרות ערוץ</DialogTitle>
            <DialogDescription>ערוך את פרטי הערוץ או מחק אותו</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>שם הערוץ</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>תיאור</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="תיאור קצר..." />
            </div>
            <div>
              <Label>צבע</Label>
              <div className="flex gap-2 mt-1">
                {colors.map((c) => (
                  <button key={c} className={cn("h-7 w-7 rounded-full border-2 transition-all", color === c ? "border-foreground scale-110" : "border-transparent")} style={{ backgroundColor: c }} onClick={() => setColor(c)} />
                ))}
              </div>
            </div>
            <DialogFooter className="flex gap-2 sm:gap-0">
              <Button variant="destructive" size="sm" onClick={() => setShowDeleteConfirm(true)}>
                <Trash2 className="h-4 w-4 ml-1" /> מחק ערוץ
              </Button>
              <Button onClick={() => updateChannel.mutate()} disabled={!name.trim() || updateChannel.isPending}>
                {updateChannel.isPending ? "שומר..." : "שמור שינויים"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת ערוץ &quot;{channel.name}&quot;</AlertDialogTitle>
            <AlertDialogDescription>פעולה זו תמחק את הערוץ, כל ההודעות וכל החברים. לא ניתן לבטל פעולה זו.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>ביטול</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={deleteChannel} disabled={deleting}>
              {deleting ? "מוחק..." : "מחק לצמיתות"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// =================== ChannelHeader ===================
function ChannelHeader({
  channel,
  members,
  tenantId,
  currentUserId,
  onMembersChanged,
  onBack,
  onChannelUpdated,
  onChannelDeleted,
}: {
  channel: TeamChannel;
  members: ChannelMember[];
  tenantId: string;
  currentUserId?: string;
  onMembersChanged: () => void;
  onBack?: () => void;
  onChannelUpdated: () => void;
  onChannelDeleted: () => void;
}) {
  const isAdmin = members.some((m) => m.user_id === currentUserId && m.role === "admin");

  return (
    <div className="h-14 border-b flex items-center gap-3 px-4 shrink-0">
      {onBack && (
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onBack}>
          <ArrowRight className="h-4 w-4" />
        </Button>
      )}
      <ChannelAvatarDialog channel={channel} tenantId={tenantId} onUpdated={onChannelUpdated} />
      <div className="flex-1 min-w-0">
        <h2 className="font-semibold text-sm">{channel.name}</h2>
        {channel.description && <p className="text-xs text-muted-foreground truncate">{channel.description}</p>}
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 text-muted-foreground text-xs">
          <Users className="h-3.5 w-3.5" />
          {members.length}
        </div>
        <EditChannelDialog channel={channel} tenantId={tenantId} isAdmin={isAdmin} onUpdated={onChannelUpdated} onDeleted={onChannelDeleted} />
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
  const { selectedAgency } = useAgency();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [taskMessage, setTaskMessage] = useState<TeamMessage | null>(null);
  const [linkDialogFiles, setLinkDialogFiles] = useState<{ id: string; file_name: string; file_url: string }[]>([]);
  const [showLinkDialog, setShowLinkDialog] = useState(false);

  // Fetch channels
  const { data: allChannels = [], refetch: refetchChannels } = useQuery({
    queryKey: ["team-channels", tenantId, userId],
    queryFn: async () => {
      const { data: memberships, error: memError } = await supabase
        .from("team_channel_members")
        .select("channel_id")
        .eq("user_id", userId!)
        .eq("tenant_id", tenantId);
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

  // Filter channels by selected agency
  const channels = selectedAgency === "all"
    ? allChannels
    : allChannels.filter((ch) => !ch.agency_id || ch.agency_id === selectedAgency);

  // Auto-select first channel (only on desktop)
  useEffect(() => {
    if (!isMobile && channels.length > 0 && !activeChannelId) {
      setActiveChannelId(channels[0].id);
    }
  }, [channels, activeChannelId, isMobile]);

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
        { event: "*", schema: "public", table: "team_messages", filter: `channel_id=eq.${activeChannelId}` },
        () => refetchMessages()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeChannelId, refetchMessages]);

  // Edit message mutation
  const editMessage = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      const { error } = await supabase.from("team_messages").update({ content, is_edited: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => refetchMessages(),
    onError: (err: any) => toast.error("שגיאה בעריכת ההודעה: " + err.message),
  });

  // Delete message mutation
  const deleteMessage = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("team_messages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { refetchMessages(); toast.success("ההודעה נמחקה"); },
    onError: (err: any) => toast.error("שגיאה במחיקת ההודעה: " + err.message),
  });

  const unreadCounts: Record<string, number> = {};

  if (!tenantId) return null;

  const showSidebar = isMobile ? !activeChannelId : true;
  const showChat = isMobile ? !!activeChannelId : true;

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-background" dir="rtl">
      {/* Channel Sidebar */}
      {showSidebar && (
        <ChannelSidebar
          channels={channels}
          activeChannelId={activeChannelId}
          onSelect={setActiveChannelId}
          tenantId={tenantId}
          onCreated={refetchChannels}
          unreadCounts={unreadCounts}
        />
      )}

      {/* Main Chat Area */}
      {showChat && (
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          {activeChannel ? (
            <>
              <ChannelHeader
                channel={activeChannel}
                members={members}
                tenantId={tenantId}
                currentUserId={userId}
                onMembersChanged={() => queryClient.invalidateQueries({ queryKey: ["team-channel-members", activeChannelId] })}
                onBack={isMobile ? () => setActiveChannelId(null) : undefined}
                onChannelUpdated={() => refetchChannels()}
                onChannelDeleted={() => { setActiveChannelId(null); refetchChannels(); }}
              />
              <TeamMessageList
                messages={messages}
                currentUserId={userId}
                onConvertToTask={(msg) => setTaskMessage(msg)}
                onEditMessage={(msg, newContent) => editMessage.mutate({ id: msg.id, content: newContent })}
                onDeleteMessage={(msg) => deleteMessage.mutate(msg.id)}
              />
              <TeamMessageInput
                channelId={activeChannel.id}
                tenantId={tenantId}
                onSent={refetchMessages}
                onFilesUploaded={(files) => {
                  setLinkDialogFiles(files);
                  setShowLinkDialog(true);
                }}
              />
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
      )}

      {/* Link files dialog */}
      <LinkFileToEntityDialog
        open={showLinkDialog}
        onOpenChange={setShowLinkDialog}
        tenantId={tenantId}
        files={linkDialogFiles}
        onLinked={() => setLinkDialogFiles([])}
      />
    </div>
  );
}
