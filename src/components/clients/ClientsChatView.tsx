import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import ChatViewComponent from "@/components/chat/ChatView";
import { User, Phone, PhoneCall, Building2, Clock, Search, Mail, Globe, CheckSquare, Trash2, MessageSquare, FileText, DollarSign, X, Edit, Pencil, Check, Users, Plus, UserPlus, BarChart3, FolderOpen, Link, KeyRound, Calendar as CalendarIcon, Copy, Loader2, Video } from "lucide-react";
import { DuplicateClientDialog } from "@/components/forms/DuplicateClientDialog";
import { CreateOrgForClientDialog } from "@/components/clients/CreateOrgForClientDialog";
import { AssignPhoneFromWhatsAppDialog } from "@/components/chat/AssignPhoneFromWhatsAppDialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CallDialog } from "@/components/telephony/CallDialog";
import { CallHistoryTab } from "@/components/telephony/CallHistoryTab";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { EditClientDialog } from "@/components/forms/EditClientDialog";
import { ClientConnectionsTab } from "@/components/clients/ClientConnectionsTab";
import { useProvisionClientChannels } from "@/components/clients/useProvisionClientChannels";
import { ClientUpdatesTab } from "@/components/clients/ClientUpdatesTab";
import { ClientTablesTab } from "@/components/clients/ClientTablesTab";
import { ClientLinkedFiles } from "@/components/clients/ClientLinkedFiles";
import { ClientCredentialsTab } from "@/components/clients/ClientCredentialsTab";
import { ClientWordPressTab } from "@/components/clients/ClientWordPressTab";
import { ClientDocsEditor } from "@/components/clients/ClientDocsEditor";
import { FolderLinksField } from "@/components/forms/FolderLinksField";
import { AttachmentsField } from "@/components/forms/AttachmentsField";
import { useFolderLinksAndAttachments } from "@/hooks/useFolderLinksAndAttachments";
import { ClientMeetingTab } from "@/components/clients/ClientMeetingTab";
import { ClientRecordingsTab } from "@/components/clients/ClientRecordingsTab";
import { CRMSettingsSection } from "@/components/clients/CRMSettingsSection";
import { ChangeAgencyDialog } from "@/components/chat/ChangeAgencyDialog";
import AddTaskForm from "@/components/forms/AddTaskForm";
import { CampaignerAssignmentPicker } from "@/components/clients/CampaignerAssignmentPicker";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { CarmenWhatsAppAccess } from "@/components/carmen/CarmenWhatsAppAccess";

interface ClientsChatViewProps {
  clients: any[];
  agencies?: any[];
  canViewFinance?: boolean;
  getClientFinancialData?: (clientId: string) => any;
  initialClientId?: string;  // deep-link: open this client on mount
  initialTab?: "updates" | "details"; // deep-link: open this tab on mount
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active: { label: "פעיל", color: "hsl(142, 71%, 45%)" },
  onboarding: { label: "בקליטה", color: "hsl(217, 91%, 60%)" },
  paused: { label: "מושהה", color: "hsl(45, 93%, 47%)" },
  ended: { label: "הסתיים", color: "hsl(0, 0%, 60%)" },
};

const MOOD_CONFIG: Record<string, { emoji: string; text: string }> = {
  happy: { emoji: "😊", text: "מבסוט" },
  wavering: { emoji: "😐", text: "מתנדנד" },
  churn_risk: { emoji: "😟", text: "סכנת נטישה" },
  not_progressing: { emoji: "😔", text: "לא מתקדם" },
};

export function ClientsChatView({
  clients,
  agencies,
  canViewFinance,
  getClientFinancialData,
  initialClientId,
  initialTab,
}: ClientsChatViewProps) {
  const [selectedClientId, setSelectedClientId] = useState<string | null>(
    initialClientId ?? clients[0]?.id ?? null
  );
  const [listSearch, setListSearch] = useState("");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>(initialTab ?? "details");

  // Guard: redirect away from "business" tab if user lacks finance view permission
  useEffect(() => {
    if (activeTab === "business" && !canViewFinance) {
      setActiveTab("details");
    }
  }, [activeTab, canViewFinance]);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedClientIds, setSelectedClientIds] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [callDialogOpen, setCallDialogOpen] = useState(false);
  const [changeAgencyOpen, setChangeAgencyOpen] = useState(false);
  const [createOrgOpen, setCreateOrgOpen] = useState(false);
  const [assignPhoneDialogOpen, setAssignPhoneDialogOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [confirmingBulkDelete, setConfirmingBulkDelete] = useState(false);
  const queryClient = useQueryClient();
  const { tenantId } = useCurrentTenant();
  const { provision, provisioning } = useProvisionClientChannels();

  const { data: whatsappGroups = [] } = useQuery({
    queryKey: ["whatsapp-groups", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("whatsapp_groups")
        .select("id, group_name")
        .eq("tenant_id", tenantId)
        .eq("is_blocked", false)
        .order("group_name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const selectedClientIdForContacts = selectedClientId;
  const { data: clientContacts = [] } = useQuery({
    queryKey: ["client-contacts", selectedClientIdForContacts],
    queryFn: async () => {
      if (!selectedClientIdForContacts) return [];
      const { data, error } = await supabase
        .from("client_contacts")
        .select("*")
        .eq("client_id", selectedClientIdForContacts)
        .order("is_primary", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedClientIdForContacts,
  });

  const [addingContact, setAddingContact] = useState(false);
  const [newContact, setNewContact] = useState({ contact_name: "", phone: "", email: "", role: "" });
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [editContactData, setEditContactData] = useState({ contact_name: "", phone: "", email: "", role: "" });
  const [groupSearch, setGroupSearch] = useState("");
  const [showGroupDropdown, setShowGroupDropdown] = useState(false);

  const filteredGroups = useMemo(() => {
    if (!groupSearch.trim()) return whatsappGroups;
    const q = groupSearch.toLowerCase();
    return whatsappGroups.filter((g: any) => g.group_name?.toLowerCase().includes(q));
  }, [whatsappGroups, groupSearch]);

  const getClientDisplayName = useCallback((client: any) => {
    const candidates = [client?.name, client?.contact_name, client?.website, client?.phone]
      .map((value) => (typeof value === "string" ? value.trim() : ""));

    const firstNonEmpty = candidates.find((value) => value.length > 0);
    if (firstNonEmpty) return firstNonEmpty;

    return client?.id ? `לקוח ${String(client.id).slice(0, 6)}` : "ללא שם";
  }, []);

  const filteredClients = useMemo(() => {
    if (!listSearch.trim()) return clients;
    const q = listSearch.toLowerCase();
    return clients.filter(c =>
      getClientDisplayName(c).toLowerCase().includes(q) ||
      (c.contact_name || "").toLowerCase().includes(q) ||
      (c.phone || "").includes(q)
    );
  }, [clients, listSearch, getClientDisplayName]);

  const selectedClient = useMemo(() => {
    return clients.find(c => c.id === selectedClientId) || null;
  }, [clients, selectedClientId]);

  // Progressive rendering of the (potentially long) client list: render a growing
  // window instead of all rows at once, so the sidebar mounts fast even with 300+ clients.
  const LIST_PAGE = 50;
  const listScrollRef = useRef<HTMLDivElement>(null);
  const listSentinelRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(LIST_PAGE);
  const visibleClients = useMemo(
    () => filteredClients.slice(0, visibleCount),
    [filteredClients, visibleCount]
  );
  // Reset the window when the search narrows/changes the result set.
  useEffect(() => {
    setVisibleCount(LIST_PAGE);
    if (listScrollRef.current) listScrollRef.current.scrollTop = 0;
  }, [listSearch]);
  // Grow the window as the sentinel near the bottom scrolls into view.
  useEffect(() => {
    const sentinel = listSentinelRef.current;
    if (!sentinel) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((n) => (n < filteredClients.length ? n + LIST_PAGE : n));
        }
      },
      { root: listScrollRef.current ?? null, rootMargin: "300px" }
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, [filteredClients.length]);

  const selectedClientDisplayName = useMemo(
    () => (selectedClient ? getClientDisplayName(selectedClient) : "ללא שם"),
    [selectedClient, getClientDisplayName]
  );

  const performDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
      toast.success("לקוח נמחק בהצלחה");
      const idx = clients.findIndex(c => c.id === id);
      const next = clients[idx + 1] || clients[idx - 1] || null;
      setSelectedClientId(next?.id || null);
      queryClient.invalidateQueries({ queryKey: ["clients", tenantId] });
    } catch (error: any) {
      toast.error("שגיאה במחיקת לקוח: " + error.message);
    } finally {
      setPendingDeleteId(null);
    }
  };

  const toggleClientSelection = useCallback((clientId: string) => {
    setSelectedClientIds(prev => {
      const next = new Set(prev);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedClientIds.size === filteredClients.length) {
      setSelectedClientIds(new Set());
    } else {
      setSelectedClientIds(new Set(filteredClients.map(c => c.id)));
    }
  }, [filteredClients, selectedClientIds.size]);

  const exitMultiSelect = useCallback(() => {
    setMultiSelectMode(false);
    setSelectedClientIds(new Set());
    setConfirmingBulkDelete(false);
  }, []);

  const handleBulkDelete = async () => {
    if (selectedClientIds.size === 0) return;
    setBulkActionLoading(true);
    try {
      const { error } = await supabase.from("clients").delete().in("id", Array.from(selectedClientIds));
      if (error) throw error;
      toast.success(`${selectedClientIds.size} לקוחות נמחקו בהצלחה`);
      if (selectedClientIds.has(selectedClientId || "")) {
        setSelectedClientId(null);
      }
      exitMultiSelect();
      queryClient.invalidateQueries({ queryKey: ["clients", tenantId] });
    } catch (error: any) {
      toast.error("שגיאה במחיקה: " + error.message);
    } finally {
      setBulkActionLoading(false);
      setConfirmingBulkDelete(false);
    }
  };

  const handleBulkStatusChange = async (status: string) => {
    if (selectedClientIds.size === 0) return;
    setBulkActionLoading(true);
    try {
      const { error } = await supabase.from("clients").update({ status: status as any }).in("id", Array.from(selectedClientIds));
      if (error) throw error;
      toast.success(`${selectedClientIds.size} לקוחות עודכנו`);
      exitMultiSelect();
      queryClient.invalidateQueries({ queryKey: ["clients", tenantId] });
    } catch (error: any) {
      toast.error("שגיאה בעדכון: " + error.message);
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkMoodChange = async (moodStatus: string) => {
    if (selectedClientIds.size === 0) return;
    setBulkActionLoading(true);
    try {
      const { error } = await supabase.from("clients").update({ mood_status: moodStatus as any }).in("id", Array.from(selectedClientIds));
      if (error) throw error;
      toast.success(`${selectedClientIds.size} לקוחות עודכנו`);
      exitMultiSelect();
      queryClient.invalidateQueries({ queryKey: ["clients", tenantId] });
    } catch (error: any) {
      toast.error("שגיאה בעדכון: " + error.message);
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleStatusChange = async (clientId: string, status: string) => {
    try {
      const { error } = await supabase.from("clients").update({ status: status as any }).eq("id", clientId);
      if (error) throw error;
      toast.success("הסטטוס עודכן בהצלחה");
      queryClient.invalidateQueries({ queryKey: ["clients", tenantId] });
    } catch {
      toast.error("שגיאה בעדכון הסטטוס");
    }
  };

  const handleMoodChange = async (clientId: string, moodStatus: string) => {
    try {
      const { error } = await supabase.from("clients").update({ mood_status: moodStatus as any }).eq("id", clientId);
      if (error) throw error;
      toast.success("מצב הלקוח עודכן בהצלחה");
      queryClient.invalidateQueries({ queryKey: ["clients", tenantId] });
    } catch {
      toast.error("שגיאה בעדכון מצב הלקוח");
    }
  };

  const getStatusInfo = (status: string) => STATUS_CONFIG[status] || STATUS_CONFIG.active;
  const getMoodInfo = (mood: string | null) => MOOD_CONFIG[mood || "happy"] || MOOD_CONFIG.happy;
  const getAgencyName = (agencyId: string) => agencies?.find((a: any) => a.id === agencyId)?.name || "";

  const updateClientField = async (clientId: string, field: string, value: any) => {
    try {
      const { error, data } = await supabase.from("clients").update({ [field]: value }).eq("id", clientId).select();
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("Update blocked by permissions");
      toast.success("עודכן בהצלחה");
      queryClient.invalidateQueries({ queryKey: ["clients", tenantId] });
    } catch {
      toast.error("שגיאה בעדכון");
    }
  };

  const EditableField = ({ label, value, field, clientId, type = "text", isLink, linkPrefix }: {
    label: string; value: string | null; field: string; clientId: string;
    type?: "text" | "number" | "textarea"; isLink?: boolean; linkPrefix?: string;
  }) => {
    const [editing, setEditing] = useState(false);
    const [editValue, setEditValue] = useState(value || "");

    const handleSave = () => {
      const finalValue = type === "number" ? (editValue === "" ? 0 : Number(editValue)) : (editValue || null);
      updateClientField(clientId, field, finalValue);
      setEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && type !== "textarea") handleSave();
      if (e.key === "Escape") { setEditValue(value || ""); setEditing(false); }
    };

    if (editing) {
      return (
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={handleSave}>
            <Check className="h-3 w-3 text-primary" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => { setEditValue(value || ""); setEditing(false); }}>
            <X className="h-3 w-3 text-muted-foreground" />
          </Button>
          {type === "textarea" ? (
            <Textarea value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={handleKeyDown}
              className="text-sm h-20 text-right" dir="rtl" autoFocus />
          ) : (
            <Input value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={handleKeyDown}
              type={type === "number" ? "number" : "text"} className="text-sm h-7 text-right" dir="rtl" autoFocus />
          )}
          <span className="text-muted-foreground text-sm shrink-0">{label}</span>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-end gap-2 group cursor-pointer" onClick={() => { setEditValue(value || ""); setEditing(true); }}>
        <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        {isLink && value ? (
          <a href={`${linkPrefix || ""}${value}`} target={linkPrefix?.startsWith("http") || linkPrefix === undefined ? "_blank" : undefined}
            className="font-medium text-primary hover:underline truncate"
            onClick={e => e.stopPropagation()}>
            {value}
          </a>
        ) : (
          <span className="font-medium">{type === "number" && value ? `₪${Number(value).toLocaleString()}` : (value || "—")}</span>
        )}
        <span className="text-muted-foreground text-sm shrink-0">{label}</span>
      </div>
    );
  };

  const EditableClientName = ({ clientId, currentName, agencyName }: {
    clientId: string; currentName: string; agencyName?: string;
  }) => {
    const [editing, setEditing] = useState(false);
    const [editValue, setEditValue] = useState(currentName);
    const handleSave = () => {
      if (editValue.trim()) {
        updateClientField(clientId, "name", editValue.trim());
      }
      setEditing(false);
    };
    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === "Enter") handleSave();
      if (e.key === "Escape") { setEditValue(currentName); setEditing(false); }
    };
    if (editing) {
      return (
        <div className="flex items-center gap-2">
          <Input value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={handleKeyDown} onBlur={handleSave} className="text-sm h-7 font-bold text-right max-w-[200px]" dir="rtl" autoFocus />
        </div>
      );
    }
    return (
      <>
        <h2 className="font-bold text-base truncate cursor-pointer group flex items-center gap-1" onClick={() => { setEditValue(currentName); setEditing(true); }}>
          {currentName}
          <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        </h2>
        {agencyName && (
          <p className="text-xs text-muted-foreground truncate cursor-pointer hover:text-primary transition-colors" onClick={(e) => { e.stopPropagation(); setChangeAgencyOpen(true); }}>
            {agencyName} ✎
          </p>
        )}
      </>
    );
  };

  return (
    <div className="flex h-full min-h-0 max-h-full border rounded-lg overflow-hidden bg-background" dir="rtl">
      {/* Right side - Client list (25%) */}
      <div className="w-[25%] min-w-[240px] border-s flex flex-col bg-muted/20 overflow-hidden min-h-0" dir="rtl">
        {/* List header with search */}
        <div className="p-3 border-b bg-background/80 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="חיפוש לקוח..."
                value={listSearch}
                onChange={(e) => setListSearch(e.target.value)}
                className="pr-9 h-9 text-sm"
              />
            </div>
            <Button
              variant={multiSelectMode ? "default" : "outline"}
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={() => multiSelectMode ? exitMultiSelect() : setMultiSelectMode(true)}
              title={multiSelectMode ? "בטל בחירה" : "בחירה מרובה"}
            >
              <CheckSquare className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-2 text-xs text-muted-foreground text-center">
            {filteredClients.length} לקוחות
          </div>
        </div>

        {/* Multi-select toolbar */}
        {multiSelectMode && (
          <div className="p-2 border-b bg-primary/5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={toggleSelectAll}>
                {selectedClientIds.size === filteredClients.length ? "בטל הכל" : "בחר הכל"}
              </Button>
              <span className="text-xs font-medium text-muted-foreground">
                {selectedClientIds.size} נבחרו
              </span>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={exitMultiSelect}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            {selectedClientIds.size > 0 && (
              <div className="flex items-center gap-1 flex-wrap">
                {/* Bulk status change */}
                <Select onValueChange={handleBulkStatusChange} disabled={bulkActionLoading}>
                  <SelectTrigger className="h-7 text-[11px] w-auto min-w-[80px]">
                    <SelectValue placeholder="סטטוס" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-[100]">
                    {Object.entries(STATUS_CONFIG).map(([key, { label, color }]) => (
                      <SelectItem key={key} value={key} style={{ backgroundColor: color, color: "#fff" }}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Bulk mood change */}
                <Select onValueChange={handleBulkMoodChange} disabled={bulkActionLoading}>
                  <SelectTrigger className="h-7 text-[11px] w-auto min-w-[80px]">
                    <SelectValue placeholder="מצב רוח" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-[100]">
                    {Object.entries(MOOD_CONFIG).map(([key, { emoji, text }]) => (
                      <SelectItem key={key} value={key}>
                        {emoji} {text}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Bulk delete */}
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-7 text-[11px] gap-1"
                  onClick={() => setConfirmingBulkDelete(true)}
                  disabled={bulkActionLoading}
                >
                  <Trash2 className="h-3 w-3" />
                  מחק
                </Button>
              </div>
            )}
            {confirmingBulkDelete && selectedClientIds.size > 0 && (
              <div className="flex items-center justify-between gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-2">
                <span className="text-[11px] text-destructive">
                  למחוק {selectedClientIds.size} לקוחות? פעולה זו אינה הפיכה.
                </span>
                <div className="flex gap-1 shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-[11px]"
                    onClick={() => setConfirmingBulkDelete(false)}
                    disabled={bulkActionLoading}
                  >
                    ביטול
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-7 text-[11px] gap-1"
                    onClick={handleBulkDelete}
                    disabled={bulkActionLoading}
                  >
                    {bulkActionLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                    אישור מחיקה
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Client list */}
        <div ref={listScrollRef} className="flex-1 overflow-y-auto overflow-x-hidden min-h-0" dir="rtl">
          <div className="divide-y w-full">
            {visibleClients.map((client) => {
              const isSelected = client.id === selectedClientId;
              const isChecked = selectedClientIds.has(client.id);
              const statusInfo = getStatusInfo(client.status);
              const moodInfo = getMoodInfo(client.mood_status);
              const displayName = getClientDisplayName(client);

              return (
                <button
                  key={client.id}
                  onClick={() => {
                    if (multiSelectMode) {
                      toggleClientSelection(client.id);
                    } else {
                      setSelectedClientId(client.id);
                    }
                  }}
                  className={cn(
                    "w-full text-right p-3 hover:bg-muted/50 transition-colors cursor-pointer",
                    isSelected && !multiSelectMode && "bg-primary/10 border-e-4 border-e-primary",
                    isChecked && multiSelectMode && "bg-primary/10"
                  )}
                >
                  <div className="flex items-start gap-2">
                    {/* Avatar - right side in RTL */}
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                      style={{ backgroundColor: statusInfo.color }}
                    >
                      {(displayName || "?")[0]}
                    </div>
                    <div className="flex-1 min-w-0 text-right">
                    {multiSelectMode && (
                      <div className="pt-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => toggleClientSelection(client.id)}
                        />
                      </div>
                    )}
                      <div className="flex items-center gap-1">
                        <span dir="rtl" className="block font-semibold text-sm truncate flex-1 min-w-0 text-right">
                          {displayName}
                        </span>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                          {moodInfo.emoji}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 mt-1 justify-end flex-wrap">
                        {client.agencies?.name && (
                          <span className="text-xs text-muted-foreground truncate">{client.agencies.name}</span>
                        )}
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0 h-4 border-0 text-white"
                          style={{ backgroundColor: statusInfo.color }}
                        >
                          {statusInfo.label}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
            {filteredClients.length === 0 && (
              <div className="p-8 text-center text-muted-foreground text-sm">
                לא נמצאו לקוחות
              </div>
            )}
            {/* Sentinel: scrolling near it loads the next page of the list */}
            {visibleCount < filteredClients.length && (
              <div ref={listSentinelRef} className="p-3 text-center text-xs text-muted-foreground">
                טוען עוד… ({visibleClients.length}/{filteredClients.length})
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Left side - Client detail panel (75%) */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        {selectedClient ? (
          <>
            {/* Toolbar */}
            <div className="flex items-center gap-2 p-3 border-b bg-background/95 backdrop-blur-sm flex-wrap">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                  style={{ backgroundColor: getStatusInfo(selectedClient.status).color }}
                >
                  {(selectedClientDisplayName || "?")[0]}
                </div>
                <div className="min-w-0">
                  <EditableClientName
                    clientId={selectedClient.id}
                    currentName={selectedClientDisplayName}
                    agencyName={selectedClient.agencies?.name}
                  />
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {/* Status selector */}
                <Select
                  value={selectedClient.status}
                  onValueChange={(value) => handleStatusChange(selectedClient.id, value)}
                >
                  <SelectTrigger
                    className="h-8 text-xs w-auto min-w-[100px] border-2 font-medium"
                    style={{
                      backgroundColor: getStatusInfo(selectedClient.status).color,
                      color: "#fff",
                    }}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-[100]">
                    {Object.entries(STATUS_CONFIG).map(([key, { label, color }]) => (
                      <SelectItem key={key} value={key} style={{ backgroundColor: color, color: "#fff" }}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Mood selector */}
                <Select
                  value={selectedClient.mood_status || "happy"}
                  onValueChange={(value) => handleMoodChange(selectedClient.id, value)}
                >
                  <SelectTrigger className="h-8 text-xs w-auto min-w-[100px] border-2 font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-[100]">
                    {Object.entries(MOOD_CONFIG).map(([key, { emoji, text }]) => (
                      <SelectItem key={key} value={key}>
                        {emoji} {text}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedClient.phone && (
                  <>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                      onClick={() => setCallDialogOpen(true)}
                      title="התקשר דרך מרכזיה"
                    >
                      <PhoneCall className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 gap-1" asChild>
                      <a href={`tel:${selectedClient.phone}`}>
                        <Phone className="h-3.5 w-3.5" />
                        {selectedClient.phone}
                      </a>
                    </Button>
                  </>
                )}

                {selectedClient.email && (
                  <Button variant="outline" size="sm" className="h-8 gap-1" asChild>
                    <a href={`mailto:${selectedClient.email}`}>
                      <Mail className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                )}

                <EditClientDialog client={selectedClient} open={editDialogOpen} onOpenChange={setEditDialogOpen} />

                <AddTaskForm
                  clientId={selectedClient.id}
                  agencyId={selectedClient.agency_id || undefined}
                  triggerButton={
                    <Button variant="outline" size="icon" className="h-8 w-8" title="הוסף משימה">
                      <CheckSquare className="h-4 w-4" />
                    </Button>
                  }
                />

                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setDuplicateDialogOpen(true)}
                  title="שכפל לקוח"
                >
                  <Copy className="h-4 w-4" />
                </Button>

                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCreateOrgOpen(true)}
                  title="צור ארגון ללקוח"
                >
                  <Building2 className="h-4 w-4" />
                </Button>

                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={provisioning}
                  onClick={async () => {
                    const summary = await provision(selectedClient.id);
                    const parts: string[] = [];
                    if (summary.created.length) parts.push(`נוצרו: ${summary.created.join(", ")}`);
                    if (summary.updated.length) parts.push(`עודכנו: ${summary.updated.join(", ")}`);
                    if (summary.dashboardCreated) parts.push("דשבורד נוצר");
                    if (summary.skipped.length) parts.push(`דולגו: ${summary.skipped.join(", ")}`);
                    toast.success(parts.length ? parts.join(" · ") : "אין ערוצים עם מזהים להקמה");
                    setActiveTab("report");
                  }}
                  title="צור טבלאות ודשבורד לכל הערוצים"
                >
                  {provisioning ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />}
                </Button>

                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => setPendingDeleteId(selectedClient.id)}
                  title="מחק לקוח"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Inline action area — forms/confirmations render here instead of as popups */}
            {(pendingDeleteId === selectedClient.id || duplicateDialogOpen || changeAgencyOpen || createOrgOpen) && (
              <div className="px-4 pt-3 space-y-3">
                {pendingDeleteId === selectedClient.id && (
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
                    <span className="text-sm text-destructive">
                      למחוק את הלקוח "{selectedClientDisplayName}"? פעולה זו אינה הפיכה.
                    </span>
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" variant="ghost" onClick={() => setPendingDeleteId(null)}>
                        ביטול
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => performDelete(selectedClient.id)}
                      >
                        מחק
                      </Button>
                    </div>
                  </div>
                )}
                <DuplicateClientDialog
                  inline
                  open={duplicateDialogOpen}
                  onOpenChange={setDuplicateDialogOpen}
                  client={{ id: selectedClient.id, name: selectedClient.name }}
                />
                <ChangeAgencyDialog
                  inline
                  open={changeAgencyOpen}
                  onOpenChange={setChangeAgencyOpen}
                  contactId={selectedClient.id}
                  contactType="client"
                  currentAgencyId={selectedClient.agency_id}
                  contactName={selectedClient.name}
                  onSuccess={() => queryClient.invalidateQueries({ queryKey: ["clients", tenantId] })}
                />
                <CreateOrgForClientDialog
                  inline
                  open={createOrgOpen}
                  onOpenChange={setCreateOrgOpen}
                  client={{ id: selectedClient.id, name: selectedClient.name, tenant_id: selectedClient.tenant_id }}
                />
              </div>
            )}

            {/* Detail tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <TabsList className={cn("mx-4 mt-3 grid w-auto max-w-4xl h-9 bg-muted/50 mr-4 ml-auto", canViewFinance ? "grid-cols-12" : "grid-cols-11")}>
                <TabsTrigger value="details" className="text-xs gap-1">
                  <FileText className="h-3.5 w-3.5" />
                  פרטי לקוח
                </TabsTrigger>
                <TabsTrigger value="connections" className="text-xs gap-1">
                  <Link className="h-3.5 w-3.5" />
                  חיבורים
                </TabsTrigger>
                {canViewFinance && (
                  <TabsTrigger value="business" className="text-xs gap-1">
                    <DollarSign className="h-3.5 w-3.5" />
                    מידע עסקי
                  </TabsTrigger>
                )}
                <TabsTrigger value="docs" className="text-xs gap-1">
                  <FolderOpen className="h-3.5 w-3.5" />
                  מסמכים
                </TabsTrigger>
                <TabsTrigger value="credentials" className="text-xs gap-1">
                  <KeyRound className="h-3.5 w-3.5" />
                  ססמאות
                </TabsTrigger>
                <TabsTrigger value="meeting" className="text-xs gap-1">
                  <CalendarIcon className="h-3.5 w-3.5" />
                  פגישה
                </TabsTrigger>
                <TabsTrigger value="recordings" className="text-xs gap-1">
                  <Video className="h-3.5 w-3.5" />
                  הקלטות
                </TabsTrigger>
                <TabsTrigger value="report" className="text-xs gap-1">
                  <BarChart3 className="h-3.5 w-3.5" />
                  דוחות
                </TabsTrigger>
                <TabsTrigger value="updates" className="text-xs gap-1">
                  <MessageSquare className="h-3.5 w-3.5" />
                  עדכונים
                </TabsTrigger>
                <TabsTrigger value="calls" className="text-xs gap-1">
                  <Phone className="h-3.5 w-3.5" />
                  שיחות
                </TabsTrigger>
                <TabsTrigger value="wordpress" className="text-xs gap-1">
                  <Globe className="h-3.5 w-3.5" />
                  אתר
                </TabsTrigger>
                <TabsTrigger value="whatsapp" className="text-xs gap-1">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  WhatsApp
                </TabsTrigger>
              </TabsList>

              <ScrollArea className={cn("h-0 flex-1 min-h-0 p-4", (activeTab === "whatsapp" || activeTab === "calls") && "hidden")}>
                <TabsContent value="details" className="mt-0 space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    {/* Timeline - shown first in DOM but appears on LEFT in RTL layout */}
                    <div className="bg-card border border-border/60 rounded-xl p-4 space-y-3 text-right shadow-sm">
                      <h3 className="font-semibold text-sm flex items-center gap-2 justify-end text-foreground">
                        ציר זמן
                        <Clock className="h-4 w-4 text-primary" />
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-end gap-2">
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" size="sm" className="h-7 text-xs font-medium gap-1">
                                <CalendarIcon className="h-3 w-3" />
                                {selectedClient.start_date
                                  ? format(new Date(selectedClient.start_date), "dd/MM/yyyy", { locale: he })
                                  : "בחר תאריך"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="end">
                              <Calendar
                                mode="single"
                                selected={selectedClient.start_date ? new Date(selectedClient.start_date) : undefined}
                                onSelect={(date) => {
                                  updateClientField(selectedClient.id, "start_date", date ? format(date, "yyyy-MM-dd") : null);
                                }}
                                initialFocus
                                className={cn("p-3 pointer-events-auto")}
                              />
                            </PopoverContent>
                          </Popover>
                          <span className="text-muted-foreground">:תחילת פעילות</span>
                        </div>
                        <div className="flex items-center justify-end gap-2">
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" size="sm" className="h-7 text-xs font-medium gap-1">
                                <CalendarIcon className="h-3 w-3" />
                                {(selectedClient as any).end_date
                                  ? format(new Date((selectedClient as any).end_date), "dd/MM/yyyy", { locale: he })
                                  : "בחר תאריך"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="end">
                              <Calendar
                                mode="single"
                                selected={(selectedClient as any).end_date ? new Date((selectedClient as any).end_date) : undefined}
                                onSelect={(date) => {
                                  updateClientField(selectedClient.id, "end_date", date ? format(date, "yyyy-MM-dd") : null);
                                }}
                                initialFocus
                                className={cn("p-3 pointer-events-auto")}
                              />
                            </PopoverContent>
                          </Popover>
                          <span className="text-muted-foreground">:סיום פעילות</span>
                        </div>
                        <div className="flex items-center justify-end gap-2">
                          <span className="font-medium">
                            {selectedClient.created_at
                              ? format(new Date(selectedClient.created_at), "dd/MM/yyyy HH:mm", { locale: he })
                              : "—"}
                          </span>
                          <span className="text-muted-foreground">:נוצר</span>
                        </div>
                        <div className="flex items-center justify-end gap-2">
                          <span className="font-medium">
                            {getMoodInfo(selectedClient.mood_status).emoji} {getMoodInfo(selectedClient.mood_status).text}
                          </span>
                          <span className="text-muted-foreground">:מצב רוח</span>
                        </div>
                      </div>
                    </div>

                    {/* Contact info - shown second in DOM but appears on RIGHT in RTL layout */}
                    <div className="bg-card border border-border/60 rounded-xl p-4 space-y-3 text-right shadow-sm">
                      <h3 className="font-semibold text-sm flex items-center gap-2 justify-end text-foreground">
                        פרטי קשר ראשי
                        <User className="h-4 w-4 text-primary" />
                      </h3>
                      <div className="space-y-2 text-sm">
                        <EditableField label=":איש קשר" value={selectedClient.contact_name} field="contact_name" clientId={selectedClient.id} />
                        <EditableField label=":טלפון" value={selectedClient.phone} field="phone" clientId={selectedClient.id} isLink linkPrefix="tel:" />
                        <EditableField label=":אימייל" value={selectedClient.email} field="email" clientId={selectedClient.id} isLink linkPrefix="mailto:" />
                        <EditableField label=":אתר" value={selectedClient.website} field="website" clientId={selectedClient.id} isLink />
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-muted-foreground text-sm flex items-center gap-1">
                            <Users className="h-3.5 w-3.5" />
                            :קבוצת WhatsApp
                          </span>
                          <div className="relative w-full">
                            {selectedClient.whatsapp_group_id && !showGroupDropdown ? (
                              <div className="flex items-center gap-1 h-7 px-2 border rounded-md bg-muted/30">
                                <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => updateClientField(selectedClient.id, "whatsapp_group_id", null)}>
                                  <X className="h-3 w-3" />
                                </Button>
                                <span className="flex-1 text-xs font-medium truncate text-right cursor-pointer" onClick={() => setShowGroupDropdown(true)}>
                                  {whatsappGroups.find((g: any) => g.id === selectedClient.whatsapp_group_id)?.group_name || "קבוצה מקושרת"}
                                </span>
                              </div>
                            ) : (
                              <Input
                                placeholder="חפש קבוצה..."
                                value={groupSearch}
                                onChange={(e) => { setGroupSearch(e.target.value); setShowGroupDropdown(true); }}
                                onFocus={() => setShowGroupDropdown(true)}
                                onBlur={() => setTimeout(() => setShowGroupDropdown(false), 200)}
                                className="h-7 text-xs text-right"
                                dir="rtl"
                                autoFocus={showGroupDropdown && !!selectedClient.whatsapp_group_id}
                              />
                            )}
                            {showGroupDropdown && (
                              <div className="absolute z-50 top-full mt-1 w-full bg-popover border rounded-md shadow-md max-h-[200px] overflow-y-auto">
                                {filteredGroups.length > 0 ? filteredGroups.map((g: any) => (
                                  <button
                                    key={g.id}
                                    className="w-full text-right px-3 py-1.5 text-xs hover:bg-accent transition-colors"
                                    onClick={() => {
                                      updateClientField(selectedClient.id, "whatsapp_group_id", g.id);
                                      setGroupSearch("");
                                      setShowGroupDropdown(false);
                                    }}
                                  >
                                    {g.group_name}
                                  </button>
                                )) : (
                                  <div className="px-3 py-2 text-xs text-muted-foreground text-center">לא נמצאו קבוצות</div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Additional contacts */}
                  <div className="bg-card border border-border/60 rounded-xl p-4 text-right space-y-3 shadow-sm">
                    <div className="flex items-center justify-between">
                      <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={() => setAddingContact(true)}>
                        <UserPlus className="h-3.5 w-3.5" />
                        הוסף איש קשר
                      </Button>
                      <h3 className="font-semibold text-sm flex items-center gap-2">
                        אנשי קשר נוספים
                        <Users className="h-4 w-4 text-primary" />
                      </h3>
                    </div>

                    {addingContact && (
                      <div className="border border-border/60 rounded-lg p-3 space-y-2 bg-muted/30">
                        <div className="grid grid-cols-2 gap-2">
                          <Input placeholder="שם" value={newContact.contact_name} onChange={e => setNewContact(p => ({ ...p, contact_name: e.target.value }))} className="text-sm h-8 text-right" dir="rtl" />
                          <Input placeholder="תפקיד" value={newContact.role} onChange={e => setNewContact(p => ({ ...p, role: e.target.value }))} className="text-sm h-8 text-right" dir="rtl" />
                          <Input placeholder="טלפון" value={newContact.phone} onChange={e => setNewContact(p => ({ ...p, phone: e.target.value }))} className="text-sm h-8 text-right" dir="rtl" />
                          <Input placeholder="אימייל" value={newContact.email} onChange={e => setNewContact(p => ({ ...p, email: e.target.value }))} className="text-sm h-8 text-right" dir="rtl" />
                        </div>
                        <div className="flex gap-2 justify-end">
                          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setAddingContact(false); setNewContact({ contact_name: "", phone: "", email: "", role: "" }); }}>ביטול</Button>
                          <Button size="sm" className="h-7 text-xs" disabled={!newContact.contact_name.trim()} onClick={async () => {
                            if (!tenantId) return;
                            try {
                              const { error } = await supabase.from("client_contacts").insert({
                                client_id: selectedClient.id,
                                tenant_id: tenantId,
                                contact_name: newContact.contact_name.trim(),
                                phone: newContact.phone.trim() || null,
                                email: newContact.email.trim() || null,
                                role: newContact.role.trim() || null,
                              });
                              if (error) throw error;
                              toast.success("איש קשר נוסף");
                              setAddingContact(false);
                              setNewContact({ contact_name: "", phone: "", email: "", role: "" });
                              queryClient.invalidateQueries({ queryKey: ["client-contacts", selectedClient.id, tenantId] });
                            } catch { toast.error("שגיאה בהוספת איש קשר"); }
                          }}>שמור</Button>
                        </div>
              …28062 tokens truncated…: string; supabase?: any; tenantId?: string };
// Tracks URL-less Manus payloads that were positively matched to a Green API voice transcript.
// WeakSet keeps the classification request-local without mutating the payload persisted to the database.
const pairedVoicePayloads = new WeakSet<object>();
const _AUDIO_URL_FIELDS = ['media_url', 'mediaUrl', 'url', 'fileUrl', 'file_url', 'downloadUrl', 'downloadURL', 'mediaLink', 'media_link', 'link'];
function pickAudioUrl(payload: any, msgContainer: any): string | null {
  // Manus wraps media differently across message types; scan the common containers.
  const containers = [payload, payload?.media, payload?.file, payload?.attachment, payload?.audio,
    msgContainer, msgContainer?.audioMessage, msgContainer?.message];
  for (const c of containers) {
    if (!c || typeof c !== 'object') continue;
    for (const f of _AUDIO_URL_FIELDS) {
      const v = c[f];
      if (typeof v === 'string' && /^https?:\/\//.test(v)) return v;
    }
  }
  return null;
}
function looksAudio(payload: any, msgContainer: any, url: string | null): boolean {
  if (msgContainer?.audioMessage) return true;
  const t = (payload?.type ?? payload?.messageType ?? payload?.mediaType ?? msgContainer?.type ?? '').toString().toLowerCase();
  if (/audio|ptt|voice/.test(t)) return true;
  const mime = (payload?.mimeType || payload?.mime_type || payload?.media?.mimetype ||
    msgContainer?.audioMessage?.mimetype || '').toString().toLowerCase();
  if (/audio|ogg|opus|voice|ptt|mpeg|mp4a|amr/.test(mime)) return true;
  return !!url && /\.(ogg|opus|mp3|m4a|wav|aac|amr)(\?|$)/i.test(url);
}
// Fetch the media bytes. Manus media URLs sometimes require the instance API key
// (X-Api-Key), so retry with it if an anonymous fetch is rejected.
async function fetchMedia(url: string, auth?: MediaAuth): Promise<Blob | null> {
  try {
    const r = await fetch(url);
    if (r.ok) return await r.blob();
  } catch (_) { /* try authed */ }
  if (auth?.apiKey) {
    try {
      const r = await fetch(url, { headers: { 'X-Api-Key': auth.apiKey } });
      if (r.ok) return await r.blob();
    } catch (_) { /* give up */ }
  }
  return null;
}
// The Manus gateway currently emits hasMedia=true for voice notes without a URL,
// MIME type, or media object. The same WhatsApp message is also delivered to the
// connected Green API webhook, which downloads and transcribes it. Reuse that
// transcript by the provider message id instead of degrading the Carmen request
// to "[מדיה]". Green API transcription includes media download plus two AI calls,
// so allow enough time for the canonical chat_messages row to be committed.
async function findPairedGreenTranscript(
  payload: any,
  auth?: MediaAuth,
): Promise<string | null> {
  if (!auth?.supabase || !auth.tenantId) return null;
  const messageId = String(payload?.messageId || payload?.id || '').trim();
  if (!messageId) return null;

  for (let attempt = 0; attempt < 21; attempt++) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 1000));
    const { data } = await auth.supabase
      .from('chat_messages')
      .select('message_text')
      .eq('tenant_id', auth.tenantId)
      .eq('provider', 'green_api')
      .eq('raw_provider_data->>idMessage', messageId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const text = String(data?.message_text || '').replace(/^🎤\s*/, '').trim();
    if (text && !/^\[(?:הודעת קול|מדיה|קובץ מדיה|הודעה)\]$/.test(text)) {
      if (payload && typeof payload === 'object') pairedVoicePayloads.add(payload);
      return text;
    }
  }
  return null;
}
// Diagnostic: when a media message can't be transcribed, persist the payload
// shape so the exact Manus voice-note format can be pinned down. Best-effort.
function logMediaDebug(auth: MediaAuth | undefined, payload: any, msgContainer: any, url: string | null, isAudio: boolean) {
  if (!auth?.supabase) return;
  try {
    auth.supabase.from('error_logs').insert({
      tenant_id: auth.tenantId ?? null,
      source: 'manus-wa-media-debug',
      error_message: 'voice/media message could not be transcribed → fell back to [מדיה]',
      context: {
        top_keys: Object.keys(payload || {}),
        hasMedia: payload?.hasMedia ?? null,
        type: payload?.type ?? payload?.messageType ?? payload?.mediaType ?? null,
        mimeType: payload?.mimeType ?? payload?.mime_type ?? null,
        picked_url: url,
        looks_audio: isAudio,
        msg_keys: msgContainer ? Object.keys(msgContainer) : null,
        audioMessage_keys: msgContainer?.audioMessage ? Object.keys(msgContainer.audioMessage) : null,
        preview: JSON.stringify(payload ?? {}).slice(0, 1500),
      },
    }).then(() => {}, () => {});
  } catch (_) { /* never let diagnostics break the webhook */ }
}
async function resolveMessageText(payload: any, msgContainer: any, auth?: MediaAuth): Promise<string> {
  if (payload?.body && String(payload.body).trim()) return String(payload.body);
  if (!payload?.hasMedia) return '';
  const url = pickAudioUrl(payload, msgContainer);
  const isAudio = looksAudio(payload, msgContainer, url);
  try {
    if (url && isAudio) {
      const blob = await fetchMedia(url, auth);
      if (blob && blob.size > 0 && blob.size <= 25 * 1024 * 1024) {
        const t = await aiTranscribe(blob, { language: 'he', filename: 'voice.ogg' });
        if (t && t.trim()) return (await aiCleanTranscript(t)).trim();
      }
    }
  } catch (_) { /* fall through to placeholder */ }
  const pairedTranscript = await findPairedGreenTranscript(payload, auth);
  if (pairedTranscript) return pairedTranscript;
  // Couldn't turn media into text — capture the shape so we can fix it precisely.
  logMediaDebug(auth, payload, msgContainer, url, isAudio);
  return '[מדיה]';
}

// Was the inbound message a voice note? (drives Carmen's voice-out mirroring)
function messageIsVoice(payload: any, msgContainer: any): boolean {
  if (payload && typeof payload === 'object' && pairedVoicePayloads.has(payload)) return true;
  if (!payload?.hasMedia) return false;
  const url = pickAudioUrl(payload, msgContainer);
  return !!(url && looksAudio(payload, msgContainer, url));
}

// Send Carmen's reply as a voice note too (best-effort, via send-manus-wa-voice)
function makeVoiceSender(tenantId: string): (chatId: string, text: string) => Promise<boolean> {
  return async (toChatId: string, text: string): Promise<boolean> => {
    try {
      const r = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-manus-wa-voice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({ tenant_id: tenantId, to: toChatId, text }),
      });
      return r.ok;
    } catch {
      return false;
    }
  };
}

function ok(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const url = new URL(req.url);
    const rawPayload = await req.json();

    // Diagnostic: log top-level shape so we can see exactly what Manus sends
    try {
      console.log('[manus-wa] raw keys=', Object.keys(rawPayload || {}).join(','), 'preview=', JSON.stringify(rawPayload).slice(0, 800));
    } catch {}

    // Normalize Manus WA Gateway payload — it may be flat, or wrapped in
    // { data }, { message }, { payload }, { event, data: {...} }, etc.
    function pickObj(...candidates: unknown[]): Record<string, any> | null {
      for (const c of candidates) {
        if (c && typeof c === 'object' && !Array.isArray(c)) return c as Record<string, any>;
      }
      return null;
    }
    const outer = rawPayload as Record<string, any>;
    const inner = pickObj(outer.data, outer.message, outer.payload, outer.body) || {};
    const key = pickObj(inner.key, outer.key) || {};
    const msgContainer = pickObj(inner.message, outer.message) || {};

    // Only treat as 'message' when there is actual message content (from/body/key).
    // Otherwise keep the raw event (or 'ping' / 'unknown') so we don't falsely trigger Carmen.
    const rawEventField =
      outer.event ?? inner.event ?? outer.type ?? inner.type ?? outer.messageType ?? inner.messageType ?? null;
    const looksLikeMessage =
      !!(outer.from || inner.from || inner.chatId || outer.chatId || outer.body || inner.body || inner.text || outer.text ||
         (pickObj(inner.message, outer.message)));
    const normalizedEvent =
      (rawEventField === 'chat' || rawEventField === 'text' || rawEventField === 'message') && looksLikeMessage
        ? 'message'
        : rawEventField ?? (looksLikeMessage ? 'message' : 'ping');
    const fromField =
      outer.from ?? inner.from ?? inner.chatId ?? outer.chatId ?? key.remoteJid ?? inner.remoteJid ?? '';
    const toField =
      outer.to ?? inner.to ?? inner.recipientId ?? outer.recipientId ?? '';
    const bodyField =
      outer.body ?? inner.body ?? inner.text ?? outer.text ?? inner.content ?? outer.content ??
      msgContainer.conversation ?? msgContainer.text ?? msgContainer.body ?? '';
    const fromMeField =
      outer.fromMe ?? inner.fromMe ?? key.fromMe ?? (outer.direction === 'outgoing' || inner.direction === 'outgoing');
    const directionField = outer.direction ?? inner.direction;
    const idField = outer.id ?? inner.id ?? outer.messageId ?? inner.messageId ?? key.id;
    const senderNameField = outer.senderName ?? inner.senderName ?? outer.fromName ?? inner.fromName ?? outer.pushName ?? inner.pushName ?? null;
    const authorField = outer.author ?? inner.author ?? outer.participant ?? inner.participant ?? key.participant ?? null;
    const hasMediaField = outer.hasMedia ?? inner.hasMedia ?? !!(msgContainer.imageMessage || msgContainer.audioMessage || msgContainer.videoMessage || msgContainer.documentMessage);

    // Build a unified payload object that the rest of the code uses
    const payload: Record<string, any> = {
      ...outer,
      ...inner,
      event: normalizedEvent,
      from: fromField,
      to: toField,
      body: typeof bodyField === 'string' ? bodyField : (bodyField?.text ?? ''),
      fromMe: fromMeField,
      direction: directionField,
      id: idField,
      messageId: outer.messageId ?? inner.messageId ?? idField,
      senderName: senderNameField,
      author: authorField,
      hasMedia: hasMediaField,
    };

    // Collect every possible secret source Manus may use
    const headerSecret =
      req.headers.get('x-wa-gateway-secret') ||
      req.headers.get('x-webhook-secret') ||
      req.headers.get('x-manus-secret') ||
      req.headers.get('x-webhook-signature') ||
      url.searchParams.get('secret') ||
      (outer?.secret as string | undefined) ||
      (inner?.secret as string | undefined) ||
      '';

    const headerInstanceId = req.headers.get('x-wa-gateway-instance') || '';
    const instanceId =
      outer.instanceId || inner.instanceId || outer.instance_id || inner.instance_id ||
      headerInstanceId || url.searchParams.get('instanceId') || '';

    if (!instanceId) {
      console.error('Missing instanceId. Headers:', JSON.stringify(Object.fromEntries(req.headers)));
      return ok({ error: 'Missing instanceId' }, 400);
    }

    // Find integration by instance ID
    const { data: integrations } = await supabase
      .from('tenant_integrations')
      .select('id, tenant_id, user_id, settings, api_key')
      .eq('integration_type', 'manus_wa')
      .eq('is_active', true)
      .filter('settings->>instance_id', 'eq', String(instanceId))
      .order('created_at', { ascending: false })
      .limit(1);

    const integ = integrations?.[0];
    if (!integ) {
      console.error('No active manus_wa integration for instance', instanceId);
      return ok({ error: 'No active integration' }, 404);
    }

    const settings = (integ.settings as any) || {};
    const expectedSecret: string = settings.webhook_secret || '';

    // Auto-heal: if DB has no secret yet, accept the first webhook secret we see and persist it.
    if (!expectedSecret && headerSecret) {
      const merged = { ...settings, webhook_secret: headerSecret };
      await supabase.from('tenant_integrations').update({ settings: merged }).eq('id', integ.id);
      console.log('Auto-healed webhook_secret for instance', instanceId);
    } else if (expectedSecret && expectedSecret !== headerSecret) {
      // Log diagnostic info so we can see exactly what Manus sends, then ACK 200 so Manus doesn't disable the webhook.
      console.error(
        'Webhook secret mismatch for instance', instanceId,
        '— received headers:', JSON.stringify(Object.fromEntries(req.headers)),
        'received secret:', headerSecret ? `${headerSecret.slice(0, 6)}…` : '(none)'
      );
      return ok({ received: true, ignored: 'secret_mismatch' }, 200);
    }

    const tenantId = integ.tenant_id;
    const connectionUserId = integ.user_id;
    const event = payload.event;

    // Credentials + diagnostics for resolving inbound voice-note media.
    const mediaAuth: MediaAuth = {
      apiKey: integ.api_key as string | undefined,
      gateway: (settings.gateway_url as string) || 'https://whatsappgw-pzpyrrww.manus.space',
      supabase,
      tenantId,
    };

    // ===== Message ACK (delivery receipt) =====
    if (event === 'message_ack') {
      const messageId = payload.messageId;
      const ack = Number(payload.ack);
      if (!messageId) return ok({ received: true });

      const { data: msg } = await supabase
        .from('chat_messages')
        .select('id, read_at')
        .eq('tenant_id', tenantId)
        .eq('provider', 'manus_wa')
        .eq('raw_provider_data->>messageId', String(messageId))
        .maybeSingle();

      if (msg) {
        const update: Record<string, unknown> = {};
        if (ack >= 3 && !msg.read_at) update.read_at = new Date().toISOString();
        if (Object.keys(update).length > 0) {
          await supabase.from('chat_messages').update(update).eq('id', msg.id);
        }
      }

      return ok({ received: true });
    }

    // ===== Incoming message =====
    console.log('[manus-wa] event=', event, 'instance=', instanceId, 'from=', payload.from, 'to=', payload.to, 'fromMe=', payload.fromMe, 'direction=', payload.direction, 'bodyPreview=', String(payload.body || '').slice(0, 80));
    if (event !== 'message') return ok({ received: true, ignored: event });

    const fromRaw = String(payload.from || '');
    const toRaw = String(payload.to || '');
    const chatIdRaw = String(payload.chatId || '');
    const senderLidRaw = String(payload.senderLid || '');
    const isGroup = fromRaw.endsWith('@g.us') || toRaw.endsWith('@g.us') || chatIdRaw.endsWith('@g.us');

    // LID detection: Manus often delivers `from` as bare digits but flags the chat as
    // `@lid` via `chatId` (or includes a `senderLid`). Treat any of these as LID so the
    // pairing/resolution blocks below actually fire.
    const isLidEvent =
      fromRaw.endsWith('@lid') ||
      chatIdRaw.endsWith('@lid') ||
      (!!senderLidRaw && senderLidRaw.replace(/\D/g, '') === fromRaw.replace(/\D/g, ''));

    // Outbound detection: prefer explicit flags from Manus, then fall back to phone comparison
    const myPhone = (settings.phone_number || '').toString().replace(/\D/g, '');
    const fromDigits = fromRaw.split('@')[0].replace(/\D/g, '');
    const fromMeFlag = payload.fromMe === true || payload.fromMe === 'true' ||
                       payload.direction === 'outgoing' || payload.direction === 'outbound';
    let isOutgoingFromPhone = fromMeFlag || (!!myPhone && fromDigits === myPhone);
    let sourcePhoneNumber = isOutgoingFromPhone ? fromDigits : myPhone;

    let counterpartRaw = isOutgoingFromPhone ? toRaw : fromRaw;
    let counterpartPhone = counterpartRaw.split('@')[0];
    let normalized = normalizePhone(counterpartPhone);
    const messageText = await resolveMessageText(payload, msgContainer, mediaAuth);
    const messageId = String(payload.id || '');

    // AUTO LID RESOLUTION 1/2 — real phone in the payload. Newer Baileys exposes the
    // sender's actual number alongside the LID (senderPn / participantPn); if the
    // gateway forwards any real-phone field that differs from the LID digits, use it
    // directly — no aliases or pairing needed.
    let lidAutoResolved = false;
    if (isLidEvent && !isOutgoingFromPhone && !isGroup) {
      const lidDigits = counterpartPhone.replace(/\D/g, '');
      const candidates = [payload.senderPn, payload.participantPn, payload.senderPhone, payload.senderNumber]
        .map((v: unknown) => String(v || '').split('@')[0].replace(/\D/g, ''))
        .filter((d: string) => d && d.length >= 9 && d.length <= 15 && d !== lidDigits);
      if (candidates.length > 0) {
        counterpartPhone = candidates[0];
        counterpartRaw = `${counterpartPhone}@c.us`;
        normalized = normalizePhone(counterpartPhone);
        lidAutoResolved = true;
        console.log('[manus-wa] LID auto-resolved from payload real-phone field', { lid: lidDigits, phone: counterpartPhone });
        // Persist the mapping so future events resolve even without the payload field.
        supabase.from('wa_lid_map')
          .upsert({ lid: lidDigits, phone: counterpartPhone, connection_user_id: connectionUserId, source: 'payload' }, { onConflict: 'lid' })
          .then(() => {}, () => {});
      } else if (lidDigits) {
        // AUTO LID RESOLUTION 2/2 — learned map. Any previously learned lid→phone pair
        // (from payload fields or Green-API pairing, across all tenants on this system)
        // resolves deterministically with zero configuration.
        const { data: known } = await supabase
          .from('wa_lid_map')
          .select('phone')
          .eq('lid', lidDigits)
          .maybeSingle();
        if (known?.phone) {
          counterpartPhone = String(known.phone);
          counterpartRaw = `${counterpartPhone}@c.us`;
          normalized = normalizePhone(counterpartPhone);
          lidAutoResolved = true;
          console.log('[manus-wa] LID auto-resolved from learned map', { lid: lidDigits, phone: counterpartPhone });
        }
      }
    }

    // ===== ATOMIC DEDUP =====
    // Manus occasionally delivers the same webhook twice. Without this guard
    // Carmen would run twice and reply twice (esp. in groups, which had no
    // chat_messages-based dedup). We atomically claim the messageId here,
    // BEFORE any branching (group vs private), so duplicates exit immediately.
    if (messageId) {
      const { error: claimErr } = await supabase
        .from('processed_webhook_messages')
        .insert({
          provider: 'manus_wa',
          tenant_id: tenantId,
          external_message_id: messageId,
        });
      if (claimErr) {
        // 23505 = unique_violation → another invocation already processing this msg
        if ((claimErr as any).code === '23505') {
          console.log('[manus-wa] duplicate webhook dropped', { messageId, bodyPreview: String(messageText).slice(0, 60) });
          return ok({ received: true, duplicate: true });
        }
        // Any other error: log but continue (don't lose messages on transient DB issues)
        console.error('[manus-wa] dedup insert failed (continuing):', claimErr);
      }
    }


    // ACTIVATION HANDSHAKE: an unresolved-LID private message may be the reply to
    // a "you were authorized" activation message (sent by carmen-activate-phone
    // when a phone is added to carmen_allowed_phones). A reply carrying the
    // one-time code — or quoting the activation message — proves the sender owns
    // the allow-listed number, so we learn the LID→phone mapping permanently.
    if (!isGroup && isLidEvent && !isOutgoingFromPhone && !lidAutoResolved && messageText.trim()) {
      try {
        const { data: pendings } = await supabase
          .from('wa_pending_activations')
          .select('id, phone, code, activation_message_id')
          .eq('tenant_id', tenantId)
          .eq('status', 'pending')
          .gte('created_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
          .limit(10);
        if (pendings && pendings.length > 0) {
          const quotedId = String(
            (payload as any).quotedMsgId || (payload as any).quotedMessageId ||
            (payload as any)?.quotedMsg?.id || (msgContainer as any)?.contextInfo?.stanzaId || '',
          );
          const hit = pendings.find((p: any) =>
            (p.code && new RegExp(`(^|\\D)${p.code}(\\D|$)`).test(messageText)) ||
            (p.activation_message_id && quotedId && p.activation_message_id === quotedId));
          if (hit) {
            const lidDigits = counterpartPhone.replace(/\D/g, '');
            const realPhone = String(hit.phone).replace(/\D/g, '');
            await supabase.from('wa_lid_map')
              .upsert({ lid: lidDigits, phone: realPhone, connection_user_id: connectionUserId, source: 'activation' }, { onConflict: 'lid' });
            await supabase.from('wa_pending_activations')
              .update({ status: 'completed', completed_at: new Date().toISOString(), completed_lid: lidDigits })
              .eq('id', hit.id);
            await supabase.from('carmen_whatsapp_identities')
              .update({ verified_at: new Date().toISOString(), updated_at: new Date().toISOString() })
              .eq('tenant_id', tenantId)
              .eq('phone', realPhone)
              .eq('status', 'approved');
            console.log('[manus-wa] activation completed — LID mapped', { lid: lidDigits, phone: realPhone });
            // Confirm to the user through the standard send path (to the real phone).
            fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-manus-wa-message`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
              },
              body: JSON.stringify({
                integrationId: integ.id, tenantId, phoneNumber: realPhone,
                senderUserId: connectionUserId,
                message: 'מעולה, זיהיתי אותך ✅ מעכשיו אפשר לדבר איתי — פשוט תתחיל הודעה במילה "כרמן".',
              }),
            }).catch((e) => console.error('[manus-wa] activation confirm send failed:', e?.message));
            return ok({ received: true, activation: 'completed' });
          }
        }
      } catch (e) {
        console.error('[manus-wa] activation check failed (continuing):', String(e));
      }
    }

    // ECHO GUARD: Manus mirrors EVERY message (in and out) as inbound @lid events.
    // If we just sent this exact text via Manus or Green API in the last 2 minutes, drop it.
    if (!isOutgoingFromPhone && isLidEvent && messageText.trim()) {
      const { data: ownOutbound } = await supabase
        .from('chat_messages')
        .select('id, provider, created_at')
        .eq('tenant_id', tenantId)
        .eq('direction', 'outbound')
        .in('provider', ['manus_wa', 'green_api'])
        .eq('message_text', messageText)
        .gte('created_at', new Date(Date.now() - 2 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(1);
      if (ownOutbound && ownOutbound.length > 0) {
        const allowGreenApiCarmenKickoff =
          ownOutbound[0].provider === 'green_api' && /כרמן|carmen/i.test(messageText);
        if (!allowGreenApiCarmenKickoff) {
          console.log('[manus-wa] echo dropped — matches our own outbound', { provider: ownOutbound[0].provider, messageId, bodyPreview: messageText.slice(0, 60) });
          return ok({ received: true, ignored: 'self_echo' });
        }
        console.log('[manus-wa] keeping Green API Carmen kickoff mirrored by Manus', { messageId, bodyPreview: messageText.slice(0, 60) });
      }
    }

    // Manus sometimes reports manual outgoing phone messages as inbound @lid events.
    // If Green API receives the same WhatsApp message as outbound moments later, use it
    // as the direction/contact source AND route Carmen replies through Green API
    // (so the reply comes from the same WhatsApp number the operator actually used).
    let pairedFromGreenApi = false;
    // When the LID was already deterministically resolved (payload field / learned map),
    // the 2.6s pairing wait is pure latency — skip it. Pairing remains for unresolved LIDs
    // (it both fixes direction for own-outbound mirrors and feeds the learned map).
    if (!isOutgoingFromPhone && !isGroup && isLidEvent && messageText.trim() && !lidAutoResolved) {
      await new Promise((resolve) => setTimeout(resolve, 2600));
      const { data: greenMatches } = await supabase
        .from('chat_messages')
        .select('sender_phone, raw_provider_data, created_at, connection_user_id')
        .eq('tenant_id', tenantId)
        .eq('provider', 'green_api')
        .eq('direction', 'outbound')
        .eq('message_text', messageText)
        .gte('created_at', new Date(Date.now() - 2 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(5);
      const pairedOutgoing = (greenMatches || []).find((m: any) =>
        !messageId || String(m.raw_provider_data?.idMessage || '') === messageId
      ) || greenMatches?.[0];
      if (pairedOutgoing?.sender_phone) {
        isOutgoingFromPhone = true;
        counterpartPhone = String(pairedOutgoing.sender_phone);
        counterpartRaw = `${counterpartPhone}@c.us`;
        normalized = normalizePhone(counterpartPhone);
        sourcePhoneNumber = String(
          pairedOutgoing.raw_provider_data?.senderData?.sender ||
          pairedOutgoing.raw_provider_data?.instanceData?.wid ||
          ''
        ).split('@')[0].replace(/[^0-9]/g, '');
        pairedFromGreenApi = true;
        console.log('[manus-wa] paired LID event with Green API outbound', { messageId, counterpartPhone, sourcePhoneNumber });
        // AUTO LID LEARNING — a successful pairing proves lid↔phone; persist it so
        // future events (any tenant on this system) resolve without pairing or config.
        const learnedLid = fromRaw.split('@')[0].replace(/\D/g, '');
        if (learnedLid && learnedLid !== counterpartPhone.replace(/\D/g, '')) {
          supabase.from('wa_lid_map')
            .upsert({ lid: learnedLid, phone: counterpartPhone.replace(/\D/g, ''), connection_user_id: connectionUserId, source: 'green_api_pairing' }, { onConflict: 'lid' })
            .then(() => {}, () => {});
        }
      }
    }

    // Manus can emit phone-app messages as opaque @lid IDs instead of the real phone.
    // For a direct Carmen flow pinned to this Manus integration and scoped to exactly
    // one phone, resolve the LID to that configured phone so the Carmen trigger/session
    // can match instead of being blocked by the random LID number.
    // fromMeFlag guard: when David sends OUTBOUND to a third party (e.g. Ana), the
    // to-field is already a real phone and the LID resolver must NOT overwrite it with
    // a Carmen session phone — that is the root cause of Carmen responding to "Hi Ana".
    if (!isGroup && !pairedFromGreenApi && isLidEvent && !fromMeFlag && !lidAutoResolved) {
      try {
        const carmenAutomation = await findCarmenSessionAutomation(supabase, tenantId, integ.id, {
          isGroup: false,
          chatId: `${counterpartPhone}@c.us`,
          phoneNumber: counterpartPhone,
        });
        const cfg = carmenAutomation?.configuration || {};
        const scopeMode = cfg.carmen_scope_mode || 'all';
        const allowedPhones = Array.isArray(cfg.carmen_allowed_phones)
          ? [...new Set(cfg.carmen_allowed_phones.map((p: any) => String(p).replace(/\D/g, '')).filter(Boolean))]
          : [];
        const idleMin = Number(cfg.session_timeout_minutes) > 0 ? Number(cfg.session_timeout_minutes) : 5;
        const since = new Date(Date.now() - idleMin * 60 * 1000).toISOString();

        // Resolution priority for LID events on private Carmen flows:
        // 0) Explicit LID→phone map in the automation config (carmen_lid_aliases) — the only
        //    deterministic option on a cold start when several phones are allowed.
        // 1) Explicit allowed phones (specific_phone scope) — pick fresh session phone, else single allowed phone.
        // 2) Otherwise (scope=all or no allowed list) — pick the unique fresh active Carmen session
        //    on this connection. This is what enables continuation messages without re-saying "כרמן".
        let aliasPhone: string | null = null;
        let aliasReason = '';

        const lidAliases: Record<string, string> = (cfg.carmen_lid_aliases && typeof cfg.carmen_lid_aliases === 'object')
          ? cfg.carmen_lid_aliases
          : {};
        const lidKey = String(counterpartPhone || '').replace(/\D/g, '');
        if (lidKey && lidAliases[lidKey]) {
          aliasPhone = String(lidAliases[lidKey]).replace(/\D/g, '');
          aliasReason = 'configured_lid_alias';
        }

        if (!aliasPhone && scopeMode === 'specific_phone' && allowedPhones.length >= 1) {
          if (allowedPhones.length === 1) {
            aliasPhone = allowedPhones[0] as string;
            aliasReason = 'single_allowed_phone';
          } else {
            const { data: recentSessions } = await supabase
              .from('carmen_whatsapp_sessions')
              .select('phone, last_message_at, created_at')
              .eq('tenant_id', tenantId)
              .eq('status', 'active')
              .eq('connection_user_id', connectionUserId)
              .in('phone', allowedPhones)
              .gte('last_message_at', since)
              .order('last_message_at', { ascending: false })
              .limit(1);
            if (recentSessions && recentSessions.length > 0) {
              aliasPhone = String(recentSessions[0].phone);
              aliasReason = 'fresh_session_within_allowed';
            }
          }
        }

        // Generic resolver: even without specific_phone scope, if exactly one fresh
        // active Carmen session exists on this connection, attribute the @lid event
        // to it. This makes continuation messages work in "כרמן ישיר" flows.
        if (!aliasPhone) {
          const { data: freshSessions } = await supabase
            .from('carmen_whatsapp_sessions')
            .select('phone, last_message_at, created_at, automation_id')
            .eq('tenant_id', tenantId)
            .eq('status', 'active')
            .eq('connection_user_id', connectionUserId)
            .gte('last_message_at', since)
            .order('last_message_at', { ascending: false })
            .limit(2);
          if (freshSessions && freshSessions.length === 1) {
            aliasPhone = String(freshSessions[0].phone);
            aliasReason = 'unique_fresh_session';
          } else if (freshSessions && freshSessions.length > 1 && carmenAutomation?.id) {
            // Prefer a session bound to the same Carmen automation we matched.
            const preferred = freshSessions.find((s: any) => s.automation_id === carmenAutomation.id);
            if (preferred) {
              aliasPhone = String(preferred.phone);
              aliasReason = 'fresh_session_matching_automation';
            } else {
              console.log('[manus-wa] LID resolution skipped — multiple fresh sessions, no clear owner', {
                count: freshSessions.length,
                preview: messageText.slice(0, 60),
              });
            }
          }
        }

        if (aliasPhone) {
          const aliasChatId = `${aliasPhone}@c.us`;
          const { data: activeAliasSession } = await supabase
            .from('carmen_whatsapp_sessions')
            .select('id, last_message_at, created_at')
            .eq('tenant_id', tenantId)
            .eq('status', 'active')
            .eq('connection_user_id', connectionUserId)
            .eq('chat_id', aliasChatId)
            .eq('phone', aliasPhone)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          const lastActivity = activeAliasSession
            ? new Date(activeAliasSession.last_message_at || activeAliasSession.created_at).getTime()
            : 0;
          const hasFreshAliasSession = !!activeAliasSession && (Date.now() - lastActivity) <= idleMin * 60 * 1000;
          // Support multiple configured wake-words + Whisper spelling variants of "כרמן".
          const triggerKeywords = (Array.isArray(cfg.trigger_keywords) && cfg.trigger_keywords.length
            ? cfg.trigger_keywords
            : [cfg.trigger_keyword || 'כרמן']).map((k: any) => String(k || '').toLowerCase()).filter(Boolean);
          const lowerMsg = String(messageText || '').toLowerCase();
          const hasTriggerKeyword = triggerKeywords.some((k: string) => lowerMsg.includes(k)) || /[כק]א?רמן/.test(lowerMsg);

          counterpartPhone = aliasPhone;
          counterpartRaw = aliasChatId;
          normalized = normalizePhone(aliasPhone);

          if (hasFreshAliasSession || hasTriggerKeyword) {
            isOutgoingFromPhone = true;
            sourcePhoneNumber = aliasPhone;
          }

          console.log('[manus-wa] resolved LID for Carmen direct flow', {
            fromRaw,
            aliasPhone,
            aliasReason,
            scopeMode,
            manualLike: isOutgoingFromPhone,
            hasFreshAliasSession,
            hasTriggerKeyword,
          });
        }
      } catch (err) {
        console.error('[manus-wa] LID Carmen resolution failed:', err);
      }
    }

    // FALLBACK LID RESOLUTION: when an inbound @lid event arrives and the counterpart
    // phone is unresolvable (empty OR equals the raw LID number which is NOT a real
    // phone), but there is an ACTIVE Carmen session on this connection within the
    // idle window, attribute the message to that session's phone. Without this,
    // mid-conversation replies (which Manus often delivers as pure LID events) get
    // dropped by scope filtering and Carmen goes silent until the user types "כרמן" again.
    const counterpartLooksLikeLid =
      !counterpartPhone ||
      counterpartPhone.replace(/\D/g, '') === fromDigits ||
      counterpartPhone.replace(/\D/g, '').length > 14; // real phones ≤ 15 digits, LIDs are typically 15+
    if (!isGroup && isLidEvent && counterpartLooksLikeLid && messageText.trim()) {
      try {
        const { data: freshSessions } = await supabase
          .from('carmen_whatsapp_sessions')
          .select('phone, chat_id, last_message_at, automation_id')
          .eq('tenant_id', tenantId)
          .eq('status', 'active')
          .eq('connection_user_id', connectionUserId)
          .gte('last_message_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
          .order('last_message_at', { ascending: false })
          .limit(2);
        if (freshSessions && freshSessions.length === 1) {
          const aliasPhone = String(freshSessions[0].phone);
          counterpartPhone = aliasPhone;
          counterpartRaw = `${aliasPhone}@c.us`;
          normalized = normalizePhone(aliasPhone);
          isOutgoingFromPhone = true;
          sourcePhoneNumber = aliasPhone;
          console.log('[manus-wa] LID fallback → resolved via active Carmen session', {
            aliasPhone, body: messageText.slice(0, 60),
          });
        } else if (freshSessions && freshSessions.length > 1) {
          console.log('[manus-wa] LID fallback skipped — multiple fresh sessions', {
            count: freshSessions.length,
            preview: messageText.slice(0, 60),
          });
        } else {
          console.log('[manus-wa] LID fallback found no active Carmen session', {
            counterpartPhone, fromDigits, preview: messageText.slice(0, 60),
          });
        }
      } catch (err) {
        console.error('[manus-wa] LID fallback resolution failed:', err);
      }
    }

    // Group messages: skip client/lead matching & chat_messages insert, but still let Carmen respond in-group.
    if (isGroup) {
      // Prefer explicit group fields. `from` is often the sender's personal phone in groups,
      // and `to` may be empty — in which case we must fall back to chatId/groupId from the payload.
      const groupIdRaw = String((payload as any).groupId || '');
      const groupChatId = (
        fromRaw.endsWith('@g.us') ? fromRaw :
        toRaw.endsWith('@g.us') ? toRaw :
        chatIdRaw.endsWith('@g.us') ? chatIdRaw :
        groupIdRaw.endsWith('@g.us') ? groupIdRaw :
        (chatIdRaw || groupIdRaw || toRaw)
      );

      // Per-group tenant routing (shared bot): a single WhatsApp bot may sit in groups
      // that belong to DIFFERENT organizations. Resolve the owning tenant from the
      // group's chat id so Carmen answers for the right org (and scopes to its clients).
      // Falls back to the bot's own tenant when the group isn't registered.
      let groupTenantId = tenantId;
      try {
        const { data: wgRows } = await supabase
          .from('whatsapp_groups')
          .select('tenant_id')
          .eq('group_chat_id', groupChatId)
          .limit(10);
        const rows = wgRows || [];
        const ownRegistered = rows.some((r: any) => r.tenant_id === tenantId);
        if (!ownRegistered && rows.length > 0) {
          // The bot's own tenant has no whatsapp_groups claim here. A group is
          // often registered under ANOTHER tenant just because the operator's
          // green_api phone synced it (e.g. "דוד ואנה DMM" under MC) — that must
          // NOT steal events from a Carmen whose own tenant runs in
          // open-member-groups mode, where membership itself is the claim.
          // Route to the registered tenant only in the legacy shared-bot case.
          const { data: ownSteps } = await supabase
            .from('automation_flow_steps')
            .select('configuration')
            .eq('tenant_id', tenantId)
            .eq('step_type', 'trigger')
            .eq('action_type', 'carmen_whatsapp_session')
            .limit(10);
          const ownHasOpenMode = (ownSteps || []).some(
            (s: any) => s?.configuration?.carmen_open_member_groups === true,
          );
          if (!ownHasOpenMode) groupTenantId = rows[0].tenant_id as string;
        }
      } catch (_e) { /* fall back to bot tenant */ }
      if (groupTenantId !== tenantId) {
        console.log('[manus-wa group] routed by group → tenant', { groupChatId, botTenant: tenantId, groupTenant: groupTenantId });
      }

      const messageText = await resolveMessageText(payload, msgContainer, { ...mediaAuth, tenantId: groupTenantId });
      const senderName = (payload.senderName || payload.fromName || payload.authorName || null) as string | null;

      // Extract the REAL sender phone from author/participant fields.
      // Falling back to fromRaw inside a group gives the group id (120363...@g.us) which is useless.
      const authorCandidates = [
        payload.author, payload.participant, key.participant,
        (msgContainer as any)?.participant, (msgContainer as any)?.author,
      ].filter((v: any) => typeof v === 'string' && v.includes('@')) as string[];
      const authorRaw = authorCandidates[0] || '';
      let authorPhone = authorRaw ? authorRaw.split('@')[0].replace(/\D/g, '') : '';

      // GROUP AUTHOR LID RESOLUTION — same layers as the private branch above.
      // The "כרמן" trigger comes from group MEMBERS, and members often arrive as
      // anonymous @lid authors; without resolution Carmen can't tell WHO in the
      // group is speaking. 1) real-phone payload fields → 2) learned wa_lid_map.
      // Payload resolutions are persisted so group traffic keeps teaching the map.
      if (/@lid/i.test(authorRaw) && authorPhone) {
        const lidDigits = authorPhone;
        const realCandidates = [payload.senderPn, payload.participantPn, payload.senderPhone, payload.senderNumber]
          .map((v: unknown) => String(v || '').split('@')[0].replace(/\D/g, ''))
          .filter((d: string) => d && d.length >= 9 && d.length <= 15 && d !== lidDigits);
        if (realCandidates.length > 0) {
          authorPhone = realCandidates[0];
          console.log('[manus-wa group] author LID resolved from payload field', { lid: lidDigits, phone: authorPhone });
          supabase.from('wa_lid_map')
            .upsert({ lid: lidDigits, phone: authorPhone, connection_user_id: connectionUserId, source: 'payload' }, { onConflict: 'lid' })
            .then(() => {}, () => {});
        } else {
          const { data: knownLid } = await supabase
            .from('wa_lid_map')
            .select('phone')
            .eq('lid', lidDigits)
            .maybeSingle();
          if (knownLid?.phone) {
            authorPhone = String(knownLid.phone).replace(/\D/g, '');
            console.log('[manus-wa group] author LID resolved from learned map', { lid: lidDigits, phone: authorPhone });
          }
        }
      }

      // ECHO / OUTBOUND GUARD for groups: Manus mirrors our own outbound back as inbound.
      // If author's digits match our connected phone, OR if the body matches an outbound we
      // just sent to this same group within the last 2 minutes, drop it.
      const myDigits = (settings.phone_number || '').toString().replace(/\D/g, '');
      const looksLikeOurOwn = !!authorPhone && !!myDigits && (authorPhone === myDigits || authorPhone.endsWith(myDigits) || myDigits.endsWith(authorPhone));
      if (looksLikeOurOwn || isOutgoingFromPhone) {
        console.log('[manus-wa group] dropping own outbound mirror', { groupChatId, authorPhone, myDigits, isOutgoingFromPhone });
        return ok({ received: true, ignored: 'group_self_echo' });
      }
      if (messageText && messageText.trim()) {
        const { data: recentOwn } = await supabase
          .from('chat_messages')
          .select('id, created_at')
          .eq('tenant_id', tenantId)
          .eq('direction', 'outbound')
          .eq('group_id', null as any)
          .in('provider', ['manus_wa', 'green_api'])
          .eq('message_text', messageText)
          .gte('created_at', new Date(Date.now() - 2 * 60 * 1000).toISOString())
          .limit(1);
        if (recentOwn && recentOwn.length > 0) {
          console.log('[manus-wa group] dropping echoed body of our own outbound', { groupChatId, bodyPreview: messageText.slice(0, 60) });
          return ok({ received: true, ignored: 'group_body_echo' });
        }
      }

      let carmenOutcome: string | null = null;
      try {
        const result = await handleCarmenMessage({
          supabase,
          tenantId: groupTenantId,
          integrationId: integ.id,
          connectionUserId,
          chatId: groupChatId,
          phoneNumber: authorPhone || '',
          senderName,
          messageText,
          isIncoming: !isOutgoingFromPhone,
          isManualOutgoing: isOutgoingFromPhone,
          isGroup: true,
          sourceChannel: 'own_instance',
          isVoiceMessage: messageIsVoice(payload, msgContainer),
          sendVoice: makeVoiceSender(groupTenantId),
          sendMessage: async (_chatId: string, message: string) => {
            const settingsAny = (integ.settings as any) || {};
            const baseUrl = settingsAny.gateway_url || 'https://whatsappgw-pzpyrrww.manus.space';
            const instanceId = settingsAny.instance_id;
            const apiKey = integ.api_key;
            if (!instanceId || !apiKey) return false;
            // IMPORTANT: bound the gateway call with a timeout. Without it, a stalled Manus
            // connection hangs this whole function and the WhatsApp message is stuck on "sending".
            // No retry on abort: the message may already have been delivered, so a retry risks a duplicate.
            const FETCH_TIMEOUT_MS = 60000;
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
            const started = Date.now();
            try {
              const res = await fetch(`${baseUrl}/api/v1/instances/${instanceId}/send/group`, {
                method: 'POST',
                headers: { 'X-Api-Key': apiKey, 'Content-Type': 'application/json' },
                body: JSON.stringify({ groupId: groupChatId, body: message }),
                signal: controller.signal,
              });
              clearTimeout(timer);
              console.log('[manus-wa Carmen group send]', { groupChatId, status: res.status, ok: res.ok, elapsedMs: Date.now() - started });
              return res.ok;
            } catch (err: any) {
              clearTimeout(timer);
              const isAbort = err?.name === 'AbortError';
              console.error('manus-wa Carmen group sendMessage error:', isAbort
                ? `aborted after ${Date.now() - started}ms (gateway timeout) — not retried to avoid duplicate delivery`
                : err);
              return false;
            }
          },
        });
        if (result.handled) carmenOutcome = result.outcome;
        console.log('[carmen-group]', { groupChatId, authorPhone, isOutgoingFromPhone, handled: result.handled, outcome: (result as any).outcome, reason: (result as any).reason, body: String(messageText).slice(0, 60) });
      } catch (err) {
        console.error('manus-wa Carmen group handler error:', err);
      }

      return ok({ received: true, group: true, carmen: carmenOutcome });
    }

    // Dedup by message id
    if (messageId) {
      const { data: existing } = await supabase
        .from('chat_messages')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('provider', 'manus_wa')
        .eq('raw_provider_data->>id', messageId)
        .maybeSingle();
      if (existing) return ok({ received: true, duplicate: true });
    }

    // Look up client/lead by phone (last 9 digits)
    let clientId: string | null = null;
    let leadId: string | null = null;

    const { data: client } = await supabase
      .from('clients')
      .select('id')
      .eq('tenant_id', tenantId)
      .or(`phone.ilike.%${normalized}%,phone.ilike.%${counterpartPhone}%`)
      .maybeSingle();
    if (client) clientId = client.id;

    if (!clientId) {
      const { data: lead } = await supabase
        .from('leads')
        .select('id')
        .eq('tenant_id', tenantId)
        .or(`phone.ilike.%${normalized}%,phone.ilike.%${counterpartPhone}%`)
        .maybeSingle();
      if (lead) leadId = lead.id;
    }

    const { error: insertError } = await supabase.from('chat_messages').insert({
      client_id: clientId,
      lead_id: leadId,
      tenant_id: tenantId,
      connection_user_id: connectionUserId,
      message_text: messageText,
      direction: isOutgoingFromPhone ? 'outbound' : 'inbound',
      channel: 'whatsapp',
      provider: 'manus_wa',
      sender_phone: counterpartPhone,
      raw_provider_data: payload,
    });

    if (insertError) {
      console.error('Failed to insert chat_messages:', insertError);
      throw insertError;
    }

    // ===== Carmen WhatsApp session handling =====
    // If this came from the operator's personal phone (paired via Green API),
    // Carmen should reply BACK to the operator's phone — NOT to the device itself.
    const carmenTargetPhone = pairedFromGreenApi && sourcePhoneNumber
      ? sourcePhoneNumber
      : counterpartPhone;
    const chatIdForCarmen = `${carmenTargetPhone}@c.us`;
    const senderName = (payload.senderName || payload.fromName || null) as string | null;

    // OUTBOUND-TO-THIRD-PARTY GUARD: David's phone is the Manus gateway, so every
    // outbound message he sends to any contact flows through this webhook. If the
    // message is outbound, has no trigger keyword, and there is no existing Carmen
    // session for this specific chat, Carmen must not respond. The LID resolver above
    // may have already (incorrectly) attributed the message to Carmen's chat_id before
    // this guard was added; this check is the definitive safety net.
    if (isOutgoingFromPhone && !pairedFromGreenApi && !isGroup) {
      const msgPrefix = String(messageText || '').toLowerCase().replace(/^\s*🎤\s*/, '').trim().slice(0, 80);
      const hasOwnerTrigger = /[כק]א?רמן|carmen|קלוד|claude/i.test(msgPrefix);
      if (!hasOwnerTrigger) {
        const { data: existingCarmenSession } = await supabase
          .from('carmen_whatsapp_sessions')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('status', 'active')
          .eq('connection_user_id', connectionUserId)
          .eq('chat_id', chatIdForCarmen)
          .maybeSingle();
        if (!existingCarmenSession) {
          console.log('[manus-wa] outbound-to-third-party: no trigger keyword + no active carmen session → skip', {
            chatIdForCarmen, carmenTargetPhone, bodyPreview: String(messageText).slice(0, 60),
          });
          return ok({ received: true, ignored: 'outbound_third_party' });
        }
      }
    }

    let carmenOutcome: string | null = null;
    try {
      const result = await handleCarmenMessage({
        supabase,
        tenantId,
        integrationId: integ.id,
        connectionUserId,
        chatId: chatIdForCarmen,
        phoneNumber: carmenTargetPhone,
          sourcePhoneNumber,
        senderName,
        messageText,
        isIncoming: !isOutgoingFromPhone,
        isManualOutgoing: isOutgoingFromPhone,
        isGroup: false,
        sourceChannel: 'own_instance',
        isVoiceMessage: messageIsVoice(payload, msgContainer),
        sendVoice: makeVoiceSender(tenantId),
        sendMessage: async (_chatId: string, message: string) => {
          try {
            const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
            const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
            console.log('[carmen->manus] sending', { integrationId: integ.id, tenantId, phoneNumber: carmenTargetPhone, connectionUserId, messageLen: message.length });
            const res = await fetch(`${supabaseUrl}/functions/v1/send-manus-wa-message`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${serviceKey}`,
              },
              body: JSON.stringify({
                integrationId: integ.id,
                tenantId,
                phoneNumber: carmenTargetPhone,
                senderUserId: connectionUserId,
                message,
              }),
            });
            const txt = await res.text();
            console.log('[carmen->manus] result', { status: res.status, body: txt.slice(0, 500) });
            return res.ok;
          } catch (err) {
            console.error('manus-wa Carmen sendMessage error:', err);
            return false;
          }
        },
      });
      if (result.handled) carmenOutcome = result.outcome;
      console.log('[carmen-private]', { chatId: chatIdForCarmen, carmenTargetPhone, counterpartPhone, sourcePhoneNumber, pairedFromGreenApi, isOutgoingFromPhone, handled: result.handled, outcome: (result as any).outcome, reason: (result as any).reason, body: String(messageText).slice(0, 60) });
    } catch (err) {
      console.error('manus-wa Carmen handler error:', err);
    }

    return ok({
      success: true,
      direction: isOutgoingFromPhone ? 'outbound' : 'inbound',
      contactType: clientId ? 'client' : leadId ? 'lead' : 'unknown',
      contactId: clientId || leadId || null,
      carmen: carmenOutcome,
    });

  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('manus-wa-webhook error:', msg);
    return ok({ error: msg }, 500);
  }
});
