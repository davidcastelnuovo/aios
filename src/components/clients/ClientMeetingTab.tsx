import { useState, useMemo } from "react";
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
import { Calendar as CalendarIcon, Clock, Users, CheckCircle2, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { he } from "date-fns/locale";

interface ClientMeetingTabProps {
  client: any;
  tenantId?: string;
}

export function ClientMeetingTab({ client, tenantId }: ClientMeetingTabProps) {
  const queryClient = useQueryClient();
  const meetingScheduler = useMeetingScheduler(tenantId);
  const [selectedMeetingEmails, setSelectedMeetingEmails] = useState<string[]>([]);

  const { data: clientContacts } = useQuery({
    queryKey: ["client-contacts", client.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_contacts")
        .select("*")
        .eq("client_id", client.id)
        .order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!client.id,
  });

  const allContactEmails = useMemo(() => {
    const emails: { email: string; name: string; source: string }[] = [];
    if (client.email) {
      emails.push({ email: client.email, name: client.contact_name || client.name, source: "ראשי" });
    }
    clientContacts?.forEach((c: any) => {
      if (c.email) {
        emails.push({ email: c.email, name: c.contact_name, source: c.role || "נוסף" });
      }
    });
    return emails;
  }, [client.email, client.contact_name, client.name, clientContacts]);

  const timeSlots = meetingScheduler.getAvailableTimeSlots();

  const handleScheduleMeeting = async () => {
    await meetingScheduler.scheduleMeeting({
      contactName: client.name,
      contactEmail: client.email,
      contactId: client.id,
      contactType: 'client',
      additionalEmails: selectedMeetingEmails,
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["clients"] });
        setSelectedMeetingEmails([]);
      },
    });
  };

  return (
    <div className="space-y-4" dir="rtl">
      <h4 className="text-sm font-medium flex items-center gap-2">
        <CalendarIcon className="h-4 w-4" />
        קביעת פגישה עם לקוח
      </h4>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Calendar Side */}
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

        {/* Details Side */}
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              שעה
            </label>
            <Select value={meetingScheduler.meetingTime} onValueChange={meetingScheduler.setMeetingTime}>
              <SelectTrigger className="w-full text-right rounded-lg border-2 h-11">
                <SelectValue placeholder="בחר שעה" />
              </SelectTrigger>
              <SelectContent className="bg-background z-50 max-h-[200px]">
                {meetingScheduler.isLoadingCalendar ? (
                  <SelectItem value="loading" disabled>טוען יומן...</SelectItem>
                ) : meetingScheduler.calendarError ? (
                  <SelectItem value="error" disabled>{meetingScheduler.calendarError}</SelectItem>
                ) : (
                  timeSlots.map(({ time, available }) => (
                    <SelectItem
                      key={time}
                      value={time}
                      disabled={!available}
                      className={!available ? "text-muted-foreground line-through" : ""}
                    >
                      {time} {!available && "(תפוס)"}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">נושא הפגישה</label>
            <Input
              value={meetingScheduler.meetingSubject}
              onChange={(e) => meetingScheduler.setMeetingSubject(e.target.value)}
              placeholder={`פגישה עם ${client.name}`}
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

          {/* Attendee selection */}
          {allContactEmails.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                שלח זימון ל:
              </label>
              <div className="space-y-1.5">
                {allContactEmails.map((contact) => (
                  <label key={contact.email} className="flex items-center gap-2 p-2 rounded-md bg-muted/50 cursor-pointer text-sm">
                    <Checkbox
                      checked={selectedMeetingEmails.includes(contact.email)}
                      onCheckedChange={(checked) => {
                        setSelectedMeetingEmails(prev =>
                          checked
                            ? [...prev, contact.email]
                            : prev.filter(e => e !== contact.email)
                        );
                      }}
                    />
                    <span className="font-medium">{contact.name}</span>
                    <span className="text-muted-foreground">({contact.source})</span>
                    <span className="text-muted-foreground mr-auto">{contact.email}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {allContactEmails.length === 0 && (
            <div className="bg-muted/50 border rounded-lg p-3 text-sm text-muted-foreground">
              אין אנשי קשר עם אימייל — הזימון לא יישלח במייל
            </div>
          )}

          {/* Summary Card */}
          {meetingScheduler.meetingDate && (
            <Card className="p-4 bg-primary/5 border-primary/20">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span className="font-medium">
                  {format(meetingScheduler.meetingDate, 'EEEE, d בMMMM yyyy', { locale: he })} בשעה {meetingScheduler.meetingTime}
                </span>
              </div>
            </Card>
          )}

          <Button
            onClick={handleScheduleMeeting}
            disabled={!meetingScheduler.meetingDate || !meetingScheduler.meetingTime || meetingScheduler.isSchedulingMeeting}
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
                {selectedMeetingEmails.length > 0 ? `קבע פגישה ושלח זימון ל-${selectedMeetingEmails.length} אנשי קשר` : "קבע פגישה"}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
