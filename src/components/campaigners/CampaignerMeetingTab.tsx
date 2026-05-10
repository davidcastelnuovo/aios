import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMeetingScheduler } from "@/hooks/useMeetingScheduler";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarIcon, Clock, UserPlus, CheckCircle2, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { he } from "date-fns/locale";

interface CampaignerMeetingTabProps {
  campaigner: { id: string; full_name: string; email: string | null };
  tenantId?: string;
}

export function CampaignerMeetingTab({ campaigner, tenantId }: CampaignerMeetingTabProps) {
  const queryClient = useQueryClient();
  const meetingScheduler = useMeetingScheduler(tenantId);
  const [includeCampaignerEmail, setIncludeCampaignerEmail] = useState(true);
  const [selectedTeamMembers, setSelectedTeamMembers] = useState<string[]>([]);

  // Reset selection when campaigner changes
  useEffect(() => {
    setIncludeCampaignerEmail(true);
    setSelectedTeamMembers([]);
  }, [campaigner.id]);

  const {
    data: teamMembers = [],
    isLoading: isLoadingTeamMembers,
    error: teamMembersError,
  } = useQuery({
    queryKey: ["team-members-for-meeting-tab", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const { data: tenantUsersData, error: tenantUsersError } = await supabase
        .from("tenant_users")
        .select("user_id")
        .eq("tenant_id", tenantId);

      if (tenantUsersError) throw tenantUsersError;

      const userIds = (tenantUsersData || []).map((tu) => tu.user_id).filter(Boolean);
      if (userIds.length === 0) return [];

      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds)
        .not("email", "is", null)
        .order("full_name");

      if (profilesError) throw profilesError;

      return (profilesData || []).filter((p: any) => p.email && p.email.trim() !== "");
    },
    enabled: !!tenantId,
  });

  const timeSlots = meetingScheduler.getAvailableTimeSlots();
  const endTimeSlots = meetingScheduler.getAvailableEndTimeSlots();
  const startConflict = !!meetingScheduler.meetingTime && timeSlots.some(s => s.time === meetingScheduler.meetingTime && !s.available);
  const endConflict = !!meetingScheduler.meetingEndTime && endTimeSlots.some(s => s.time === meetingScheduler.meetingEndTime && !s.available);
  const hasConflict = startConflict || endConflict;

  const handleScheduleMeeting = async () => {
    const additionalEmails = [
      ...(includeCampaignerEmail && campaigner.email ? [campaigner.email] : []),
      ...selectedTeamMembers,
    ];
    await meetingScheduler.scheduleMeeting({
      contactName: campaigner.full_name,
      contactEmail: includeCampaignerEmail ? campaigner.email || undefined : undefined,
      contactId: campaigner.id,
      contactType: 'campaigner',
      additionalEmails: additionalEmails.filter((e, i, self) => self.indexOf(e) === i),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["campaigners"] });
        setSelectedTeamMembers([]);
      },
    });
  };

  return (
    <div className="space-y-4" dir="rtl">
      <h4 className="text-sm font-medium flex items-center gap-2">
        <CalendarIcon className="h-4 w-4" />
        קביעת פגישה עם איש צוות
      </h4>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <label className="text-sm font-medium">בחר תאריך</label>
          <Card className="p-2">
            <Calendar
              mode="single"
              selected={meetingScheduler.meetingDate}
              onSelect={meetingScheduler.handleDateSelect}
              disabled={(date) => date < new Date()}
              className="pointer-events-auto"
              locale={he}
            />
          </Card>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              משעה
            </label>
            <Select value={meetingScheduler.meetingTime} onValueChange={meetingScheduler.setMeetingTime}>
              <SelectTrigger className="w-full text-right rounded-lg border-2 h-11">
                <SelectValue placeholder="בחר שעה" />
              </SelectTrigger>
              <SelectContent className="bg-background z-50 max-h-[200px]">
                {meetingScheduler.isLoadingCalendar ? (
                  <SelectItem value="loading" disabled>טוען יומן...</SelectItem>
                ) : (
                  timeSlots.map(({ time, available }) => (
                    <SelectItem
                      key={time}
                      value={time}
                      className={!available ? "text-amber-600 font-medium" : ""}
                    >
                      {time} {!available && "⚠️ (תפוס ביומן)"}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">עד שעה</label>
            <Select value={meetingScheduler.meetingEndTime} onValueChange={meetingScheduler.setMeetingEndTime}>
              <SelectTrigger className="w-full text-right rounded-lg border-2 h-11">
                <SelectValue placeholder="בחר שעת סיום" />
              </SelectTrigger>
              <SelectContent className="bg-background z-50 max-h-[200px]">
                {!meetingScheduler.meetingTime ? (
                  <SelectItem value="no-start" disabled>בחר קודם שעת התחלה</SelectItem>
                ) : meetingScheduler.isLoadingCalendar ? (
                  <SelectItem value="loading-end" disabled>טוען יומן...</SelectItem>
                ) : endTimeSlots.length === 0 ? (
                  <SelectItem value="none-end" disabled>אין אפשרויות סיום ליום זה</SelectItem>
                ) : (
                  endTimeSlots.map(({ time, available }) => (
                    <SelectItem
                      key={`end-${time}`}
                      value={time}
                      className={!available ? "text-amber-600 font-medium" : ""}
                    >
                      {time} {!available && "⚠️ (תפוס ביומן)"}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {hasConflict && (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 rounded-lg p-3 text-sm text-amber-800 dark:text-amber-200">
              ⚠️ יש לך כבר אירוע ביומן בשעה הזו — הזימון ייקבע במקביל.
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">נושא הפגישה</label>
            <Input
              value={meetingScheduler.meetingSubject}
              onChange={(e) => meetingScheduler.setMeetingSubject(e.target.value)}
              placeholder={`פגישה עם ${campaigner.full_name}`}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">מיקום (אופציונלי)</label>
            <Input
              value={meetingScheduler.meetingLocation}
              onChange={(e) => meetingScheduler.setMeetingLocation(e.target.value)}
              placeholder="Google Meet / משרד / זום"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">הודעה אישית (אופציונלי)</label>
            <Textarea
              value={meetingScheduler.personalMessage}
              onChange={(e) => meetingScheduler.setPersonalMessage(e.target.value)}
              placeholder="הוסף הודעה אישית שתופיע בהזמנה..."
              rows={3}
            />
          </div>

          {campaigner.email ? (
            <div className="space-y-2">
              <label className="text-sm font-medium">שלח זימון ל:</label>
              <label className="flex items-center gap-2 p-2 rounded-md bg-muted/50 cursor-pointer text-sm">
                <Checkbox
                  checked={includeCampaignerEmail}
                  onCheckedChange={(checked) => setIncludeCampaignerEmail(!!checked)}
                />
                <span className="font-medium">{campaigner.full_name}</span>
                <span className="text-muted-foreground mr-auto">{campaigner.email}</span>
              </label>
            </div>
          ) : (
            <div className="bg-muted/50 border rounded-lg p-3 text-sm text-muted-foreground">
              לאיש הצוות אין אימייל — הזימון לא יישלח אליו במייל
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              הזמן משתמשים מהמערכת:
            </label>
            {isLoadingTeamMembers ? (
              <p className="text-sm text-muted-foreground">טוען משתמשי צוות...</p>
            ) : teamMembersError ? (
              <p className="text-sm text-destructive">
                {teamMembersError instanceof Error ? teamMembersError.message : "שגיאה בטעינת משתמשי צוות"}
              </p>
            ) : teamMembers.length > 0 ? (
              <div className="space-y-1.5 max-h-[150px] overflow-y-auto">
                {teamMembers.map((member: any) => (
                  <label key={member.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/50 cursor-pointer text-sm">
                    <Checkbox
                      checked={selectedTeamMembers.includes(member.email)}
                      onCheckedChange={(checked) => {
                        setSelectedTeamMembers(prev =>
                          checked
                            ? [...prev, member.email]
                            : prev.filter(e => e !== member.email)
                        );
                      }}
                    />
                    <span className="font-medium">{member.full_name}</span>
                    <span className="text-muted-foreground mr-auto">{member.email}</span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">לא נמצאו משתמשים עם אימייל</p>
            )}
          </div>

          {meetingScheduler.meetingDate && (
            <Card className="p-4 bg-primary/5 border-primary/20">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span className="font-medium">
                  {format(meetingScheduler.meetingDate, 'EEEE, d בMMMM yyyy', { locale: he })} {meetingScheduler.meetingTime} - {meetingScheduler.meetingEndTime}
                </span>
              </div>
            </Card>
          )}

          <Button
            onClick={handleScheduleMeeting}
            disabled={!meetingScheduler.meetingDate || !meetingScheduler.meetingTime || !meetingScheduler.meetingEndTime || meetingScheduler.isSchedulingMeeting}
            className="w-full"
          >
            {meetingScheduler.isSchedulingMeeting ? (
              <>
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                קובע פגישה...
              </>
            ) : (
              <>
                <CalendarIcon className="ml-2 h-4 w-4" />
                {(() => {
                  const totalInvitees = (includeCampaignerEmail && campaigner.email ? 1 : 0) + selectedTeamMembers.length;
                  return totalInvitees > 0 ? `קבע פגישה ושלח זימון ל-${totalInvitees} משתתפים` : "קבע פגישה";
                })()}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
