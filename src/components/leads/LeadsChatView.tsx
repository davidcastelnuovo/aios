import { useState, useMemo, useCallback } from "react";
import ChatViewComponent from "@/components/chat/ChatView";
import { User, Phone, PhoneCall, Building2, Clock, Search, Tag, Mail, ExternalLink, CheckSquare, Trash2, Settings2, MessageSquare, FileText, DollarSign, Paperclip, Users, ChevronRight, X } from "lucide-react";
import { CallDialog } from "@/components/telephony/CallDialog";
import { CallHistoryTab } from "@/components/telephony/CallHistoryTab";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { EditLeadDialog } from "@/components/forms/EditLeadDialog";
import { LeadTagSelector, LeadTagBadges, LeadTagBadgesEditable } from "@/components/leads/LeadTagSelector";
import { LeadUpdatesTab } from "@/components/leads/LeadUpdatesTab";
import { FollowUpDatePicker } from "@/components/leads/FollowUpDatePicker";
import AddTaskForm from "@/components/forms/AddTaskForm";
import { ManagePipelineStagesDialog } from "@/components/forms/ManagePipelineStagesDialog";
import { ManageLeadStatusesDialog } from "@/components/forms/ManageLeadStatusesDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { useQueryClient } from "@tanstack/react-query";

interface LeadsChatViewProps {
  leads: any[];
  pipelineStages: Array<{ id: string; label: string; color: string; bgClass: string; borderColor: string; hexColor?: string }>;
  leadStatuses: Array<{ status_key: string; label: string; color: string; sort_order: number }>;
  allTags: Array<{ id: string; name: string; color: string }>;
  leadsTagsMap: Record<string, string[]>;
  productsLookup: Record<string, { name: string; price: number }>;
  onStatusChange: (leadId: string, newStatus: string) => void;
  onResponseStatusChange: (leadId: string, responseStatus: string | null) => void;
  onFollowUpDateUpdate?: (leadId: string, newDate: string | null) => void;
  isCompanyNameVisible: boolean;
  searchQuery: string;
}

function getStatusColor(statusKey: string | null, statuses: Array<{ status_key: string; color: string }>) {
  if (!statusKey) return undefined;
  return statuses.find(s => s.status_key === statusKey)?.color;
}

export function LeadsChatView({
  leads,
  pipelineStages,
  leadStatuses,
  allTags,
  leadsTagsMap,
  productsLookup,
  onStatusChange,
  onResponseStatusChange,
  onFollowUpDateUpdate,
  isCompanyNameVisible,
  searchQuery,
}: LeadsChatViewProps) {
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(leads[0]?.id || null);
  const [listSearch, setListSearch] = useState("");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("details");
  const [manageStagesOpen, setManageStagesOpen] = useState(false);
  const [manageStatusesOpen, setManageStatusesOpen] = useState(false);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [callDialogOpen, setCallDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const filteredListLeads = useMemo(() => {
    if (!listSearch.trim()) return leads;
    const q = listSearch.toLowerCase();
    return leads.filter(l =>
      (l.contact_name || "").toLowerCase().includes(q) ||
      (l.company_name || "").toLowerCase().includes(q) ||
      (l.phone || "").includes(q)
    );
  }, [leads, listSearch]);

  const selectedLead = useMemo(() => {
    return leads.find(l => l.id === selectedLeadId) || null;
  }, [leads, selectedLeadId]);

  const selectedLeadTagIds = selectedLead ? (leadsTagsMap[selectedLead.id] || []) : [];

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("leads").delete().eq("id", id);
      if (error) throw error;
      toast.success("ליד נמחק בהצלחה");
      const idx = leads.findIndex(l => l.id === id);
      const next = leads[idx + 1] || leads[idx - 1] || null;
      setSelectedLeadId(next?.id || null);
    } catch (error: any) {
      toast.error("שגיאה במחיקת ליד: " + error.message);
    }
  };

  const toggleLeadSelection = useCallback((leadId: string) => {
    setSelectedLeadIds(prev => {
      const next = new Set(prev);
      if (next.has(leadId)) next.delete(leadId);
      else next.add(leadId);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedLeadIds.size === filteredListLeads.length) {
      setSelectedLeadIds(new Set());
    } else {
      setSelectedLeadIds(new Set(filteredListLeads.map(l => l.id)));
    }
  }, [filteredListLeads, selectedLeadIds.size]);

  const exitMultiSelect = useCallback(() => {
    setMultiSelectMode(false);
    setSelectedLeadIds(new Set());
  }, []);

  const handleBulkDelete = async () => {
    if (selectedLeadIds.size === 0) return;
    const confirmed = window.confirm(`האם למחוק ${selectedLeadIds.size} לידים?`);
    if (!confirmed) return;
    setBulkActionLoading(true);
    try {
      const { error } = await supabase.from("leads").delete().in("id", Array.from(selectedLeadIds));
      if (error) throw error;
      toast.success(`${selectedLeadIds.size} לידים נמחקו בהצלחה`);
      if (selectedLeadIds.has(selectedLeadId || "")) {
        setSelectedLeadId(null);
      }
      exitMultiSelect();
      queryClient.invalidateQueries({ queryKey: ["leads-table"] });
      queryClient.invalidateQueries({ queryKey: ["leads-kanban"] });
      queryClient.invalidateQueries({ queryKey: ["leads-count"] });
    } catch (error: any) {
      toast.error("שגיאה במחיקה: " + error.message);
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkStageChange = async (stageId: string) => {
    if (selectedLeadIds.size === 0) return;
    setBulkActionLoading(true);
    try {
      const { error } = await supabase.from("leads").update({ status: stageId }).in("id", Array.from(selectedLeadIds));
      if (error) throw error;
      toast.success(`${selectedLeadIds.size} לידים עודכנו`);
      exitMultiSelect();
      queryClient.invalidateQueries({ queryKey: ["leads-table"] });
      queryClient.invalidateQueries({ queryKey: ["leads-kanban"] });
      queryClient.invalidateQueries({ queryKey: ["leads-count"] });
    } catch (error: any) {
      toast.error("שגיאה בעדכון: " + error.message);
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkResponseStatusChange = async (statusKey: string | null) => {
    if (selectedLeadIds.size === 0) return;
    setBulkActionLoading(true);
    try {
      const { error } = await supabase.from("leads").update({ response_status: statusKey }).in("id", Array.from(selectedLeadIds));
      if (error) throw error;
      toast.success(`${selectedLeadIds.size} לידים עודכנו`);
      exitMultiSelect();
      queryClient.invalidateQueries({ queryKey: ["leads-table"] });
      queryClient.invalidateQueries({ queryKey: ["leads-kanban"] });
      queryClient.invalidateQueries({ queryKey: ["leads-count"] });
    } catch (error: any) {
      toast.error("שגיאה בעדכון: " + error.message);
    } finally {
      setBulkActionLoading(false);
    }
  };

  const getStageInfo = (statusKey: string) => pipelineStages.find(s => s.id === statusKey);
  const getLeadStatusInfo = (statusKey: string) => leadStatuses.find(s => s.status_key === statusKey);

  return (
    <div className="flex h-[calc(100vh-220px)] border rounded-lg overflow-hidden bg-background" dir="rtl">
      {/* Right side - Lead list (25%) */}
      <div className="w-[25%] min-w-[240px] border-s flex flex-col bg-muted/20">
        {/* List header with search */}
        <div className="p-3 border-b bg-background/80 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="חיפוש ליד..."
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
            {filteredListLeads.length} לידים
          </div>
        </div>

        {/* Multi-select toolbar */}
        {multiSelectMode && (
          <div className="p-2 border-b bg-primary/5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={toggleSelectAll}>
                {selectedLeadIds.size === filteredListLeads.length ? "בטל הכל" : "בחר הכל"}
              </Button>
              <span className="text-xs font-medium text-muted-foreground">
                {selectedLeadIds.size} נבחרו
              </span>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={exitMultiSelect}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            {selectedLeadIds.size > 0 && (
              <div className="flex items-center gap-1 flex-wrap">
                {/* Bulk stage change */}
                <Select onValueChange={handleBulkStageChange} disabled={bulkActionLoading}>
                  <SelectTrigger className="h-7 text-[11px] w-auto min-w-[80px]">
                    <SelectValue placeholder="שלב" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-[100]">
                    {pipelineStages.map((stage) => (
                      <SelectItem key={stage.id} value={stage.id} style={{ backgroundColor: stage.hexColor, color: "#fff" }}>
                        {stage.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Bulk response status */}
                <Select onValueChange={(v) => handleBulkResponseStatusChange(v === "none" ? null : v)} disabled={bulkActionLoading}>
                  <SelectTrigger className="h-7 text-[11px] w-auto min-w-[80px]">
                    <SelectValue placeholder="סטטוס" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-[100]">
                    <SelectItem value="none">ללא סטטוס</SelectItem>
                    {leadStatuses.map((s) => (
                      <SelectItem key={s.status_key} value={s.status_key} style={{ backgroundColor: s.color, color: "#fff" }}>
                        {s.label}
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

        {/* Lead list */}
        <ScrollArea className="flex-1">
          <div className="divide-y">
            {filteredListLeads.map((lead) => {
              const isSelected = lead.id === selectedLeadId;
              const isChecked = selectedLeadIds.has(lead.id);
              const stageInfo = getStageInfo(lead.status);
              const statusInfo = getLeadStatusInfo(lead.response_status);
              const tagIds = leadsTagsMap[lead.id] || [];

              return (
                <button
                  key={lead.id}
                  onClick={() => {
                    if (multiSelectMode) {
                      toggleLeadSelection(lead.id);
                    } else {
                      setSelectedLeadId(lead.id);
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
                    {/* Checkbox in multi-select mode */}
                    {multiSelectMode && (
                      <div className="pt-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => toggleLeadSelection(lead.id)}
                        />
                      </div>
                    )}
                    {/* Avatar circle */}
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                      style={{ backgroundColor: stageInfo?.hexColor || "hsl(var(--primary))" }}
                    >
                      {(lead.contact_name || "?")[0]}
                    </div>
                    <div className="flex-1 min-w-0 text-right">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {lead.created_at && format(new Date(lead.created_at), "dd/MM", { locale: he })}
                        </span>
                        <span className="font-semibold text-sm truncate">
                          {lead.contact_name || "ללא שם"}
                        </span>
                      </div>
                      {isCompanyNameVisible && lead.company_name && (
                        <p className="text-xs text-muted-foreground truncate">{lead.company_name}</p>
                      )}
                      <div className="flex items-center gap-1 mt-1 flex-wrap justify-end">
                        {stageInfo && (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 h-4 border-0 text-white"
                            style={{ backgroundColor: stageInfo.hexColor }}
                          >
                            {stageInfo.label}
                          </Badge>
                        )}
                        {statusInfo && (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 h-4 border-0 text-white"
                            style={{ backgroundColor: statusInfo.color }}
                          >
                            {statusInfo.label}
                          </Badge>
                        )}
                      </div>
                      {tagIds.length > 0 && (
                        <div className="mt-1">
                          <LeadTagBadges allTags={allTags} tagIds={tagIds} />
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
            {filteredListLeads.length === 0 && (
              <div className="p-8 text-center text-muted-foreground text-sm">
                לא נמצאו לידים
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Left side - Lead detail panel (75%) */}
      <div className="flex-1 flex flex-col">
        {selectedLead ? (
          <>
            {/* Toolbar */}
            <div className="flex items-center gap-2 p-3 border-b bg-background/95 backdrop-blur-sm flex-wrap">
              {/* Lead name & company */}
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                  style={{ backgroundColor: getStageInfo(selectedLead.status)?.hexColor || "hsl(var(--primary))" }}
                >
                  {(selectedLead.contact_name || "?")[0]}
                </div>
                <div className="min-w-0">
                  <h2 className="font-bold text-base truncate">{selectedLead.contact_name || "ללא שם"}</h2>
                  {isCompanyNameVisible && selectedLead.company_name && (
                    <p className="text-xs text-muted-foreground truncate">{selectedLead.company_name}</p>
                  )}
                </div>
              </div>

              {/* Quick actions */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {/* Pipeline stage */}
                <Select
                  value={selectedLead.status}
                  onValueChange={(value) => onStatusChange(selectedLead.id, value)}
                >
                  <SelectTrigger
                    className="h-8 text-xs w-auto min-w-[100px] border-2 font-medium"
                    style={{
                      backgroundColor: getStageInfo(selectedLead.status)?.hexColor,
                      color: "#fff",
                    }}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-[100]">
                    {pipelineStages.map((stage) => (
                      <SelectItem key={stage.id} value={stage.id} style={{ backgroundColor: stage.hexColor, color: "#fff" }}>
                        {stage.label}
                      </SelectItem>
                    ))}
                    <div className="border-t mt-1 pt-1">
                      <button
                        type="button"
                        className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-muted rounded cursor-pointer"
                        onClick={() => setManageStagesOpen(true)}
                      >
                        <Settings2 className="h-4 w-4" />
                        ניהול שלבים
                      </button>
                    </div>
                  </SelectContent>
                </Select>

                {/* Response status */}
                <Select
                  value={selectedLead.response_status || "none"}
                  onValueChange={(value) => onResponseStatusChange(selectedLead.id, value === "none" ? null : value)}
                >
                  <SelectTrigger
                    className="h-8 text-xs w-auto min-w-[100px] border-2 font-medium"
                    style={{
                      backgroundColor: getStatusColor(selectedLead.response_status, leadStatuses) || undefined,
                      color: getStatusColor(selectedLead.response_status, leadStatuses) ? "#fff" : undefined,
                    }}
                  >
                    <SelectValue placeholder="סטטוס" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-[100]">
                    <SelectItem value="none">ללא סטטוס</SelectItem>
                    {leadStatuses.map((s) => (
                      <SelectItem key={s.status_key} value={s.status_key} style={{ backgroundColor: s.color, color: "#fff" }}>
                        {s.label}
                      </SelectItem>
                    ))}
                    <div className="border-t mt-1 pt-1">
                      <button
                        type="button"
                        className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-muted rounded cursor-pointer"
                        onClick={() => setManageStatusesOpen(true)}
                      >
                        <Settings2 className="h-4 w-4" />
                        ניהול סטטוסים
                      </button>
                    </div>
                  </SelectContent>
                </Select>

                <LeadTagSelector leadId={selectedLead.id} initialTagIds={selectedLeadTagIds} />

                <FollowUpDatePicker
                  leadId={selectedLead.id}
                  currentDate={selectedLead.follow_up_date}
                  onOptimisticUpdate={onFollowUpDateUpdate}
                />

                {selectedLead.phone && (
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
                      <a href={`tel:${selectedLead.phone}`}>
                        <Phone className="h-3.5 w-3.5" />
                        {selectedLead.phone}
                      </a>
                    </Button>
                  </>
                )}

                {selectedLead.email && (
                  <Button variant="outline" size="sm" className="h-8 gap-1" asChild>
                    <a href={`mailto:${selectedLead.email}`}>
                      <Mail className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                )}

                <EditLeadDialog lead={selectedLead} open={editDialogOpen} onOpenChange={setEditDialogOpen} />

                <AddTaskForm
                  leadId={selectedLead.id}
                  agencyId={selectedLead.agency_id || undefined}
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
                  onClick={() => handleDelete(selectedLead.id)}
                  title="מחק ליד"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Tags bar */}
            {selectedLeadTagIds.length > 0 && (
              <div className="px-4 py-2 border-b bg-muted/20 flex items-center gap-2">
                <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                <LeadTagBadgesEditable
                  leadId={selectedLead.id}
                  allTags={allTags}
                  tagIds={selectedLeadTagIds}
                />
              </div>
            )}

            {/* Detail tabs content */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="mx-4 mt-3 grid grid-cols-4 w-auto max-w-xl h-9 bg-muted/50 mr-4 ml-auto">
                <TabsTrigger value="details" className="text-xs gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  פרטי ליד
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
                  {/* Info cards grid */}
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Contact info */}
                    <div className="border rounded-lg p-4 space-y-3 text-right">
                      <h3 className="font-semibold text-sm flex items-center gap-2 justify-end">
                        פרטי קשר
                        <User className="h-4 w-4 text-primary" />
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-end gap-2">
                          <span className="font-medium">{selectedLead.contact_name || "—"}</span>
                          <span className="text-muted-foreground">:שם</span>
                        </div>
                        {isCompanyNameVisible && (
                          <div className="flex items-center justify-end gap-2">
                            <span className="font-medium">{selectedLead.company_name || "—"}</span>
                            <span className="text-muted-foreground">:חברה</span>
                          </div>
                        )}
                        <div className="flex items-center justify-end gap-2">
                          {selectedLead.phone ? (
                            <a href={`tel:${selectedLead.phone}`} className="font-medium text-primary hover:underline">
                              {selectedLead.phone}
                            </a>
                          ) : (
                            <span>—</span>
                          )}
                          <span className="text-muted-foreground">:טלפון</span>
                        </div>
                        <div className="flex items-center justify-end gap-2">
                          {selectedLead.email ? (
                            <a href={`mailto:${selectedLead.email}`} className="font-medium text-primary hover:underline truncate">
                              {selectedLead.email}
                            </a>
                          ) : (
                            <span>—</span>
                          )}
                          <span className="text-muted-foreground">:אימייל</span>
                        </div>
                      </div>
                    </div>

                    {/* Deal info */}
                    <div className="border rounded-lg p-4 space-y-3 text-right">
                      <h3 className="font-semibold text-sm flex items-center gap-2 justify-end">
                        מידע עסקי
                        <DollarSign className="h-4 w-4 text-primary" />
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-end gap-2">
                          <span className="font-medium">
                            {selectedLead.estimated_deal_value
                              ? `₪${Number(selectedLead.estimated_deal_value).toLocaleString()}`
                              : "—"}
                          </span>
                          <span className="text-muted-foreground">:ערך עסקה</span>
                        </div>
                        <div className="flex items-center justify-end gap-2">
                          <span className="font-medium">
                            {selectedLead.monthly_budget
                              ? `₪${Number(selectedLead.monthly_budget).toLocaleString()}`
                              : "—"}
                          </span>
                          <span className="text-muted-foreground">:תקציב חודשי</span>
                        </div>
                        <div className="flex items-center justify-end gap-2">
                          <span className="font-medium">{selectedLead.source || "—"}</span>
                          <span className="text-muted-foreground">:מקור</span>
                        </div>
                        <div className="flex items-center justify-end gap-2">
                          <span className="font-medium">{selectedLead.industry || "—"}</span>
                          <span className="text-muted-foreground">:תעשייה</span>
                        </div>
                      </div>
                    </div>

                    {/* Dates & timeline */}
                    <div className="border rounded-lg p-4 space-y-3 text-right">
                      <h3 className="font-semibold text-sm flex items-center gap-2 justify-end">
                        ציר זמן
                        <Clock className="h-4 w-4 text-primary" />
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-end gap-2">
                          <span className="font-medium">
                            {selectedLead.created_at
                              ? format(new Date(selectedLead.created_at), "dd/MM/yyyy HH:mm", { locale: he })
                              : "—"}
                          </span>
                          <span className="text-muted-foreground">:נוצר</span>
                        </div>
                        {selectedLead.proposal_date && (
                          <div className="flex items-center justify-end gap-2">
                            <span className="font-medium">
                              {format(new Date(selectedLead.proposal_date), "dd/MM/yyyy", { locale: he })}
                            </span>
                            <span className="text-muted-foreground">:הצעת מחיר</span>
                          </div>
                        )}
                        {selectedLead.sale_date && (
                          <div className="flex items-center justify-end gap-2">
                            <span className="font-medium">
                              {format(new Date(selectedLead.sale_date), "dd/MM/yyyy", { locale: he })}
                            </span>
                            <span className="text-muted-foreground">:תאריך מכירה</span>
                          </div>
                        )}
                        {selectedLead.follow_up_date && (
                          <div className="flex items-center justify-end gap-2">
                            <span className="font-medium">
                              {format(new Date(selectedLead.follow_up_date), "dd/MM/yyyy", { locale: he })}
                            </span>
                            <span className="text-muted-foreground">:מעקב</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  {selectedLead.notes && (
                    <div className="border rounded-lg p-4 text-right">
                      <h3 className="font-semibold text-sm mb-2">הערות</h3>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap text-right" dir="rtl">{selectedLead.notes}</p>
                    </div>
                  )}

                  {/* Products */}
                  {selectedLead.products && (() => {
                    try {
                      const parsed = JSON.parse(selectedLead.products);
                      const ids = Array.isArray(parsed) ? parsed : [parsed];
                      const items = ids.map((id: string) => productsLookup[id]).filter(Boolean);
                      if (items.length === 0) return null;
                      return (
                        <div className="border rounded-lg p-4">
                          <h3 className="font-semibold text-sm mb-2">מוצרים / שירותים</h3>
                          <div className="flex flex-wrap gap-2">
                            {items.map((p: any, i: number) => (
                              <Badge key={i} variant="secondary">
                                {p.name} {p.price > 0 && `- ₪${p.price.toLocaleString()}`}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      );
                    } catch {
                      return null;
                    }
                  })()}
                </TabsContent>

                <TabsContent value="updates" className="mt-0">
                  <LeadUpdatesTab leadId={selectedLead.id} leadName={selectedLead.contact_name || selectedLead.company_name || "ליד"} />
                </TabsContent>
              </ScrollArea>

              {activeTab === "whatsapp" && (
                <div className="flex-1 min-h-0">
                  {selectedLead.phone ? (
                    <ChatViewComponent
                      contactId={selectedLead.id}
                      contactType="lead"
                      senderPhone={selectedLead.phone}
                      contactName={selectedLead.contact_name || selectedLead.company_name || "ליד"}
                    />
                  ) : (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      אין מספר טלפון לליד זה
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
              <p>בחר ליד מהרשימה לצפייה בפרטים</p>
            </div>
          </div>
        )}
      </div>

      {/* Management dialogs */}
      <ManagePipelineStagesDialog open={manageStagesOpen} onOpenChange={setManageStagesOpen} showTrigger={false} />
      <ManageLeadStatusesDialog open={manageStatusesOpen} onOpenChange={setManageStatusesOpen} showTrigger={false} />
    </div>
  );
}