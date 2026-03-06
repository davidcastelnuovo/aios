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
import { Plus, Send, Hash, Lock, Users, UserPlus, X, Smile, Trash2, ListTodo, Paperclip, Link2, FileText, Image as ImageIcon, File, Mic, Square, Loader2, Building2, User, Target, Settings, Pencil, ArrowRight, Check, Upload, Sparkles, Camera, Bell, MessageSquare, Reply, Phone, Globe } from "lucide-react";
import { Switch } from "@/components/ui/switch";
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
  notification_group_link?: string | null;
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
  sender_profile?: { full_name: string; email: string; avatar_url?: string };
  reply_count?: number;
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
        .select("id, full_name, email, avatar_url")
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

// =================== ManageTeamMembersDialog ===================
function ManageTeamMembersDialog({ tenantId }: { tenantId: string }) {
  const [open, setOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editPhone, setEditPhone] = useState("");
  const [editNotifLink, setEditNotifLink] = useState("");
  const [uploading, setUploading] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [generatingAi, setGeneratingAi] = useState(false);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Fetch all tenant members with profiles
  const { data: teamMembers = [], refetch: refetchMembers } = useQuery({
    queryKey: ["team-members-manage", tenantId],
    queryFn: async () => {
      const { data: tuData } = await supabase
        .from("tenant_users")
        .select("user_id, tenant_id")
        .eq("tenant_id", tenantId);
      if (!tuData || tuData.length === 0) return [];

      const userIds = tuData.map((tu: any) => tu.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone, avatar_url, notification_group_link")
        .in("id", userIds);
      
      return (profiles || []) as any[];
    },
    enabled: !!tenantId && open,
  });

  const startEdit = (member: any) => {
    setEditingUser(member);
    setEditPhone(member.phone || "");
    setEditNotifLink(member.notification_group_link || "");
    setAiPrompt("");
  };

  const saveEdit = async () => {
    if (!editingUser) return;
    const { error } = await supabase
      .from("profiles")
      .update({
        phone: editPhone || null,
        notification_group_link: editNotifLink || null,
      })
      .eq("id", editingUser.id);
    if (error) {
      toast.error("שגיאה בשמירה: " + error.message);
      return;
    }
    toast.success("הפרטים עודכנו בהצלחה");
    setEditingUser(null);
    refetchMembers();
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingUser) return;
    setUploading(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `user-avatars/${editingUser.id}-${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from("team-chat-files").upload(filePath, file);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("team-chat-files").getPublicUrl(filePath);

      const { error } = await supabase.from("profiles").update({ avatar_url: urlData.publicUrl }).eq("id", editingUser.id);
      if (error) throw error;

      toast.success("התמונה עודכנה");
      refetchMembers();
      setEditingUser({ ...editingUser, avatar_url: urlData.publicUrl });
    } catch (err: any) {
      toast.error("שגיאה בהעלאה: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const generateAvatarAI = async () => {
    if (!aiPrompt.trim() || !editingUser) return;
    setGeneratingAi(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-channel-avatar", {
        body: { prompt: aiPrompt, channelId: `user-${editingUser.id}`, tenantId },
      });
      if (error) throw error;
      if (data?.avatar_url) {
        await supabase.from("profiles").update({ avatar_url: data.avatar_url }).eq("id", editingUser.id);
        toast.success("האווטר נוצר בהצלחה!");
        refetchMembers();
        setEditingUser({ ...editingUser, avatar_url: data.avatar_url });
      }
    } catch (err: any) {
      toast.error("שגיאה ביצירת אווטר: " + err.message);
    } finally {
      setGeneratingAi(false);
    }
  };

  const removeAvatar = async () => {
    if (!editingUser) return;
    const { error } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", editingUser.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("התמונה הוסרה");
    refetchMembers();
    setEditingUser({ ...editingUser, avatar_url: null });
  };

  const deleteUser = async () => {
    if (!deleteConfirmUser) return;
    try {
      const { error } = await supabase.functions.invoke("delete-user", {
        body: { userId: deleteConfirmUser.id },
      });
      if (error) throw error;
      toast.success("המשתמש נמחק");
      setDeleteConfirmUser(null);
      refetchMembers();
    } catch (err: any) {
      toast.error("שגיאה במחיקה: " + err.message);
    }
  };

  return (
    <>
      <Dialog open={open && !editingUser} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7" title="ניהול אנשי צוות">
            <Users className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent dir="rtl" className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>ניהול אנשי צוות</DialogTitle>
            <DialogDescription>הגדר טלפון, קישור להתראות ותמונה לכל איש צוות</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-2 p-1">
              {teamMembers.map((member: any) => (
                <div key={member.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={member.avatar_url || undefined} />
                    <AvatarFallback className="text-sm">
                      {(member.full_name || member.email || "?")[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{member.full_name || member.email}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {member.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          <span dir="ltr">{member.phone}</span>
                        </span>
                      )}
                      {member.notification_group_link && (
                        <span className="flex items-center gap-1">
                          <Globe className="h-3 w-3" />
                          קישור התראות
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(member)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteConfirmUser(member)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
              {teamMembers.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">אין אנשי צוות</p>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Edit Member Dialog */}
      <Dialog open={!!editingUser} onOpenChange={(o) => { if (!o) setEditingUser(null); }}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>עריכת {editingUser?.full_name || "איש צוות"}</DialogTitle>
            <DialogDescription>עדכן פרטים, תמונה והגדרות התראות</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Avatar section */}
            <div className="flex flex-col items-center gap-3">
              <Avatar className="h-20 w-20">
                <AvatarImage src={editingUser?.avatar_url || undefined} />
                <AvatarFallback className="text-2xl">
                  {(editingUser?.full_name || "?")[0]}
                </AvatarFallback>
              </Avatar>
              <div className="flex gap-2">
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 ml-1" />}
                  העלה תמונה
                </Button>
                {editingUser?.avatar_url && (
                  <Button size="sm" variant="outline" className="text-destructive" onClick={removeAvatar}>
                    <Trash2 className="h-4 w-4 ml-1" /> הסר
                  </Button>
                )}
              </div>

              {/* AI Avatar */}
              <div className="w-full space-y-2">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> יצירת אווטר עם AI
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="תאר את האווטר הרצוי..."
                    className="text-sm"
                  />
                  <Button size="sm" onClick={generateAvatarAI} disabled={!aiPrompt.trim() || generatingAi}>
                    {generatingAi ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>

            <Separator />

            {/* Phone */}
            <div>
              <Label className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" /> מספר טלפון
              </Label>
              <Input
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                placeholder="למשל: 972501234567"
                dir="ltr"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">מספר טלפון לשליחת התראות בוואטסאפ</p>
            </div>

            {/* Notification Group Link */}
            <div>
              <Label className="flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5" /> קישור לקבוצת התראות
              </Label>
              <Input
                value={editNotifLink}
                onChange={(e) => setEditNotifLink(e.target.value)}
                placeholder="https://chat.whatsapp.com/..."
                dir="ltr"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">קישור לקבוצת וואטסאפ שבה ישלחו התראות</p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingUser(null)}>ביטול</Button>
              <Button onClick={saveEdit}>שמור</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmUser} onOpenChange={(o) => { if (!o) setDeleteConfirmUser(null); }}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת {deleteConfirmUser?.full_name || "משתמש"}</AlertDialogTitle>
            <AlertDialogDescription>פעולה זו תמחק את המשתמש לצמיתות. לא ניתן לבטל.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={deleteUser}>
              מחק
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

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

  const renderChannelItem = (ch: TeamChannel) => {
    const unread = unreadCounts[ch.id] || 0;
    return (
      <button
        key={ch.id}
        onClick={() => onSelect(ch.id)}
        className={cn(
          "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-right",
          activeChannelId === ch.id ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-muted-foreground",
          unread > 0 && activeChannelId !== ch.id && "font-bold text-foreground"
        )}
      >
        {ch.avatar_url ? (
          <img src={ch.avatar_url} alt={ch.name} className="h-4 w-4 rounded shrink-0 object-cover" />
        ) : (
          ch.is_private ? <Lock className="h-3.5 w-3.5 shrink-0" /> : <Hash className="h-3.5 w-3.5 shrink-0" />
        )}
        <span className="flex-1 truncate">{ch.name}</span>
        {unread > 0 && (
          <Badge variant="destructive" className="h-5 min-w-5 text-xs px-1">
            {unread}
          </Badge>
        )}
      </button>
    );
  };

  return (
    <div className="w-full md:w-64 border-l bg-muted/30 flex flex-col h-full">
      <div className="p-3 flex items-center justify-between border-b">
        <div className="flex items-center gap-1">
          <ManageTeamMembersDialog tenantId={tenantId} />
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
function TeamMessageList({ messages, currentUserId, onConvertToTask, onEditMessage, onDeleteMessage, onNotifyMessage, onReplyMessage, allMessages }: { messages: TeamMessage[]; currentUserId?: string; onConvertToTask?: (msg: TeamMessage) => void; onEditMessage?: (msg: TeamMessage, newContent: string) => void; onDeleteMessage?: (msg: TeamMessage) => void; onNotifyMessage?: (msg: TeamMessage) => void; onReplyMessage?: (msg: TeamMessage) => void; allMessages?: TeamMessage[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [deleteConfirmMsg, setDeleteConfirmMsg] = useState<TeamMessage | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

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
                          <AvatarImage src={msg.sender_profile?.avatar_url || undefined} />
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
                      {/* Reply indicator - show which message this replies to */}
                      {msg.parent_message_id && (() => {
                        const parentMsg = allMessages?.find(m => m.id === msg.parent_message_id);
                        return parentMsg ? (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5 cursor-pointer hover:text-foreground" onClick={() => onReplyMessage?.(parentMsg)}>
                            <Reply className="h-3 w-3 rotate-180" />
                            <span className="truncate max-w-[250px]">בתגובה ל: {parentMsg.sender_profile?.full_name} — {parentMsg.content?.slice(0, 50)}{(parentMsg.content?.length || 0) > 50 ? "..." : ""}</span>
                          </div>
                        ) : null;
                      })()}
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
                          {msg.attachments.filter(att => att.type === 'image').length > 0 && (
                            <div className={cn(
                              "grid gap-1",
                              msg.attachments.filter(a => a.type === 'image').length === 1 ? "grid-cols-1" : "grid-cols-2"
                            )}>
                              {msg.attachments.filter(att => att.type === 'image').map((att, idx) => (
                                <button
                                  key={`img-${idx}`}
                                  className="relative rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                                  onClick={() => setLightboxImage(att.url)}
                                >
                                  <img
                                    src={att.url}
                                    alt={att.name}
                                    className="max-w-[240px] max-h-[200px] rounded-lg object-cover"
                                    loading="lazy"
                                  />
                                </button>
                              ))}
                            </div>
                          )}
                          {msg.attachments.filter(att => att.type !== 'image').map((att, idx) => (
                            <a
                              key={`file-${idx}`}
                              href={att.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-muted hover:bg-muted/80 text-xs transition-colors border"
                            >
                              {att.type === 'link' ? <Link2 className="h-3.5 w-3.5 text-green-500" /> :
                               <FileText className="h-3.5 w-3.5 text-orange-500" />}
                              <span className="max-w-[200px] truncate">{att.name}</span>
                            </a>
                          ))}
                        </div>
                      )}
                      {/* Reply count indicator */}
                      {(msg.reply_count || 0) > 0 && (
                        <button
                          onClick={() => onReplyMessage?.(msg)}
                          className="flex items-center gap-1 mt-1 text-xs text-primary hover:underline"
                        >
                          <MessageSquare className="h-3 w-3" />
                          {msg.reply_count} תגובות
                        </button>
                      )}
                    </div>
                    {/* Action buttons - visible on hover */}
                    <div className="absolute left-1 top-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5">
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="הגב להודעה" onClick={() => onReplyMessage?.(msg)}>
                        <MessageSquare className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="שלח התראה לחברי הערוץ" onClick={() => onNotifyMessage?.(msg)}>
                        <Bell className="h-3.5 w-3.5" />
                      </Button>
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

      {/* Image Lightbox */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center cursor-pointer"
          onClick={() => setLightboxImage(null)}
        >
          <button
            className="absolute top-4 right-4 text-white hover:text-white/80 z-10"
            onClick={() => setLightboxImage(null)}
          >
            <X className="h-8 w-8" />
          </button>
          <img
            src={lightboxImage}
            alt="תצוגה מוגדלת"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
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
      className={cn("p-3 border-t space-y-2 transition-colors shrink-0 sticky bottom-0 bg-background z-10", isDragOver && "bg-primary/5 border-primary")}
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

// =================== MemberNotifyRow ===================
function MemberNotifyRow({
  member,
  profile,
  settings,
  onSettingsChange,
}: {
  member: ChannelMember;
  profile?: { full_name: string; email: string; avatar_url?: string };
  settings: { notify_enabled: boolean; notify_override_phone: string; notify_override_group: string };
  onSettingsChange: (s: { notify_enabled: boolean; notify_override_phone: string; notify_override_group: string }) => void;
}) {
  const [showOverrides, setShowOverrides] = useState(false);
  return (
    <div className="border rounded-lg p-2 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Avatar className="h-6 w-6">
            <AvatarFallback className="text-[10px]">
              {(profile?.full_name || "?")[0]}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs">{profile?.full_name || profile?.email || "משתמש"}</span>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={settings.notify_enabled}
            onCheckedChange={(checked) => onSettingsChange({ ...settings, notify_enabled: checked })}
          />
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowOverrides(!showOverrides)}>
            <Settings className="h-3 w-3" />
          </Button>
        </div>
      </div>
      {showOverrides && settings.notify_enabled && (
        <div className="space-y-1 pr-8">
          <Input
            value={settings.notify_override_group}
            onChange={(e) => onSettingsChange({ ...settings, notify_override_group: e.target.value })}
            placeholder="קבוצה ספציפית (chatId)"
            className="text-[10px] h-7"
            dir="ltr"
          />
          <Input
            value={settings.notify_override_phone}
            onChange={(e) => onSettingsChange({ ...settings, notify_override_phone: e.target.value })}
            placeholder="טלפון ספציפי"
            className="text-[10px] h-7"
            dir="ltr"
          />
        </div>
      )}
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
  const [channelGroupLink, setChannelGroupLink] = useState(channel.notification_group_link || "");
  const [memberNotifySettings, setMemberNotifySettings] = useState<Record<string, { notify_enabled: boolean; notify_override_phone: string; notify_override_group: string }>>({});
  const queryClient = useQueryClient();

  const isAdmin = members.some((m) => m.user_id === currentUserId && m.role === "admin");

  // Load member notification settings
  useEffect(() => {
    if (open && members.length > 0) {
      const settings: Record<string, { notify_enabled: boolean; notify_override_phone: string; notify_override_group: string }> = {};
      // We need to fetch the actual settings from DB
      supabase
        .from("team_channel_members")
        .select("user_id, notify_enabled, notify_override_phone, notify_override_group")
        .eq("channel_id", channel.id)
        .then(({ data }) => {
          if (data) {
            data.forEach((m: any) => {
              settings[m.user_id] = {
                notify_enabled: m.notify_enabled !== false,
                notify_override_phone: m.notify_override_phone || "",
                notify_override_group: m.notify_override_group || "",
              };
            });
          }
          // Fill missing members with defaults
          members.forEach(m => {
            if (!settings[m.user_id]) {
              settings[m.user_id] = { notify_enabled: true, notify_override_phone: "", notify_override_group: "" };
            }
          });
          setMemberNotifySettings(settings);
        });
      setChannelGroupLink(channel.notification_group_link || "");
    }
  }, [open, members, channel.id, channel.notification_group_link]);

  const saveNotificationSettings = useMutation({
    mutationFn: async () => {
      // Save channel-level group link
      const { error: chErr } = await supabase
        .from("team_channels")
        .update({ notification_group_link: channelGroupLink || null })
        .eq("id", channel.id);
      if (chErr) throw chErr;

      // Save per-member settings
      for (const [userId, s] of Object.entries(memberNotifySettings)) {
        const { error } = await supabase
          .from("team_channel_members")
          .update({
            notify_enabled: s.notify_enabled,
            notify_override_phone: s.notify_override_phone || null,
            notify_override_group: s.notify_override_group || null,
          })
          .eq("channel_id", channel.id)
          .eq("user_id", userId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("הגדרות התראות נשמרו");
      queryClient.invalidateQueries({ queryKey: ["team-channels"] });
      onChanged();
    },
    onError: (err: any) => toast.error("שגיאה בשמירה: " + err.message),
  });

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
          tenant_id: channel.tenant_id,
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
        .select("id, full_name, email, avatar_url")
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
      const { data } = await supabase.from("profiles").select("id, full_name, email, avatar_url").in("id", memberIds);
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
        tenant_id: channel.tenant_id,
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
                        <AvatarImage src={profile?.avatar_url || undefined} />
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
                          <AvatarImage src={profile.avatar_url || undefined} />
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

          {/* Notification Settings */}
          {isAdmin && (
            <>
              <Separator className="my-3" />
              <div className="space-y-3">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  הגדרות התראות
                </h4>

                {/* Channel-level group */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">קבוצת וואטסאפ לערוץ (chatId של הקבוצה)</Label>
                  <Input
                    value={channelGroupLink}
                    onChange={(e) => setChannelGroupLink(e.target.value)}
                    placeholder="לדוגמה: 120363xxx@g.us"
                    className="text-xs"
                    dir="ltr"
                  />
                  <p className="text-[10px] text-muted-foreground">אם מוגדר, כל התראות הערוץ ישלחו לקבוצה זו</p>
                </div>

                {/* Per-member notification settings */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">הגדרות לכל חבר</Label>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {members.map((member) => (
                      <MemberNotifyRow
                        key={member.id}
                        member={member}
                        profile={getMemberProfile(member.user_id)}
                        settings={memberNotifySettings[member.user_id] || { notify_enabled: true, notify_override_phone: "", notify_override_group: "" }}
                        onSettingsChange={(s) =>
                          setMemberNotifySettings(prev => ({ ...prev, [member.user_id]: s }))
                        }
                      />
                    ))}
                  </div>
                </div>

                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => saveNotificationSettings.mutate()}
                  disabled={saveNotificationSettings.isPending}
                >
                  {saveNotificationSettings.isPending ? "שומר..." : "שמור הגדרות התראות"}
                </Button>
              </div>
            </>
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
  const [newChatId, setNewChatId] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open) {
      setName(channel.name);
      setDescription(channel.description || "");
      setColor(channel.color);
    }
  }, [open, channel]);

  const colors = ["#3B82F6", "#EF4444", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899", "#06B6D4", "#F97316"];

  // Fetch WhatsApp groups in tenant
  const { data: waGroups = [] } = useQuery({
    queryKey: ["wa-groups-for-link", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("whatsapp_groups").select("id, group_name, group_chat_id").eq("tenant_id", tenantId);
      return data || [];
    },
    enabled: open,
  });

  // Fetch existing links
  const { data: waLinks = [], refetch: refetchLinks } = useQuery({
    queryKey: ["wa-channel-links", channel.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("team_channel_whatsapp_links")
        .select("*")
        .eq("channel_id", channel.id);
      return data || [];
    },
    enabled: open,
  });

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

  const addWaLink = useMutation({
    mutationFn: async ({ groupId, chatId, displayName }: { groupId?: string; chatId?: string; displayName?: string }) => {
      const insertData: any = {
        channel_id: channel.id,
        tenant_id: tenantId,
        display_name: displayName || null,
        forward_files: true,
      };
      if (groupId) {
        insertData.whatsapp_group_id = groupId;
      } else if (chatId) {
        insertData.whatsapp_chat_id = chatId;
      }
      const { error } = await supabase.from("team_channel_whatsapp_links").insert(insertData);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("שיוך וואטסאפ נוסף");
      setNewChatId("");
      setNewDisplayName("");
      refetchLinks();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const removeWaLink = useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await supabase.from("team_channel_whatsapp_links").delete().eq("id", linkId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("שיוך הוסר");
      refetchLinks();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteChannel = async () => {
    setDeleting(true);
    try {
      await supabase.from("team_channel_whatsapp_links").delete().eq("channel_id", channel.id);
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

  // Groups not yet linked
  const linkedGroupIds = new Set(waLinks.filter((l: any) => l.whatsapp_group_id).map((l: any) => l.whatsapp_group_id));
  const availableGroups = waGroups.filter((g: any) => !linkedGroupIds.has(g.id));

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" title="הגדרות ערוץ">
            <Settings className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent dir="rtl" className="sm:max-w-md max-h-[80vh] overflow-y-auto">
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

            {/* WhatsApp Links Section */}
            <Separator />
            <div className="space-y-3">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Phone className="h-4 w-4" />
                שיוך וואטסאפ לערוץ
              </h4>
              <p className="text-[10px] text-muted-foreground">הודעות מקבוצות/צ'אטים משויכים יועברו אוטומטית לערוץ זה</p>

              {/* Existing links */}
              {waLinks.length > 0 && (
                <div className="space-y-1">
                  {waLinks.map((link: any) => {
                    const group = waGroups.find((g: any) => g.id === link.whatsapp_group_id);
                    return (
                      <div key={link.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/50 text-xs">
                        <div className="flex items-center gap-2">
                          <Globe className="h-3.5 w-3.5 text-green-600" />
                          <span>{link.display_name || group?.group_name || link.whatsapp_chat_id || "צ'אט"}</span>
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeWaLink.mutate(link.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add from existing WhatsApp groups */}
              {availableGroups.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground">הוסף קבוצת וואטסאפ</Label>
                  <div className="space-y-1 max-h-32 overflow-y-auto mt-1">
                    {availableGroups.map((g: any) => (
                      <button
                        key={g.id}
                        className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg hover:bg-muted transition-colors text-xs"
                        onClick={() => addWaLink.mutate({ groupId: g.id, displayName: g.group_name })}
                        disabled={addWaLink.isPending}
                      >
                        <div className="flex items-center gap-2">
                          <Users className="h-3.5 w-3.5 text-green-600" />
                          <span>{g.group_name}</span>
                        </div>
                        <Plus className="h-3.5 w-3.5 text-primary" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Add by chatId manually */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">או הוסף לפי chatId</Label>
                <div className="flex gap-2">
                  <Input
                    value={newChatId}
                    onChange={(e) => setNewChatId(e.target.value)}
                    placeholder="לדוגמה: 972501234567@c.us"
                    className="text-xs"
                    dir="ltr"
                  />
                </div>
                <Input
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  placeholder="שם תצוגה (אופציונלי)"
                  className="text-xs"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  disabled={!newChatId.trim() || addWaLink.isPending}
                  onClick={() => addWaLink.mutate({ chatId: newChatId.trim(), displayName: newDisplayName.trim() || newChatId.trim() })}
                >
                  <Plus className="h-3.5 w-3.5 ml-1" />
                  הוסף צ'אט
                </Button>
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

// =================== ThreadDialog ===================
function ThreadDialog({
  parentMessage,
  open,
  onOpenChange,
  channelId,
  tenantId,
  currentUserId,
}: {
  parentMessage: TeamMessage | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channelId: string;
  tenantId: string;
  currentUserId?: string;
}) {
  const [replyText, setReplyText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: replies = [], refetch: refetchReplies } = useQuery({
    queryKey: ["thread-replies", parentMessage?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_messages")
        .select("*")
        .eq("parent_message_id", parentMessage!.id)
        .order("created_at", { ascending: true });
      if (error) throw error;

      const senderIds = [...new Set(data.map((m: any) => m.sender_id))];
      if (senderIds.length === 0) return [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url")
        .in("id", senderIds);

      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
      return data.map((m: any) => ({
        ...m,
        sender_profile: profileMap.get(m.sender_id),
      })) as TeamMessage[];
    },
    enabled: !!parentMessage?.id && open,
  });

  // Realtime for thread
  useEffect(() => {
    if (!parentMessage?.id || !open) return;
    const channel = supabase
      .channel(`thread-${parentMessage.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "team_messages", filter: `parent_message_id=eq.${parentMessage.id}` },
        () => refetchReplies()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [parentMessage?.id, open, refetchReplies]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [replies.length]);

  const sendReply = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("team_messages").insert({
        channel_id: channelId,
        tenant_id: tenantId,
        sender_id: currentUserId!,
        content: replyText.trim(),
        parent_message_id: parentMessage!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setReplyText("");
      refetchReplies();
      // Invalidate main messages to update reply_count
      queryClient.invalidateQueries({ queryKey: ["team-messages", channelId] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  if (!parentMessage) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="sm:max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-sm">שרשור תגובות</DialogTitle>
          <DialogDescription className="sr-only">תגובות להודעה</DialogDescription>
        </DialogHeader>

        {/* Parent message */}
        <div className="p-3 rounded-lg bg-muted/50 border">
          <div className="flex items-baseline gap-2 mb-1">
            <span className="font-semibold text-sm">{parentMessage.sender_profile?.full_name || "משתמש"}</span>
            <span className="text-xs text-muted-foreground">{format(new Date(parentMessage.created_at), "HH:mm dd/MM", { locale: he })}</span>
          </div>
          <p className="text-sm whitespace-pre-wrap">{parentMessage.content}</p>
        </div>

        <Separator />

        {/* Replies */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0 space-y-2 max-h-[40vh]">
          {replies.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">אין תגובות עדיין. היה הראשון להגיב!</p>
          )}
          {replies.map((reply) => (
            <div key={reply.id} className="flex gap-2 px-1">
              <Avatar className="h-6 w-6 shrink-0 mt-0.5">
                <AvatarImage src={reply.sender_profile?.avatar_url || undefined} />
                <AvatarFallback className="text-[10px]">
                  {(reply.sender_profile?.full_name || "?")[0]}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="font-medium text-xs">{reply.sender_profile?.full_name || "משתמש"}</span>
                  <span className="text-[10px] text-muted-foreground">{format(new Date(reply.created_at), "HH:mm")}</span>
                </div>
                <p className="text-sm whitespace-pre-wrap break-words">{reply.content}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Reply input */}
        <div className="flex gap-2 items-end pt-2 border-t">
          <Textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="כתוב תגובה..."
            className="min-h-[36px] max-h-24 resize-none text-sm"
            rows={1}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (replyText.trim()) sendReply.mutate();
              }
            }}
          />
          <Button size="icon" onClick={() => replyText.trim() && sendReply.mutate()} disabled={!replyText.trim() || sendReply.isPending}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// =================== Main TeamChat Page ===================
export default function TeamChat() {
  const { tenantId, tenant } = useCurrentTenant();
  const { userId } = useCurrentUser();
  const { selectedAgency } = useAgency();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [taskMessage, setTaskMessage] = useState<TeamMessage | null>(null);
  const [linkDialogFiles, setLinkDialogFiles] = useState<{ id: string; file_name: string; file_url: string }[]>([]);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [threadMessage, setThreadMessage] = useState<TeamMessage | null>(null);

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

  // Fetch messages for active channel (excluding replies - only top-level)
  const { data: messages = [], refetch: refetchMessages } = useQuery({
    queryKey: ["team-messages", activeChannelId],
    queryFn: async () => {
      // Fetch all messages (including replies) for the channel
      const { data: allMsgs, error } = await supabase
        .from("team_messages")
        .select("*")
        .eq("channel_id", activeChannelId!)
        .order("created_at", { ascending: true })
        .limit(500);
      if (error) throw error;

      const senderIds = [...new Set(allMsgs.map((m: any) => m.sender_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url")
        .in("id", senderIds);

      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

      // Count replies per parent message
      const replyCounts: Record<string, number> = {};
      allMsgs.forEach((m: any) => {
        if (m.parent_message_id) {
          replyCounts[m.parent_message_id] = (replyCounts[m.parent_message_id] || 0) + 1;
        }
      });

      return allMsgs.map((m: any) => ({
        ...m,
        sender_profile: profileMap.get(m.sender_id),
        reply_count: replyCounts[m.id] || 0,
      })) as TeamMessage[];
    },
    enabled: !!activeChannelId,
  });

  // Filter to top-level messages only for display
  const topLevelMessages = messages.filter(m => !m.parent_message_id);

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

  // Realtime subscription for active channel messages
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

  // Play notification gong sound
  const playGongSound = useCallback(() => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Main tone
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(830, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(415, audioCtx.currentTime + 0.8);
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.2);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + 1.2);

      // Harmonic
      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1245, audioCtx.currentTime);
      osc2.frequency.exponentialRampToValueAtTime(622, audioCtx.currentTime + 0.6);
      gain2.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.8);
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      osc2.start(audioCtx.currentTime);
      osc2.stop(audioCtx.currentTime + 0.8);
    } catch (e) {
      // Audio not supported or blocked
    }
  }, []);

  // Realtime subscription for unread counts (listen to all team_messages in tenant)
  useEffect(() => {
    if (!tenantId) return;

    const channel = supabase
      .channel(`team-unread-${tenantId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "team_messages", filter: `tenant_id=eq.${tenantId}` },
        (payload: any) => {
          queryClient.invalidateQueries({ queryKey: ["team-unread-counts"] });
          // Play sound if the message is from someone else
          if (payload.new?.sender_id !== userId) {
            playGongSound();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, queryClient, userId, playGongSound]);

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

  // Notify message mutation
  const notifyMessage = useMutation({
    mutationFn: async (msg: TeamMessage) => {
      const { data, error } = await supabase.functions.invoke("notify-team-message", {
        body: {
          messageId: msg.id,
          channelId: msg.channel_id,
          tenantId,
          messageContent: msg.content,
          senderName: msg.sender_profile?.full_name || "חבר צוות",
          channelName: activeChannel?.name || "ערוץ",
          tenantSlug: tenant?.slug || "",
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data?.notified > 0) {
        toast.success(`התראה נשלחה ל-${data.notified} חברי צוות`);
      } else {
        toast.info(data?.reason || "לא נמצאו חברי צוות עם מספר טלפון לשליחת התראה");
      }
    },
    onError: (err: any) => toast.error("שגיאה בשליחת התראה: " + (err?.message || err)),
  });

  // Unread counts query
  const { data: readStatuses = [] } = useQuery({
    queryKey: ["team-read-status", userId, tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("team_message_read_status")
        .select("channel_id, last_read_at")
        .eq("user_id", userId!);
      return data || [];
    },
    enabled: !!userId,
  });

  // Compute unread per channel - count messages after last_read_at
  const { data: unreadCounts = {} } = useQuery<Record<string, number>>({
    queryKey: ["team-unread-counts", tenantId, userId, allChannels.map(c => c.id).join(","), readStatuses],
    queryFn: async () => {
      const counts: Record<string, number> = {};
      const readMap = new Map(readStatuses.map((r: any) => [r.channel_id, r.last_read_at]));
      
      for (const ch of allChannels) {
        const lastRead = readMap.get(ch.id);
        let query = supabase
          .from("team_messages")
          .select("id", { count: "exact", head: true })
          .eq("channel_id", ch.id)
          .is("parent_message_id", null); // Only count top-level messages
        
        if (lastRead) {
          query = query.gt("created_at", lastRead);
        }
        // Exclude own messages
        query = query.neq("sender_id", userId!);
        
        const { count } = await query;
        if (count && count > 0) {
          counts[ch.id] = count;
        }
      }
      return counts;
    },
    enabled: !!userId && allChannels.length > 0,
    refetchInterval: 30000, // Refresh every 30s
  });

  // Mark channel as read when switching
  const markAsRead = useCallback(async (channelId: string) => {
    if (!userId) return;
    await supabase
      .from("team_message_read_status")
      .upsert({
        channel_id: channelId,
        user_id: userId,
        last_read_at: new Date().toISOString(),
        last_read_message_id: null,
      }, { onConflict: "channel_id,user_id" });
    queryClient.invalidateQueries({ queryKey: ["team-read-status", userId, tenantId] });
    queryClient.invalidateQueries({ queryKey: ["team-unread-counts"] });
  }, [userId, tenantId, queryClient]);

  // Mark as read when channel changes
  useEffect(() => {
    if (activeChannelId) {
      markAsRead(activeChannelId);
    }
  }, [activeChannelId, markAsRead]);

  // Also mark as read when new messages arrive in active channel
  useEffect(() => {
    if (activeChannelId && messages.length > 0) {
      markAsRead(activeChannelId);
    }
  }, [messages.length, activeChannelId, markAsRead]);

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
                messages={topLevelMessages}
                allMessages={messages}
                currentUserId={userId}
                onConvertToTask={(msg) => setTaskMessage(msg)}
                onEditMessage={(msg, newContent) => editMessage.mutate({ id: msg.id, content: newContent })}
                onDeleteMessage={(msg) => deleteMessage.mutate(msg.id)}
                onNotifyMessage={(msg) => notifyMessage.mutate(msg)}
                onReplyMessage={(msg) => setThreadMessage(msg)}
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

      {/* Thread Dialog */}
      <ThreadDialog
        parentMessage={threadMessage}
        open={!!threadMessage}
        onOpenChange={(open) => { if (!open) setThreadMessage(null); }}
        channelId={activeChannelId || ""}
        tenantId={tenantId}
        currentUserId={userId}
      />

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
