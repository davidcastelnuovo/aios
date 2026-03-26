import { useState, useMemo } from "react";
import { User, Phone, Building2, Clock, Search, Tag, Mail, ExternalLink, CheckSquare, Trash2, Settings2, MessageSquare, FileText, DollarSign, Paperclip, Users, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
      // Select next lead
      const idx = leads.findIndex(l => l.id === id);
      const next = leads[idx + 1] || leads[idx - 1] || null;
      setSelectedLeadId(next?.id || null);
    } catch (error: any) {
      toast.error("שגיאה במחיקת ליד: " + error.message);
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
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="חיפוש ליד..."
              value={listSearch}
              onChange={(e) => setListSearch(e.target.value)}
              className="pr-9 h-9 text-sm"
            />
          </div>
          <div className="mt-2 text-xs text-muted-foreground text-center">
            {filteredListLeads.length} לידים
          </div>
        </div>

        {/* Lead list */}
        <ScrollArea className="flex-1">
          <div className="divide-y">
            {filteredListLeads.map((lead) => {
              const isSelected = lead.id === selectedLeadId;
              const stageInfo = getStageInfo(lead.status);
              const statusInfo = getLeadStatusInfo(lead.response_status);
              const tagIds = leadsTagsMap[lead.id] || [];

              return (
                <button
                  key={lead.id}
                  onClick={() => {
                    setSelectedLeadId(lead.id);
                    setActiveTab("details");
                  }}
                  className={cn(
                    "w-full text-right p-3 hover:bg-muted/50 transition-colors cursor-pointer",
                    isSelected && "bg-primary/10 border-e-4 border-e-primary"
                  )}
                >
                  <div className="flex items-start gap-2">
                    {/* Avatar circle */}
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                      style={{ backgroundColor: stageInfo?.hexColor || "hsl(var(--primary))" }}
                    >
                      {(lead.contact_name || "?")[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-semibold text-sm truncate">
                          {lead.contact_name || "ללא שם"}
                        </span>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {lead.created_at && format(new Date(lead.created_at), "dd/MM", { locale: he })}
                        </span>
                      </div>
                      {isCompanyNameVisible && lead.company_name && (
                        <p className="text-xs text-muted-foreground truncate">{lead.company_name}</p>
                      )}
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
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
                  <Button variant="outline" size="sm" className="h-8 gap-1" asChild>
                    <a href={`tel:${selectedLead.phone}`}>
                      <Phone className="h-3.5 w-3.5" />
                      {selectedLead.phone}
                    </a>
                  </Button>
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
              <TabsList className="mx-4 mt-3 grid grid-cols-2 w-auto max-w-md h-9 bg-muted/50">
                <TabsTrigger value="details" className="text-xs gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  פרטי ליד
                </TabsTrigger>
                <TabsTrigger value="updates" className="text-xs gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5" />
                  משימות ועדכונים
                </TabsTrigger>
              </TabsList>

              <ScrollArea className="flex-1 p-4">
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
                    <div className="border rounded-lg p-4 space-y-3">
                      <h3 className="font-semibold text-sm flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-primary" />
                        מידע עסקי
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground min-w-[80px]">ערך עסקה:</span>
                          <span className="font-medium">
                            {selectedLead.estimated_deal_value
                              ? `₪${Number(selectedLead.estimated_deal_value).toLocaleString()}`
                              : "—"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground min-w-[80px]">תקציב חודשי:</span>
                          <span className="font-medium">
                            {selectedLead.monthly_budget
                              ? `₪${Number(selectedLead.monthly_budget).toLocaleString()}`
                              : "—"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground min-w-[80px]">מקור:</span>
                          <span className="font-medium">{selectedLead.source || "—"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground min-w-[80px]">תעשייה:</span>
                          <span className="font-medium">{selectedLead.industry || "—"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Dates & timeline */}
                    <div className="border rounded-lg p-4 space-y-3">
                      <h3 className="font-semibold text-sm flex items-center gap-2">
                        <Clock className="h-4 w-4 text-primary" />
                        ציר זמן
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground min-w-[80px]">נוצר:</span>
                          <span className="font-medium">
                            {selectedLead.created_at
                              ? format(new Date(selectedLead.created_at), "dd/MM/yyyy HH:mm", { locale: he })
                              : "—"}
                          </span>
                        </div>
                        {selectedLead.proposal_date && (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground min-w-[80px]">הצעת מחיר:</span>
                            <span className="font-medium">
                              {format(new Date(selectedLead.proposal_date), "dd/MM/yyyy", { locale: he })}
                            </span>
                          </div>
                        )}
                        {selectedLead.sale_date && (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground min-w-[80px]">תאריך מכירה:</span>
                            <span className="font-medium">
                              {format(new Date(selectedLead.sale_date), "dd/MM/yyyy", { locale: he })}
                            </span>
                          </div>
                        )}
                        {selectedLead.follow_up_date && (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground min-w-[80px]">מעקב:</span>
                            <span className="font-medium">
                              {format(new Date(selectedLead.follow_up_date), "dd/MM/yyyy", { locale: he })}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  {selectedLead.notes && (
                    <div className="border rounded-lg p-4">
                      <h3 className="font-semibold text-sm mb-2">הערות</h3>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedLead.notes}</p>
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