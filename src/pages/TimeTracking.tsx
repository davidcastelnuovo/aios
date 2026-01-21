import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Clock, Play, Square, Trash2, Calendar, Pencil, Filter, X, Pause, Coffee } from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { format, differenceInMinutes, parse, startOfDay, endOfDay } from "date-fns";
import { he } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useTerminology } from "@/hooks/useTerminology";

export default function TimeTracking() {
  const { tenantId } = useCurrentTenant();
  const { t } = useTerminology();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedCampaigner, setSelectedCampaigner] = useState<string>("me");
  const [editingEntry, setEditingEntry] = useState<any>(null);
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const [filterStartDate, setFilterStartDate] = useState<Date | undefined>(undefined);
  const [filterEndDate, setFilterEndDate] = useState<Date | undefined>(undefined);
  const queryClient = useQueryClient();

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("profiles")
        .select("campaigner_id")
        .eq("id", user.id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
  });

  const { data: campaigners } = useQuery({
    queryKey: ["campaigners", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("campaigners")
        .select("*")
        .eq("active", true)
        .order("full_name");
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: activeEntry } = useQuery({
    queryKey: ["active-time-entry", tenantId, selectedCampaigner === "me" ? profile?.campaigner_id : selectedCampaigner],
    queryFn: async () => {
      if (!tenantId) return null;
      const campaignerId = selectedCampaigner === "me" ? profile?.campaigner_id : selectedCampaigner;
      if (!campaignerId) return null;

      const { data, error } = await supabase
        .from("time_entries")
        .select(`
          *,
          campaigners (full_name)
        `)
        .eq("tenant_id", tenantId)
        .eq("campaigner_id", campaignerId)
        .is("end_time", null)
        .order("start_time", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!tenantId && (selectedCampaigner === "me" ? !!profile?.campaigner_id : true),
    refetchInterval: 5000,
  });

  // Query for active break
  const { data: activeBreak } = useQuery({
    queryKey: ["active-break", activeEntry?.id],
    queryFn: async () => {
      if (!activeEntry?.id) return null;

      const { data, error } = await supabase
        .from("time_entry_breaks")
        .select("*")
        .eq("time_entry_id", activeEntry.id)
        .is("end_time", null)
        .order("start_time", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!activeEntry?.id,
    refetchInterval: 5000,
  });

  // Query for all breaks of active entry (to calculate total break time)
  const { data: activeEntryBreaks } = useQuery({
    queryKey: ["active-entry-breaks", activeEntry?.id],
    queryFn: async () => {
      if (!activeEntry?.id) return [];

      const { data, error } = await supabase
        .from("time_entry_breaks")
        .select("*")
        .eq("time_entry_id", activeEntry.id)
        .order("start_time", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!activeEntry?.id,
  });

  const { data: timeEntries } = useQuery({
    queryKey: ["time-entries", tenantId, selectedCampaigner, filterStartDate?.toISOString(), filterEndDate?.toISOString()],
    queryFn: async () => {
      if (!tenantId) return [];
      let query = supabase
        .from("time_entries")
        .select(`
          *,
          campaigners (full_name),
          time_entry_breaks (*)
        `)
        .eq("tenant_id", tenantId)
        .order("start_time", { ascending: false });

      if (selectedCampaigner === "me" && profile?.campaigner_id) {
        query = query.eq("campaigner_id", profile.campaigner_id);
      } else if (selectedCampaigner !== "all" && selectedCampaigner !== "me") {
        query = query.eq("campaigner_id", selectedCampaigner);
      }

      // Date filtering
      if (filterStartDate) {
        query = query.gte("start_time", startOfDay(filterStartDate).toISOString());
      }
      if (filterEndDate) {
        query = query.lte("start_time", endOfDay(filterEndDate).toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId && (selectedCampaigner === "me" ? !!profile?.campaigner_id : true),
  });

  const startTimerMutation = useMutation({
    mutationFn: async () => {
      // Ensure we have a campaigner_id, fetch if missing
      let campaignerId = profile?.campaigner_id as string | null | undefined;

      // Get current user for secure lookups
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (!campaignerId) {
        const { data, error } = await supabase
          .from("profiles")
          .select("campaigner_id")
          .eq("id", user.id)
          .maybeSingle();
        if (error) throw error;
        campaignerId = data?.campaigner_id;
      }

      if (!campaignerId) {
        throw new Error("לא נמצא קמפיינר משויך למשתמש. יש לשייך קמפיינר בפרופיל.");
      }

      // Fetch tenant_id to satisfy RLS policy
      const { data: tenantId, error: tenantErr } = await supabase.rpc("get_user_tenant_id", { _user_id: user.id });
      if (tenantErr) throw tenantErr;
      if (!tenantId) throw new Error("לא נמצא טננט למשתמש. יש לשייך משתמש לטננט.");

      const { error } = await supabase
        .from("time_entries")
        .insert({
          campaigner_id: campaignerId,
          start_time: new Date().toISOString(),
          tenant_id: tenantId as string,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["active-time-entry"] });
      queryClient.invalidateQueries({ queryKey: ["time-entries"] });
      toast.success("השעון התחיל");
    },
    onError: (err) => {
      toast.error(`שגיאה בהתחלת השעון: ${err instanceof Error ? err.message : ""}`);
    },
  });

  const stopTimerMutation = useMutation({
    mutationFn: async (entryId: string) => {
      // First, end any active break
      if (activeBreak) {
        await supabase
          .from("time_entry_breaks")
          .update({ end_time: new Date().toISOString() })
          .eq("id", activeBreak.id);
      }

      const { error } = await supabase
        .from("time_entries")
        .update({ end_time: new Date().toISOString() })
        .eq("id", entryId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["active-time-entry"] });
      queryClient.invalidateQueries({ queryKey: ["time-entries"] });
      queryClient.invalidateQueries({ queryKey: ["active-break"] });
      queryClient.invalidateQueries({ queryKey: ["active-entry-breaks"] });
      toast.success("השעון נעצר");
    },
    onError: () => {
      toast.error("שגיאה בעצירת השעון");
    },
  });

  // Start break mutation
  const startBreakMutation = useMutation({
    mutationFn: async (entryId: string) => {
      if (!tenantId) throw new Error("No tenant");
      
      const { error } = await supabase
        .from("time_entry_breaks")
        .insert({
          time_entry_id: entryId,
          tenant_id: tenantId,
          start_time: new Date().toISOString(),
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["active-break"] });
      queryClient.invalidateQueries({ queryKey: ["active-entry-breaks"] });
      toast.success("הפסקה התחילה");
    },
    onError: () => {
      toast.error("שגיאה בהתחלת הפסקה");
    },
  });

  // End break mutation
  const endBreakMutation = useMutation({
    mutationFn: async (breakId: string) => {
      const { error } = await supabase
        .from("time_entry_breaks")
        .update({ end_time: new Date().toISOString() })
        .eq("id", breakId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["active-break"] });
      queryClient.invalidateQueries({ queryKey: ["active-entry-breaks"] });
      toast.success("הפסקה הסתיימה");
    },
    onError: () => {
      toast.error("שגיאה בסיום הפסקה");
    },
  });

  const deleteEntryMutation = useMutation({
    mutationFn: async (entryId: string) => {
      const { error } = await supabase
        .from("time_entries")
        .delete()
        .eq("id", entryId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-entries"] });
      toast.success("הרשומה נמחקה");
    },
    onError: () => {
      toast.error("שגיאה במחיקת הרשומה");
    },
  });

  const editEntryMutation = useMutation({
    mutationFn: async ({ entryId, startTime, endTime }: { entryId: string; startTime: string; endTime: string }) => {
      const { error } = await supabase
        .from("time_entries")
        .update({
          start_time: startTime,
          end_time: endTime,
        })
        .eq("id", entryId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-entries"] });
      queryClient.invalidateQueries({ queryKey: ["active-time-entry"] });
      setEditingEntry(null);
      toast.success("הרשומה עודכנה");
    },
    onError: () => {
      toast.error("שגיאה בעדכון הרשומה");
    },
  });

  const handleEditClick = (entry: any) => {
    setEditingEntry(entry);
    setEditStartTime(format(new Date(entry.start_time), "yyyy-MM-dd'T'HH:mm"));
    setEditEndTime(entry.end_time ? format(new Date(entry.end_time), "yyyy-MM-dd'T'HH:mm") : "");
  };

  const handleEditSubmit = () => {
    if (!editingEntry || !editStartTime || !editEndTime) {
      toast.error("יש למלא את כל השדות");
      return;
    }

    editEntryMutation.mutate({
      entryId: editingEntry.id,
      startTime: new Date(editStartTime).toISOString(),
      endTime: new Date(editEndTime).toISOString(),
    });
  };

  const calculateDuration = (start: string, end: string | null) => {
    const startDate = new Date(start);
    const endDate = end ? new Date(end) : currentTime;
    const minutes = differenceInMinutes(endDate, startDate);
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}:${mins.toString().padStart(2, "0")}`;
  };

  // Calculate total break time for a given list of breaks
  const calculateBreakTime = (breaks: any[]) => {
    if (!breaks || breaks.length === 0) return 0;
    return breaks.reduce((acc, brk) => {
      if (!brk.end_time) {
        // Active break - count from start to now
        return acc + differenceInMinutes(currentTime, new Date(brk.start_time));
      }
      return acc + differenceInMinutes(new Date(brk.end_time), new Date(brk.start_time));
    }, 0);
  };

  // Format minutes to HH:MM
  const formatMinutesToTime = (totalMinutes: number) => {
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hours}:${mins.toString().padStart(2, "0")}`;
  };

  // Calculate net work time (total - breaks)
  const calculateNetWorkTime = (start: string, end: string | null, breaks: any[]) => {
    const startDate = new Date(start);
    const endDate = end ? new Date(end) : currentTime;
    const totalMinutes = differenceInMinutes(endDate, startDate);
    const breakMinutes = calculateBreakTime(breaks);
    const netMinutes = Math.max(0, totalMinutes - breakMinutes);
    return formatMinutesToTime(netMinutes);
  };

  const calculateTotalHours = () => {
    if (!timeEntries) return "0:00";
    const totalNetMinutes = timeEntries.reduce((acc, entry) => {
      if (!entry.end_time) return acc;
      const grossMinutes = differenceInMinutes(new Date(entry.end_time), new Date(entry.start_time));
      const breakMinutes = calculateBreakTime(entry.time_entry_breaks || []);
      return acc + Math.max(0, grossMinutes - breakMinutes);
    }, 0);
    const hours = Math.floor(totalNetMinutes / 60);
    const mins = totalNetMinutes % 60;
    return `${hours}:${mins.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold">שעון נוכחות</h2>
        </div>

        {campaigners && campaigners.length > 0 && (
          <div className="w-full md:w-48">
            <Select value={selectedCampaigner} onValueChange={setSelectedCampaigner}>
              <SelectTrigger>
                <SelectValue placeholder={`בחר ${t('role_campaigner')}`} />
              </SelectTrigger>
              <SelectContent className="bg-background">
                <SelectItem value="me">השעון שלי</SelectItem>
                <SelectItem value="all">כל ה{t('role_campaigner', true)}</SelectItem>
                {campaigners?.map((campaigner) => (
                  <SelectItem key={campaigner.id} value={campaigner.id}>
                    {campaigner.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Date Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">סינון לפי תאריך:</span>
        </div>
        
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Calendar className="h-4 w-4" />
              {filterStartDate ? format(filterStartDate, "dd/MM/yyyy") : "מתאריך"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarComponent
              mode="single"
              selected={filterStartDate}
              onSelect={setFilterStartDate}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Calendar className="h-4 w-4" />
              {filterEndDate ? format(filterEndDate, "dd/MM/yyyy") : "עד תאריך"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarComponent
              mode="single"
              selected={filterEndDate}
              onSelect={setFilterEndDate}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        {(filterStartDate || filterEndDate) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFilterStartDate(undefined);
              setFilterEndDate(undefined);
            }}
            className="gap-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
            נקה פילטרים
          </Button>
        )}
      </div>

      {selectedCampaigner === "me" && (
      <Card className="shadow-card border-primary/20">
        <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5">
          <CardTitle className="flex items-center gap-2 text-primary">
            <Clock className="h-5 w-5" />
            שעון עבודה
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          {activeEntry ? (
            <div className="space-y-4">
              {/* Active break indicator */}
              {activeBreak && (
                <div className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 rounded-lg border-2 border-amber-400/50 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Coffee className="h-5 w-5 text-amber-600" />
                      <span className="font-medium text-amber-700 dark:text-amber-400">בהפסקה</span>
                    </div>
                    <span className="text-lg font-bold text-amber-600 dark:text-amber-400">
                      {calculateDuration(activeBreak.start_time, null)}
                    </span>
                  </div>
                </div>
              )}

              <div className={`rounded-lg border-2 p-6 ${
                activeBreak 
                  ? 'bg-gradient-to-br from-amber-50/50 to-amber-100/50 dark:from-amber-900/10 dark:to-amber-800/10 border-amber-400/30' 
                  : 'bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-400/50'
              }`}>
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2 border-b border-green-200 dark:border-green-700/30">
                    <span className="text-sm text-muted-foreground">התחלה</span>
                    <span className="text-lg font-semibold text-foreground">
                      {format(new Date(activeEntry.start_time), "HH:mm:ss", { locale: he })}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between py-2 border-b border-green-200 dark:border-green-700/30">
                    <span className="text-sm text-muted-foreground">זמן ברוטו</span>
                    <span className="text-xl font-bold text-muted-foreground">
                      {calculateDuration(activeEntry.start_time, null)}
                    </span>
                  </div>

                  {activeEntryBreaks && activeEntryBreaks.length > 0 && (
                    <div className="flex items-center justify-between py-2 border-b border-green-200 dark:border-green-700/30">
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <Coffee className="h-4 w-4" />
                        הפסקות
                      </span>
                      <span className="text-lg font-medium text-amber-600 dark:text-amber-400">
                        -{formatMinutesToTime(calculateBreakTime(activeEntryBreaks))}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-muted-foreground">זמן עבודה נטו</span>
                    <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {calculateNetWorkTime(activeEntry.start_time, null, activeEntryBreaks || [])}
                    </span>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2 pt-2">
                    {activeBreak ? (
                      <Button
                        onClick={() => endBreakMutation.mutate(activeBreak.id)}
                        variant="outline"
                        size="sm"
                        className="flex-1 border-green-500 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                      >
                        <Play className="h-4 w-4 ml-2" />
                        חזור לעבודה
                      </Button>
                    ) : (
                      <Button
                        onClick={() => startBreakMutation.mutate(activeEntry.id)}
                        variant="outline"
                        size="sm"
                        className="flex-1 border-amber-500 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                      >
                        <Coffee className="h-4 w-4 ml-2" />
                        הפסקה
                      </Button>
                    )}
                    <Button
                      onClick={() => stopTimerMutation.mutate(activeEntry.id)}
                      variant="destructive"
                      size="sm"
                      className="shadow-lg"
                    >
                      <Square className="h-4 w-4 ml-2" />
                      עצור
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-primary/10 mb-6">
                <Clock className="h-12 w-12 text-primary" />
              </div>
              <p className="text-muted-foreground mb-6 text-lg">לא פעיל כרגע</p>
              <Button
                onClick={() => startTimerMutation.mutate()}
                size="lg"
                className="gap-2 shadow-lg px-8 py-6 text-lg"
              >
                <Play className="h-6 w-6" />
                התחל עבודה
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      )}

      <Card className="shadow-card border-primary/20">
        <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-primary">
              <Calendar className="h-5 w-5" />
              היסטוריית שעות
            </CardTitle>
            <Badge variant="outline" className="text-base font-semibold border-primary/30 bg-primary/5">
              סה"כ: {calculateTotalHours()} שעות
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {timeEntries && timeEntries.length > 0 ? (
            <div className="rounded-lg border border-primary/20 overflow-hidden">
              <Table>
                <TableHeader className="bg-primary/5">
                  <TableRow className="border-primary/20">
                    {selectedCampaigner !== "me" && (
                      <TableHead className="text-right font-semibold">קמפיינר</TableHead>
                    )}
                    <TableHead className="text-right font-semibold">תאריך</TableHead>
                    <TableHead className="text-right font-semibold">התחלה</TableHead>
                    <TableHead className="text-right font-semibold">סיום</TableHead>
                    <TableHead className="text-right font-semibold">ברוטו</TableHead>
                    <TableHead className="text-right font-semibold">הפסקות</TableHead>
                    <TableHead className="text-right font-semibold">נטו</TableHead>
                    <TableHead className="text-right font-semibold">פעולות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {timeEntries.map((entry) => (
                    <TableRow key={entry.id} className="border-primary/10 hover:bg-primary/5">
                      {selectedCampaigner !== "me" && (
                        <TableCell className="font-medium">
                          {entry.campaigners?.full_name}
                        </TableCell>
                      )}
                      <TableCell>
                        {format(new Date(entry.start_time), "dd/MM/yyyy", { locale: he })}
                      </TableCell>
                      <TableCell>
                        {format(new Date(entry.start_time), "HH:mm", { locale: he })}
                      </TableCell>
                      <TableCell>
                        {entry.end_time ? (
                          format(new Date(entry.end_time), "HH:mm", { locale: he })
                        ) : (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300 dark:bg-green-900/20 dark:text-green-400">
                            פעיל
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {calculateDuration(entry.start_time, entry.end_time)}
                      </TableCell>
                      <TableCell className="text-amber-600 dark:text-amber-400">
                        {entry.time_entry_breaks && entry.time_entry_breaks.length > 0 
                          ? formatMinutesToTime(calculateBreakTime(entry.time_entry_breaks))
                          : "-"}
                      </TableCell>
                      <TableCell className="font-medium text-primary">
                        {calculateNetWorkTime(entry.start_time, entry.end_time, entry.time_entry_breaks || [])}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {entry.end_time && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditClick(entry)}
                              className="gap-2"
                            >
                              <Pencil className="h-4 w-4" />
                              ערוך
                            </Button>
                          )}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm" className="gap-2">
                                <Trash2 className="h-4 w-4" />
                                מחק
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>מחיקת רשומה</AlertDialogTitle>
                                <AlertDialogDescription>
                                  האם אתה בטוח שברצונך למחוק רשומה זו? פעולה זו לא ניתנת לביטול.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>ביטול</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteEntryMutation.mutate(entry.id)}
                                  className="bg-destructive hover:bg-destructive/90"
                                >
                                  מחק
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground bg-muted/30 rounded-lg">
              <Clock className="h-16 w-16 mx-auto mb-4 opacity-50 text-primary" />
              <p className="text-lg">אין רשומות שעון עדיין</p>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!editingEntry} onOpenChange={(open) => !open && setEditingEntry(null)}>
        <AlertDialogContent className="bg-background">
          <AlertDialogHeader>
            <AlertDialogTitle>עריכת זמני עבודה</AlertDialogTitle>
            <AlertDialogDescription>
              ערוך את זמני ההתחלה והסיום של הרשומה
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="start-time">זמן התחלה</Label>
              <Input
                id="start-time"
                type="datetime-local"
                value={editStartTime}
                onChange={(e) => setEditStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-time">זמן סיום</Label>
              <Input
                id="end-time"
                type="datetime-local"
                value={editEndTime}
                onChange={(e) => setEditEndTime(e.target.value)}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction onClick={handleEditSubmit}>
              שמור
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
