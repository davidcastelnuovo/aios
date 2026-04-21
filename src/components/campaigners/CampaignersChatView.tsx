import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Megaphone, Phone, Mail, Briefcase, Search, Users, ListChecks, Calendar as CalendarIcon, Building2, Pencil, Check, X } from "lucide-react";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useAgency } from "@/contexts/AgencyContext";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { EditCampaignerDialog } from "@/components/forms/EditCampaignerDialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CampaignerTasksTab } from "./CampaignerTasksTab";
import { CampaignerMeetingTab } from "./CampaignerMeetingTab";
import { toast } from "sonner";

type ActiveFilter = "active" | "inactive" | "all";

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
}

export function CampaignersChatView() {
  const { tenantId } = useCurrentTenant();
  const { selectedAgency } = useAgency();
  const { canViewFinance } = useUserPermissions();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const { data: agenciesList } = useQuery({
    queryKey: ["agencies-for-campaigners", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("agencies")
        .select("id, name")
        .eq("tenant_id", tenantId)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const refetchCampaigners = () =>
    queryClient.invalidateQueries({ queryKey: ["campaigners", tenantId] });

  const updateCampaignerField = async (id: string, patch: Record<string, any>) => {
    const { error } = await supabase.from("campaigners").update(patch).eq("id", id);
    if (error) {
      toast.error("שגיאה בעדכון");
      return false;
    }

    // סנכרון full_name חזרה לפרופיל המקושר רק אם הפרופיל ריק (לא דורסים אימייל)
    if (patch.full_name) {
      const { data: linkedProfile } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("campaigner_id", id)
        .maybeSingle();
      if (linkedProfile && (!linkedProfile.full_name || linkedProfile.full_name === "")) {
        await supabase
          .from("profiles")
          .update({ full_name: patch.full_name })
          .eq("id", linkedProfile.id);
        queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      }
    }

    toast.success("עודכן");
    refetchCampaigners();
    return true;
  };

  const updateCampaignerAgencies = async (campaignerId: string, agencyIds: string[]) => {
    const { error: delErr } = await supabase
      .from("campaigner_agencies")
      .delete()
      .eq("campaigner_id", campaignerId);
    if (delErr) {
      toast.error("שגיאה בעדכון סוכנויות");
      return;
    }
    if (agencyIds.length > 0) {
      const { error: insErr } = await supabase
        .from("campaigner_agencies")
        .insert(agencyIds.map((agency_id) => ({ campaigner_id: campaignerId, agency_id })));
      if (insErr) {
        toast.error("שגיאה בשמירת סוכנויות");
        return;
      }
    }
    toast.success("עודכן");
    refetchCampaigners();
  };


  const { data: campaigners, isLoading } = useQuery({
    queryKey: ["campaigners", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("campaigners")
        .select(`
          *,
          campaigner_agencies(agency_id, agencies(id, name)),
          client_team(
            id,
            role_on_account,
            allocation_percent,
            campaigner_payment,
            clients(id, name, status, agency_id)
          )
        `)
        .eq("tenant_id", tenantId)
        .order("full_name", { ascending: true });
      if (error) throw error;

      return (data || []).map((c: any) => ({
        ...c,
        client_team: (c.client_team || []).filter((ct: any) => ct.clients),
      }));
    },
    enabled: !!tenantId,
  });

  const filteredCampaigners = useMemo(() => {
    if (!campaigners) return [];
    let list = campaigners;

    if (selectedAgency && selectedAgency !== "all") {
      list = list.filter((c: any) =>
        c.campaigner_agencies?.some((ca: any) => ca.agency_id === selectedAgency)
      );
    }

    if (activeFilter === "active") list = list.filter((c: any) => c.active);
    else if (activeFilter === "inactive") list = list.filter((c: any) => !c.active);

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((c: any) =>
        [c.full_name, c.phone, c.email].filter(Boolean).some((v: string) => v.toLowerCase().includes(q))
      );
    }
    return list;
  }, [campaigners, selectedAgency, activeFilter, search]);

  const selected = useMemo(
    () => filteredCampaigners.find((c: any) => c.id === selectedId) || filteredCampaigners[0] || null,
    [filteredCampaigners, selectedId]
  );

  const calculateTotal = (c: any) =>
    (c?.client_team || []).reduce((t: number, a: any) => t + (a.campaigner_payment || 0), 0);

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4 min-w-0" dir="rtl">
      {/* Right column - list */}
      <aside className="w-[320px] shrink-0 border rounded-lg bg-card flex flex-col overflow-hidden min-w-0">
        <div className="p-3 border-b space-y-2">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="חיפוש לפי שם, טלפון או אימייל"
              className="pr-9"
            />
          </div>
          <Select value={activeFilter} onValueChange={(v) => setActiveFilter(v as ActiveFilter)}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-background z-50">
              <SelectItem value="active">פעילים</SelectItem>
              <SelectItem value="inactive">לא פעילים</SelectItem>
              <SelectItem value="all">הכל</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="p-4 text-sm text-muted-foreground text-center">טוען...</div>
          ) : filteredCampaigners.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground text-center">לא נמצאו אנשי צוות</div>
          ) : (
            <ul className="divide-y">
              {filteredCampaigners.map((c: any) => {
                const isSelected = selected?.id === c.id;
                const agencyNames = (c.campaigner_agencies || [])
                  .map((ca: any) => ca?.agencies?.name)
                  .filter(Boolean)
                  .join(", ");
                return (
                  <li key={c.id} className="min-w-0">
                    <button
                      onClick={() => setSelectedId(c.id)}
                      className={`w-full text-right px-3 py-3 flex items-start gap-3 hover:bg-muted/50 transition-colors min-w-0 ${
                        isSelected ? "bg-muted" : ""
                      }`}
                    >
                      <Avatar className="h-10 w-10 shrink-0">
                        <AvatarFallback className={c.active ? "bg-success/10 text-success" : "bg-muted"}>
                          {getInitials(c.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <div className="font-medium truncate">{c.full_name}</div>
                        {c.role && c.role.length > 0 && (
                          <div className="text-xs text-muted-foreground truncate">{c.role.join(", ")}</div>
                        )}
                        {agencyNames && (
                          <div className="text-xs text-muted-foreground truncate">{agencyNames}</div>
                        )}
                        <div className="text-xs text-muted-foreground mt-0.5 truncate">
                          לקוחות משויכים: {c.client_team?.length || 0}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </aside>

      {/* Left column - details */}
      <section className="flex-1 border rounded-lg bg-card flex flex-col overflow-hidden">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            בחר איש צוות מהרשימה
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="p-4 border-b flex items-start justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar className="h-12 w-12">
                  <AvatarFallback className={selected.active ? "bg-success/10 text-success" : "bg-muted"}>
                    {getInitials(selected.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <h2 className="text-xl font-bold truncate">{selected.full_name}</h2>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    {selected.role && selected.role.length > 0 && (
                      <span className="flex items-center gap-1">
                        <Briefcase className="h-3.5 w-3.5" />
                        {selected.role.join(", ")}
                      </span>
                    )}
                    {selected.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3.5 w-3.5" />
                        <span dir="ltr">{selected.phone}</span>
                      </span>
                    )}
                    {selected.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="h-3.5 w-3.5" />
                        {selected.email}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                  ערוך פרטים
                </Button>
              </div>
            </div>

            {/* Tabs */}
            <Tabs dir="rtl" defaultValue="details" className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="mr-4 mt-3 w-fit">
                <TabsTrigger value="details" className="gap-1.5">
                  <Megaphone className="h-4 w-4" /> פרטים
                </TabsTrigger>
                <TabsTrigger value="clients" className="gap-1.5">
                  <Users className="h-4 w-4" /> לקוחות משויכים
                </TabsTrigger>
                <TabsTrigger value="tasks" className="gap-1.5">
                  <ListChecks className="h-4 w-4" /> משימות
                </TabsTrigger>
                <TabsTrigger value="meetings" className="gap-1.5">
                  <CalendarIcon className="h-4 w-4" /> פגישות
                </TabsTrigger>
              </TabsList>

              <div className="flex-1 overflow-y-auto p-4">
                <TabsContent value="details" className="mt-0 space-y-4">
                  <div className="bg-card border border-border/60 rounded-xl p-4 space-y-3 text-right shadow-sm">
                    <h3 className="font-semibold text-sm flex items-center gap-2 justify-end text-foreground">
                      פרטי איש צוות
                      <Megaphone className="h-4 w-4 text-primary" />
                    </h3>
                    <div className="space-y-2 text-sm">
                      <EditableRow
                        label=":טלפון"
                        value={selected.phone}
                        isLink
                        linkPrefix="tel:"
                        onSave={(v) => updateCampaignerField(selected.id, { phone: v || null })}
                      />
                      <EditableRow
                        label=":אימייל"
                        value={selected.email}
                        isLink
                        linkPrefix="mailto:"
                        onSave={(v) => updateCampaignerField(selected.id, { email: v || null })}
                      />
                      <EditableRow
                        label=":תפקיד"
                        value={selected.role && selected.role.length > 0 ? selected.role.join(", ") : ""}
                        placeholder="הפרד בפסיקים"
                        onSave={(v) =>
                          updateCampaignerField(selected.id, {
                            role: v ? v.split(",").map((s) => s.trim()).filter(Boolean) : null,
                          })
                        }
                      />
                      <AgenciesRow
                        currentAgencyIds={(selected.campaigner_agencies || []).map((ca: any) => ca.agency_id)}
                        currentLabels={
                          (selected.campaigner_agencies || [])
                            .map((ca: any) => ca?.agencies?.name)
                            .filter(Boolean)
                            .join(", ") || ""
                        }
                        allAgencies={agenciesList || []}
                        onSave={(ids) => updateCampaignerAgencies(selected.id, ids)}
                      />
                    </div>
                  </div>

                  <div className="bg-card border border-border/60 rounded-xl p-4 space-y-2 text-right shadow-sm">
                    <h3 className="font-semibold text-sm flex items-center gap-2 justify-end text-foreground">
                      הערות
                      <Pencil className="h-4 w-4 text-primary" />
                    </h3>
                    <EditableRow
                      label=""
                      value={selected.notes}
                      type="textarea"
                      onSave={(v) => updateCampaignerField(selected.id, { notes: v || null })}
                    />
                  </div>

                  <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                    ערוך פרטים מלאים
                  </Button>
                </TabsContent>


                <TabsContent value="clients" className="mt-0">
                  {selected.client_team && selected.client_team.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-right">שם לקוח</TableHead>
                            {canViewFinance() && <TableHead className="text-right">סכום</TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selected.client_team.map((assignment: any) => (
                            <TableRow key={assignment.id}>
                              <TableCell className="font-medium">{assignment.clients?.name ?? "—"}</TableCell>
                              {canViewFinance() && (
                                <TableCell>
                                  {(assignment.campaigner_payment || 0).toLocaleString("he-IL")} ₪
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                          {canViewFinance() && (
                            <TableRow className="font-semibold bg-muted/50">
                              <TableCell>סה"כ</TableCell>
                              <TableCell>{calculateTotal(selected).toLocaleString("he-IL")} ₪</TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground text-center py-8">
                      אין לקוחות פעילים משויכים
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="tasks" className="mt-0">
                  <CampaignerTasksTab campaignerId={selected.id} campaignerName={selected.full_name} />
                </TabsContent>

                <TabsContent value="meetings" className="mt-0">
                  <CampaignerMeetingTab
                    campaigner={{
                      id: selected.id,
                      full_name: selected.full_name,
                      email: selected.email,
                    }}
                    tenantId={tenantId || undefined}
                  />
                </TabsContent>
              </div>
            </Tabs>

            {/* Edit dialog (controlled) */}
            <EditCampaignerDialog
              campaigner={selected}
              open={editOpen}
              onOpenChange={setEditOpen}
            />
          </>
        )}
      </section>
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
  dir,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | null | undefined;
  dir?: string;
}) {
  return (
    <div className="p-3 rounded-md bg-muted/30 border">
      <div className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="text-sm font-medium" dir={dir}>
        {value || <span className="text-muted-foreground font-normal">—</span>}
      </div>
    </div>
  );
}

function EditableRow({
  label,
  value,
  type = "text",
  placeholder,
  isLink,
  linkPrefix,
  onSave,
}: {
  label: string;
  value: string | null | undefined;
  type?: "text" | "email" | "number" | "textarea";
  placeholder?: string;
  isLink?: boolean;
  linkPrefix?: string;
  onSave: (v: string) => void | Promise<any>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || "");

  useEffect(() => {
    setDraft(value || "");
  }, [value, editing]);

  const commit = async () => {
    if ((draft || "") !== (value || "")) await onSave(draft);
    setEditing(false);
  };

  const cancel = () => {
    setDraft(value || "");
    setEditing(false);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && type !== "textarea") commit();
    if (e.key === "Escape") cancel();
  };

  if (editing) {
    return (
      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={commit}>
          <Check className="h-3 w-3 text-primary" />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={cancel}>
          <X className="h-3 w-3 text-muted-foreground" />
        </Button>
        {type === "textarea" ? (
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKey}
            className="text-sm h-20 text-right"
            dir="rtl"
            autoFocus
          />
        ) : (
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKey}
            type={type === "number" ? "number" : type === "email" ? "email" : "text"}
            placeholder={placeholder}
            className="text-sm h-7 text-right"
            dir="rtl"
            autoFocus
          />
        )}
        {label && <span className="text-muted-foreground text-sm shrink-0">{label}</span>}
      </div>
    );
  }

  return (
    <div
      className="flex items-center justify-end gap-2 group cursor-pointer"
      onClick={() => setEditing(true)}
    >
      <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
      {isLink && value ? (
        <a
          href={`${linkPrefix || ""}${value}`}
          target={linkPrefix?.startsWith("http") || linkPrefix === undefined ? "_blank" : undefined}
          rel="noreferrer"
          className="font-medium text-primary hover:underline truncate"
          onClick={(e) => e.stopPropagation()}
        >
          {value}
        </a>
      ) : (
        <span className="font-medium whitespace-pre-wrap">
          {value || <span className="text-muted-foreground font-normal">—</span>}
        </span>
      )}
      {label && <span className="text-muted-foreground text-sm shrink-0">{label}</span>}
    </div>
  );
}

function AgenciesRow({
  currentAgencyIds,
  currentLabels,
  allAgencies,
  onSave,
}: {
  currentAgencyIds: string[];
  currentLabels: string;
  allAgencies: { id: string; name: string }[];
  onSave: (ids: string[]) => void | Promise<any>;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(currentAgencyIds);

  useEffect(() => {
    setSelected(currentAgencyIds);
  }, [currentAgencyIds.join(",")]);

  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const commit = async () => {
    const a = [...selected].sort().join(",");
    const b = [...currentAgencyIds].sort().join(",");
    if (a !== b) await onSave(selected);
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        if (!o) commit();
        else setOpen(true);
      }}
    >
      <PopoverTrigger asChild>
        <div className="flex items-center justify-end gap-2 group cursor-pointer">
          <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          <span className="font-medium truncate">
            {currentLabels || <span className="text-muted-foreground font-normal">—</span>}
          </span>
          <span className="text-muted-foreground text-sm shrink-0">:סוכנויות</span>
        </div>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-2 max-h-72 overflow-y-auto" dir="rtl">
        {allAgencies.length === 0 ? (
          <div className="text-sm text-muted-foreground p-2">אין סוכנויות</div>
        ) : (
          allAgencies.map((a) => (
            <label
              key={a.id}
              className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer text-sm"
            >
              <Checkbox
                checked={selected.includes(a.id)}
                onCheckedChange={() => toggle(a.id)}
              />
              <span className="truncate">{a.name}</span>
            </label>
          ))
        )}
      </PopoverContent>
    </Popover>
  );
}


