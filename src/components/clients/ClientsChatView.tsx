import { useState, useMemo, useCallback, useRef } from "react";
import ChatViewComponent from "@/components/chat/ChatView";
import { User, Phone, PhoneCall, Building2, Clock, Search, Mail, Globe, CheckSquare, Trash2, MessageSquare, FileText, DollarSign, X, Edit, Pencil, Check, Users } from "lucide-react";
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
import { ClientUpdatesTab } from "@/components/clients/ClientUpdatesTab";
import AddTaskForm from "@/components/forms/AddTaskForm";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";

interface ClientsChatViewProps {
  clients: any[];
  agencies?: any[];
  canViewFinance?: boolean;
  getClientFinancialData?: (clientId: string) => any;
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
}: ClientsChatViewProps) {
  const [selectedClientId, setSelectedClientId] = useState<string | null>(clients[0]?.id || null);
  const [listSearch, setListSearch] = useState("");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("details");
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedClientIds, setSelectedClientIds] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [callDialogOpen, setCallDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  const { tenantId } = useCurrentTenant();

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

  const filteredClients = useMemo(() => {
    if (!listSearch.trim()) return clients;
    const q = listSearch.toLowerCase();
    return clients.filter(c =>
      (c.name || "").toLowerCase().includes(q) ||
      (c.contact_name || "").toLowerCase().includes(q) ||
      (c.phone || "").includes(q)
    );
  }, [clients, listSearch]);

  const selectedClient = useMemo(() => {
    return clients.find(c => c.id === selectedClientId) || null;
  }, [clients, selectedClientId]);

  const handleDelete = async (id: string) => {
    const confirmed = window.confirm("האם למחוק את הלקוח?");
    if (!confirmed) return;
    try {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
      toast.success("לקוח נמחק בהצלחה");
      const idx = clients.findIndex(c => c.id === id);
      const next = clients[idx + 1] || clients[idx - 1] || null;
      setSelectedClientId(next?.id || null);
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    } catch (error: any) {
      toast.error("שגיאה במחיקת לקוח: " + error.message);
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
  }, []);

  const handleBulkDelete = async () => {
    if (selectedClientIds.size === 0) return;
    const confirmed = window.confirm(`האם למחוק ${selectedClientIds.size} לקוחות?`);
    if (!confirmed) return;
    setBulkActionLoading(true);
    try {
      const { error } = await supabase.from("clients").delete().in("id", Array.from(selectedClientIds));
      if (error) throw error;
      toast.success(`${selectedClientIds.size} לקוחות נמחקו בהצלחה`);
      if (selectedClientIds.has(selectedClientId || "")) {
        setSelectedClientId(null);
      }
      exitMultiSelect();
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    } catch (error: any) {
      toast.error("שגיאה במחיקה: " + error.message);
    } finally {
      setBulkActionLoading(false);
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
      queryClient.invalidateQueries({ queryKey: ["clients"] });
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
      queryClient.invalidateQueries({ queryKey: ["clients"] });
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
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    } catch {
      toast.error("שגיאה בעדכון הסטטוס");
    }
  };

  const handleMoodChange = async (clientId: string, moodStatus: string) => {
    try {
      const { error } = await supabase.from("clients").update({ mood_status: moodStatus as any }).eq("id", clientId);
      if (error) throw error;
      toast.success("מצב הלקוח עודכן בהצלחה");
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    } catch {
      toast.error("שגיאה בעדכון מצב הלקוח");
    }
  };

  const getStatusInfo = (status: string) => STATUS_CONFIG[status] || STATUS_CONFIG.active;
  const getMoodInfo = (mood: string | null) => MOOD_CONFIG[mood || "happy"] || MOOD_CONFIG.happy;
  const getAgencyName = (agencyId: string) => agencies?.find((a: any) => a.id === agencyId)?.name || "";

  const updateClientField = async (clientId: string, field: string, value: any) => {
    try {
      const { error } = await supabase.from("clients").update({ [field]: value }).eq("id", clientId);
      if (error) throw error;
      toast.success("עודכן בהצלחה");
      queryClient.invalidateQueries({ queryKey: ["clients"] });
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
      const finalValue = type === "number" ? (editValue ? Number(editValue) : null) : (editValue || null);
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

  return (
    <div className="flex h-[calc(100vh-220px)] border rounded-lg overflow-hidden bg-background" dir="rtl">
      {/* Right side - Client list (25%) */}
      <div className="w-[25%] min-w-[240px] border-s flex flex-col bg-muted/20">
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
                  onClick={handleBulkDelete}
                  disabled={bulkActionLoading}
                >
                  <Trash2 className="h-3 w-3" />
                  מחק
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Client list */}
        <ScrollArea className="flex-1">
          <div className="divide-y">
            {filteredClients.map((client) => {
              const isSelected = client.id === selectedClientId;
              const isChecked = selectedClientIds.has(client.id);
              const statusInfo = getStatusInfo(client.status);
              const moodInfo = getMoodInfo(client.mood_status);

              return (
                <button
                  key={client.id}
                  onClick={() => {
                    if (multiSelectMode) {
                      toggleClientSelection(client.id);
                    } else {
                      setSelectedClientId(client.id);
                      setActiveTab("details");
                    }
                  }}
                  className={cn(
                    "w-full text-right p-3 hover:bg-muted/50 transition-colors cursor-pointer",
                    isSelected && !multiSelectMode && "bg-primary/10 border-e-4 border-e-primary",
                    isChecked && multiSelectMode && "bg-primary/10"
                  )}
                >
                  <div className="flex items-start gap-2 flex-row-reverse">
                    {multiSelectMode && (
                      <div className="pt-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => toggleClientSelection(client.id)}
                        />
                      </div>
                    )}
                    {/* Avatar */}
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                      style={{ backgroundColor: statusInfo.color }}
                    >
                      {(client.name || "?")[0]}
                    </div>
                    <div className="flex-1 min-w-0 text-right">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {moodInfo.emoji}
                        </span>
                        <span className="font-semibold text-sm truncate">
                          {client.name || "ללא שם"}
                        </span>
                      </div>
                      {client.agencies?.name && (
                        <p className="text-xs text-muted-foreground truncate">{client.agencies.name}</p>
                      )}
                      <div className="flex items-center gap-1 mt-1 flex-wrap justify-end">
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
          </div>
        </ScrollArea>
      </div>

      {/* Left side - Client detail panel (75%) */}
      <div className="flex-1 flex flex-col">
        {selectedClient ? (
          <>
            {/* Toolbar */}
            <div className="flex items-center gap-2 p-3 border-b bg-background/95 backdrop-blur-sm flex-wrap">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                  style={{ backgroundColor: getStatusInfo(selectedClient.status).color }}
                >
                  {(selectedClient.name || "?")[0]}
                </div>
                <div className="min-w-0">
                  <h2 className="font-bold text-base truncate">{selectedClient.name || "ללא שם"}</h2>
                  {selectedClient.agencies?.name && (
                    <p className="text-xs text-muted-foreground truncate">{selectedClient.agencies.name}</p>
                  )}
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
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => handleDelete(selectedClient.id)}
                  title="מחק לקוח"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Detail tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="mx-4 mt-3 grid grid-cols-5 w-auto max-w-2xl h-9 bg-muted/50 mr-4 ml-auto">
                <TabsTrigger value="details" className="text-xs gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  פרטי לקוח
                </TabsTrigger>
                <TabsTrigger value="business" className="text-xs gap-1.5">
                  <DollarSign className="h-3.5 w-3.5" />
                  מידע עסקי
                </TabsTrigger>
                <TabsTrigger value="updates" className="text-xs gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5" />
                  עדכונים
                </TabsTrigger>
                <TabsTrigger value="calls" className="text-xs gap-1.5">
                  <Phone className="h-3.5 w-3.5" />
                  שיחות
                </TabsTrigger>
                <TabsTrigger value="whatsapp" className="text-xs gap-1.5">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  WhatsApp
                </TabsTrigger>
              </TabsList>

              <ScrollArea className={cn("flex-1 p-4", (activeTab === "whatsapp" || activeTab === "calls") && "hidden")}>
                <TabsContent value="details" className="mt-0 space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    {/* Contact info */}
                    <div className="border rounded-lg p-4 space-y-3 text-right">
                      <h3 className="font-semibold text-sm flex items-center gap-2 justify-end">
                        פרטי קשר
                        <User className="h-4 w-4 text-primary" />
                      </h3>
                      <div className="space-y-2 text-sm">
                        <EditableField label=":איש קשר" value={selectedClient.contact_name} field="contact_name" clientId={selectedClient.id} />
                        <EditableField label=":טלפון" value={selectedClient.phone} field="phone" clientId={selectedClient.id} isLink linkPrefix="tel:" />
                        <EditableField label=":אימייל" value={selectedClient.email} field="email" clientId={selectedClient.id} isLink linkPrefix="mailto:" />
                        <EditableField label=":אתר" value={selectedClient.website} field="website" clientId={selectedClient.id} isLink />
                      </div>
                    </div>

                    {/* Dates */}
                    <div className="border rounded-lg p-4 space-y-3 text-right">
                      <h3 className="font-semibold text-sm flex items-center gap-2 justify-end">
                        ציר זמן
                        <Clock className="h-4 w-4 text-primary" />
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-end gap-2">
                          <span className="font-medium">
                            {selectedClient.start_date
                              ? format(new Date(selectedClient.start_date), "dd/MM/yyyy", { locale: he })
                              : "—"}
                          </span>
                          <span className="text-muted-foreground">:תאריך התחלה</span>
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
                  </div>

                  {/* Team */}
                  {selectedClient.client_team && selectedClient.client_team.length > 0 && (
                    <div className="border rounded-lg p-4 text-right">
                      <h3 className="font-semibold text-sm mb-2">קמפיינרים משויכים</h3>
                      <div className="flex flex-wrap gap-2">
                        {selectedClient.client_team.map((ct: any, i: number) => (
                          <Badge key={i} variant="secondary">
                            {ct?.campaigners?.full_name ?? "—"}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  <div className="border rounded-lg p-4 text-right">
                    <h3 className="font-semibold text-sm mb-2">הערות</h3>
                    <EditableField label="" value={selectedClient.notes} field="notes" clientId={selectedClient.id} type="textarea" />
                  </div>
                </TabsContent>

                <TabsContent value="business" className="mt-0 space-y-6">
                  <div className="border rounded-lg p-4 space-y-3 text-right">
                    <h3 className="font-semibold text-sm flex items-center gap-2 justify-end">
                      מידע עסקי
                      <DollarSign className="h-4 w-4 text-primary" />
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-end gap-2">
                        <span className="font-medium">{selectedClient.agencies?.name || "—"}</span>
                        <span className="text-muted-foreground">:סוכנות</span>
                      </div>
                      {canViewFinance && (
                        <>
                          <EditableField label=":ריטיינר" value={selectedClient.retainer?.toString() || ""} field="retainer" clientId={selectedClient.id} type="number" />
                          <EditableField label=":תקציב חודשי" value={selectedClient.monthly_budget?.toString() || ""} field="monthly_budget" clientId={selectedClient.id} type="number" />
                        </>
                      )}
                      <EditableField label=":תעשייה" value={selectedClient.industry} field="industry" clientId={selectedClient.id} />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="updates" className="mt-0">
                  <ClientUpdatesTab clientId={selectedClient.id} clientName={selectedClient.name || "לקוח"} />
                </TabsContent>
              </ScrollArea>

              {activeTab === "calls" && (
                <div className="flex-1 min-h-0 p-4">
                  <CallHistoryTab clientId={selectedClient.id} />
                </div>
              )}

              {activeTab === "whatsapp" && (
                <div className="flex-1 min-h-0">
                  {selectedClient.phone ? (
                    <ChatViewComponent
                      contactId={selectedClient.id}
                      contactType="client"
                      senderPhone={selectedClient.phone}
                      contactName={selectedClient.name || "לקוח"}
                    />
                  ) : (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      אין מספר טלפון ללקוח זה
                    </div>
                  )}
                </div>
              )}
            </Tabs>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center space-y-2">
              <User className="h-12 w-12 mx-auto opacity-30" />
              <p>בחר לקוח מהרשימה לצפייה בפרטים</p>
            </div>
          </div>
        )}
      </div>

      {/* Call dialog */}
      {selectedClient?.phone && (
        <CallDialog
          open={callDialogOpen}
          onOpenChange={setCallDialogOpen}
          phoneNumber={selectedClient.phone}
          contactName={selectedClient.name || "לקוח"}
          clientId={selectedClient.id}
        />
      )}
    </div>
  );
}
