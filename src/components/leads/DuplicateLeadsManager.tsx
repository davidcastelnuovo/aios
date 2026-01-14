import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, Phone, Mail, Users, Loader2, AlertTriangle, ChevronDown, ChevronUp, ExternalLink, Trash2 } from "lucide-react";
import { MergeLeadsDialog } from "./MergeLeadsDialog";
import { format } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DuplicateGroup {
  key: string;
  type: "phone" | "email";
  value: string;
  leads: any[];
}

export function DuplicateLeadsManager() {
  const [open, setOpen] = useState(false);
  const [filterType, setFilterType] = useState<"all" | "phone" | "email">("all");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<DuplicateGroup | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<DuplicateGroup | null>(null);
  
  const { tenant } = useCurrentTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all leads to find duplicates
  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads-for-duplicates", tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      
      const { data, error } = await supabase
        .from("leads")
        .select(`
          id,
          company_name,
          contact_name,
          phone,
          email,
          status,
          response_status,
          notes,
          created_at,
          updated_at,
          agency_id,
          source,
          campaign_name,
          monthly_budget,
          meeting_date,
          meeting_time,
          agencies(name)
        `)
        .eq("tenant_id", tenant.id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: open && !!tenant?.id,
  });

  // Find duplicate groups
  const duplicateGroups = useMemo(() => {
    const phoneMap = new Map<string, any[]>();
    const emailMap = new Map<string, any[]>();

    leads.forEach((lead) => {
      // Normalize phone - remove spaces, dashes, etc.
      if (lead.phone) {
        const normalizedPhone = lead.phone.replace(/[\s\-()]/g, "");
        if (normalizedPhone.length >= 9) {
          if (!phoneMap.has(normalizedPhone)) {
            phoneMap.set(normalizedPhone, []);
          }
          phoneMap.get(normalizedPhone)!.push(lead);
        }
      }

      // Normalize email - lowercase
      if (lead.email) {
        const normalizedEmail = lead.email.toLowerCase().trim();
        if (normalizedEmail.includes("@")) {
          if (!emailMap.has(normalizedEmail)) {
            emailMap.set(normalizedEmail, []);
          }
          emailMap.get(normalizedEmail)!.push(lead);
        }
      }
    });

    const groups: DuplicateGroup[] = [];

    // Add phone duplicates
    phoneMap.forEach((groupLeads, phone) => {
      if (groupLeads.length > 1) {
        groups.push({
          key: `phone-${phone}`,
          type: "phone",
          value: phone,
          leads: groupLeads,
        });
      }
    });

    // Add email duplicates (only if not already covered by phone)
    emailMap.forEach((groupLeads, email) => {
      if (groupLeads.length > 1) {
        // Check if these leads are already in a phone group
        const leadIds = groupLeads.map((l) => l.id);
        const alreadyCovered = groups.some(
          (g) =>
            g.type === "phone" &&
            g.leads.some((l) => leadIds.includes(l.id)) &&
            g.leads.length === groupLeads.length
        );

        if (!alreadyCovered) {
          groups.push({
            key: `email-${email}`,
            type: "email",
            value: email,
            leads: groupLeads,
          });
        }
      }
    });

    return groups;
  }, [leads]);

  // Filter groups based on selected type
  const filteredGroups = useMemo(() => {
    if (filterType === "all") return duplicateGroups;
    return duplicateGroups.filter((g) => g.type === filterType);
  }, [duplicateGroups, filterType]);

  // Toggle group expansion
  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Open merge dialog for a group
  const handleMergeClick = (group: DuplicateGroup) => {
    setSelectedGroup(group);
    setMergeDialogOpen(true);
  };

  // Delete duplicates mutation (keep first, delete rest)
  const deleteDuplicatesMutation = useMutation({
    mutationFn: async (group: DuplicateGroup) => {
      // Keep the oldest lead (first in array since sorted by created_at asc)
      const leadsToDelete = group.leads.slice(1).map((l) => l.id);
      
      const { error } = await supabase
        .from("leads")
        .delete()
        .in("id", leadsToDelete);

      if (error) throw error;
      return leadsToDelete.length;
    },
    onSuccess: (deletedCount) => {
      toast({
        title: "כפילויות נמחקו",
        description: `${deletedCount} לידים כפולים נמחקו בהצלחה`,
      });
      queryClient.invalidateQueries({ queryKey: ["leads-for-duplicates"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      setDeleteConfirmOpen(false);
      setGroupToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "שגיאה במחיקת כפילויות",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Confirm delete
  const handleDeleteClick = (group: DuplicateGroup) => {
    setGroupToDelete(group);
    setDeleteConfirmOpen(true);
  };

  const totalDuplicateLeads = duplicateGroups.reduce(
    (sum, g) => sum + g.leads.length - 1,
    0
  );

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Copy className="h-4 w-4" />
            נהל כפילויות
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              ניהול לידים כפולים
            </DialogTitle>
          </DialogHeader>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : duplicateGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">לא נמצאו לידים כפולים</h3>
              <p className="text-muted-foreground">כל הלידים במערכת ייחודיים</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-base px-3 py-1">
                    {duplicateGroups.length} קבוצות
                  </Badge>
                  <Badge variant="outline" className="text-base px-3 py-1">
                    {totalDuplicateLeads} לידים כפולים
                  </Badge>
                </div>

                <Tabs
                  value={filterType}
                  onValueChange={(v) => setFilterType(v as any)}
                >
                  <TabsList>
                    <TabsTrigger value="all">הכל</TabsTrigger>
                    <TabsTrigger value="phone" className="gap-1">
                      <Phone className="h-3 w-3" />
                      טלפון
                    </TabsTrigger>
                    <TabsTrigger value="email" className="gap-1">
                      <Mail className="h-3 w-3" />
                      אימייל
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <ScrollArea className="flex-1 -mx-6 px-6">
                <div className="space-y-3 pb-4">
                  {filteredGroups.map((group) => (
                    <div
                      key={group.key}
                      className="border rounded-lg overflow-hidden"
                    >
                      {/* Group Header */}
                      <div
                        className="flex items-center justify-between p-3 bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                        onClick={() => toggleGroup(group.key)}
                      >
                        <div className="flex items-center gap-3">
                          {group.type === "phone" ? (
                            <Phone className="h-4 w-4 text-primary" />
                          ) : (
                            <Mail className="h-4 w-4 text-primary" />
                          )}
                          <span className="font-medium">{group.value}</span>
                          <Badge variant="secondary">
                            {group.leads.length} לידים
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="default"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMergeClick(group);
                            }}
                          >
                            מזג
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteClick(group);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          {expandedGroups.has(group.key) ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </div>
                      </div>

                      {/* Expanded Details */}
                      {expandedGroups.has(group.key) && (
                        <div className="border-t">
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead className="bg-muted/30">
                                <tr>
                                  <th className="text-right p-2 font-medium">
                                    שם
                                  </th>
                                  <th className="text-right p-2 font-medium">
                                    חברה
                                  </th>
                                  <th className="text-right p-2 font-medium">
                                    סוכנות
                                  </th>
                                  <th className="text-right p-2 font-medium">
                                    תאריך יצירה
                                  </th>
                                  <th className="text-right p-2 font-medium">
                                    מקור
                                  </th>
                                  <th className="text-right p-2 font-medium">
                                    סטטוס
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {group.leads.map((lead, idx) => (
                                  <tr
                                    key={lead.id}
                                    className={
                                      idx === 0
                                        ? "bg-green-50 dark:bg-green-950/20"
                                        : ""
                                    }
                                  >
                                    <td className="p-2">
                                      <div className="flex items-center gap-1">
                                        {idx === 0 && (
                                          <Badge
                                            variant="outline"
                                            className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                          >
                                            ראשון
                                          </Badge>
                                        )}
                                        {lead.contact_name || "-"}
                                      </div>
                                    </td>
                                    <td className="p-2">
                                      {lead.company_name || "-"}
                                    </td>
                                    <td className="p-2">
                                      {lead.agencies?.name || "-"}
                                    </td>
                                    <td className="p-2">
                                      {format(
                                        new Date(lead.created_at),
                                        "dd/MM/yyyy HH:mm"
                                      )}
                                    </td>
                                    <td className="p-2">{lead.source || "-"}</td>
                                    <td className="p-2">{lead.status || "-"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Merge Dialog */}
      {selectedGroup && (
        <MergeLeadsDialog
          open={mergeDialogOpen}
          onOpenChange={setMergeDialogOpen}
          group={selectedGroup}
          onMergeComplete={() => {
            queryClient.invalidateQueries({ queryKey: ["leads-for-duplicates"] });
            queryClient.invalidateQueries({ queryKey: ["leads"] });
          }}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת לידים כפולים</AlertDialogTitle>
            <AlertDialogDescription>
              פעולה זו תמחק {groupToDelete?.leads.length ? groupToDelete.leads.length - 1 : 0} לידים כפולים ותשאיר רק את הליד הראשון (הישן ביותר).
              <br />
              <strong>פעולה זו לא ניתנת לביטול!</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => groupToDelete && deleteDuplicatesMutation.mutate(groupToDelete)}
              disabled={deleteDuplicatesMutation.isPending}
            >
              {deleteDuplicatesMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "מחק כפילויות"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
