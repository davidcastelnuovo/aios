import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Clock, Play, Square, Trash2, Calendar } from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { format, differenceInMinutes } from "date-fns";
import { he } from "date-fns/locale";
import { useUserRole } from "@/hooks/useUserRole";
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

export default function TimeTracking() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedCampaigner, setSelectedCampaigner] = useState<string>("me");
  const queryClient = useQueryClient();
  const { isAdmin, isOwner } = useUserRole();

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
    queryKey: ["campaigners"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigners")
        .select("*")
        .eq("active", true)
        .order("full_name");
      if (error) throw error;
      return data;
    },
    enabled: isAdmin || isOwner,
  });

  const { data: activeEntry } = useQuery({
    queryKey: ["active-time-entry", selectedCampaigner === "me" ? profile?.campaigner_id : selectedCampaigner],
    queryFn: async () => {
      const campaignerId = selectedCampaigner === "me" ? profile?.campaigner_id : selectedCampaigner;
      if (!campaignerId) return null;

      const { data, error } = await supabase
        .from("time_entries")
        .select(`
          *,
          campaigners (full_name)
        `)
        .eq("campaigner_id", campaignerId)
        .is("end_time", null)
        .order("start_time", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!profile?.campaigner_id || (isAdmin || isOwner),
    refetchInterval: 5000,
  });

  const { data: timeEntries } = useQuery({
    queryKey: ["time-entries", selectedCampaigner],
    queryFn: async () => {
      let query = supabase
        .from("time_entries")
        .select(`
          *,
          campaigners (full_name)
        `)
        .order("start_time", { ascending: false });

      if (selectedCampaigner === "me" && profile?.campaigner_id) {
        query = query.eq("campaigner_id", profile.campaigner_id);
      } else if (selectedCampaigner !== "all" && selectedCampaigner !== "me") {
        query = query.eq("campaigner_id", selectedCampaigner);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.campaigner_id || (isAdmin || isOwner),
  });

  const startTimerMutation = useMutation({
    mutationFn: async () => {
      // Ensure we have a campaigner_id, fetch if missing
      let campaignerId = profile?.campaigner_id as string | null | undefined;
      if (!campaignerId) {
        const { data, error } = await supabase
          .from("profiles")
          .select("campaigner_id")
          .maybeSingle();
        if (error) throw error;
        campaignerId = data?.campaigner_id;
      }

      if (!campaignerId) {
        throw new Error("לא נמצא קמפיינר משויך למשתמש. יש לשייך קמפיינר בפרופיל.");
      }

      const { error } = await supabase
        .from("time_entries")
        .insert({
          campaigner_id: campaignerId,
          start_time: new Date().toISOString(),
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
      const { error } = await supabase
        .from("time_entries")
        .update({ end_time: new Date().toISOString() })
        .eq("id", entryId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["active-time-entry"] });
      queryClient.invalidateQueries({ queryKey: ["time-entries"] });
      toast.success("השעון נעצר");
    },
    onError: () => {
      toast.error("שגיאה בעצירת השעון");
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

  const calculateDuration = (start: string, end: string | null) => {
    const startDate = new Date(start);
    const endDate = end ? new Date(end) : currentTime;
    const minutes = differenceInMinutes(endDate, startDate);
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}:${mins.toString().padStart(2, "0")}`;
  };

  const calculateTotalHours = () => {
    if (!timeEntries) return "0:00";
    const totalMinutes = timeEntries.reduce((acc, entry) => {
      if (!entry.end_time) return acc;
      return acc + differenceInMinutes(new Date(entry.end_time), new Date(entry.start_time));
    }, 0);
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hours}:${mins.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold">שעון נוכחות</h2>
          <p className="text-muted-foreground mt-1">מעקב אחר שעות עבודה</p>
        </div>

        {(isAdmin || isOwner) && (
          <div className="w-full md:w-48">
            <Select value={selectedCampaigner} onValueChange={setSelectedCampaigner}>
              <SelectTrigger>
                <SelectValue placeholder="בחר קמפיינר" />
              </SelectTrigger>
              <SelectContent className="bg-background">
                <SelectItem value="me">השעון שלי</SelectItem>
                <SelectItem value="all">כל הקמפיינרים</SelectItem>
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

      {selectedCampaigner === "me" && (
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              שעון עבודה
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeEntry ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-success/10 rounded-lg border border-success/20">
                  <div>
                    <p className="text-sm text-muted-foreground">התחלה</p>
                    <p className="text-lg font-semibold">
                      {format(new Date(activeEntry.start_time), "HH:mm:ss", { locale: he })}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">זמן עבודה</p>
                    <p className="text-2xl font-bold text-success">
                      {calculateDuration(activeEntry.start_time, null)}
                    </p>
                  </div>
                  <Button
                    onClick={() => stopTimerMutation.mutate(activeEntry.id)}
                    variant="destructive"
                    size="lg"
                  >
                    <Square className="h-5 w-5 ml-2" />
                    עצור
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Clock className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">לא פעיל כרגע</p>
                <Button
                  onClick={() => startTimerMutation.mutate()}
                  size="lg"
                  className="gap-2"
                >
                  <Play className="h-5 w-5" />
                  התחל עבודה
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="shadow-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              היסטוריית שעות
            </CardTitle>
            <Badge variant="outline" className="text-base">
              סה"כ: {calculateTotalHours()} שעות
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {timeEntries && timeEntries.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {(isAdmin || isOwner) && selectedCampaigner !== "me" && (
                      <TableHead className="text-right">קמפיינר</TableHead>
                    )}
                    <TableHead className="text-right">תאריך</TableHead>
                    <TableHead className="text-right">התחלה</TableHead>
                    <TableHead className="text-right">סיום</TableHead>
                    <TableHead className="text-right">משך</TableHead>
                    <TableHead className="text-right">פעולות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {timeEntries.map((entry) => (
                    <TableRow key={entry.id}>
                      {(isAdmin || isOwner) && selectedCampaigner !== "me" && (
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
                          <Badge variant="outline" className="bg-success/10 text-success">
                            פעיל
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        {calculateDuration(entry.start_time, entry.end_time)}
                      </TableCell>
                      <TableCell>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <Trash2 className="h-4 w-4 text-destructive" />
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
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>אין רשומות שעון עדיין</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
