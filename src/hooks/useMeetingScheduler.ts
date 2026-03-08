import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { he } from "date-fns/locale";

/**
 * Hook לניהול קביעת פגישות עם יומן Google
 * משותף בין EditLeadDialog ו-EditClientDialog
 */
export function useMeetingScheduler(tenantId?: string) {
  const [meetingDate, setMeetingDate] = useState<Date | undefined>(undefined);
  const [meetingTime, setMeetingTime] = useState("10:00");
  const [meetingSubject, setMeetingSubject] = useState("");
  const [meetingLocation, setMeetingLocation] = useState("");
  const [personalMessage, setPersonalMessage] = useState("");
  const [isSchedulingMeeting, setIsSchedulingMeeting] = useState(false);
  const [isLoadingCalendar, setIsLoadingCalendar] = useState(false);
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [calendarError, setCalendarError] = useState<string | null>(null);

  /**
   * טעינת אירועי יומן לתאריך נתון
   */
  const fetchCalendarEvents = async (selectedDate: Date) => {
    setIsLoadingCalendar(true);
    setCalendarError(null);
    setCalendarEvents([]);

    try {
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);

      const { data, error } = await supabase.functions.invoke('get-calendar-events', {
        body: {
          timeMin: startOfDay.toISOString(),
          timeMax: endOfDay.toISOString(),
        },
      });

      if (error) throw error;

      if (data?.needsReconnect) {
        setCalendarError('היומן לא מחובר. יש לחבר את יומן Google.');
        return;
      }

      if (data?.events) {
        setCalendarEvents(data.events);
      }
    } catch (err: any) {
      console.error('Error fetching calendar events:', err);
      setCalendarError(err.message || 'שגיאה בטעינת היומן');
    } finally {
      setIsLoadingCalendar(false);
    }
  };

  /**
   * טיפול בבחירת תאריך
   */
  const handleDateSelect = (date: Date | undefined) => {
    setMeetingDate(date);
    if (date) {
      fetchCalendarEvents(date);
    } else {
      setCalendarEvents([]);
    }
  };

  /**
   * יצירת רשימת שעות אפשריות (7:00 - 21:30)
   */
  const generateTimeOptions = (): string[] => {
    const options: string[] = [];
    for (let h = 7; h <= 21; h++) {
      for (let m = 0; m < 60; m += 30) {
        options.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
      }
    }
    return options;
  };

  /**
   * מציאת שעות פנויות על בסיס אירועי היומן
   */
  const getAvailableTimeSlots = () => {
    const allTimeOptions = generateTimeOptions();

    if (!meetingDate || calendarEvents.length === 0) {
      return allTimeOptions.map(time => ({ time, available: true }));
    }

    return allTimeOptions.map(time => {
      const [hours, minutes] = time.split(':').map(Number);
      const slotStart = new Date(meetingDate);
      slotStart.setHours(hours, minutes, 0, 0);
      const slotEnd = new Date(slotStart);
      slotEnd.setMinutes(slotEnd.getMinutes() + 30);

      // בדיקה אם השעה תפוסה (מתעלמים מאירועים של כל היום)
      const isOccupied = calendarEvents.some(event => {
        if (!event.start?.dateTime || !event.end?.dateTime) {
          return false; // Skip all-day events
        }
        const eventStart = new Date(event.start.dateTime);
        const eventEnd = new Date(event.end.dateTime);
        return slotStart < eventEnd && slotEnd > eventStart;
      });

      return { time, available: !isOccupied };
    });
  };

  /**
   * קביעת פגישה
   */
  const scheduleMeeting = async (params: {
    contactName: string;
    contactEmail?: string;
    contactId: string;
    contactType: 'lead' | 'client';
    additionalEmails?: string[];
    onSuccess?: () => void;
  }) => {
    const { contactName, contactEmail, contactId, contactType, additionalEmails, onSuccess } = params;

    if (!meetingDate || !meetingTime) {
      toast.error("נא לבחור תאריך ושעה");
      return;
    }

    setIsSchedulingMeeting(true);

    try {
      const [hours, minutes] = meetingTime.split(':').map(Number);
      const startDateTime = new Date(meetingDate);
      startDateTime.setHours(hours, minutes, 0, 0);

      const endDateTime = new Date(startDateTime);
      endDateTime.setHours(startDateTime.getHours() + 1);

      const subject = meetingSubject || `פגישה עם ${contactName}`;
      const attendees = [
        ...(contactEmail ? [contactEmail] : []),
        ...(additionalEmails || []),
      ].filter((email, index, self) => self.indexOf(email) === index); // dedupe

      // יצירת אירוע ביומן
      const { error: calendarError } = await supabase.functions.invoke('add-calendar-event', {
        body: {
          summary: subject,
          description: personalMessage || `פגישה עם ${contactType === 'lead' ? 'ליד' : 'לקוח'}: ${contactName}`,
          start: startDateTime.toISOString(),
          end: endDateTime.toISOString(),
          attendees,
          location: meetingLocation || undefined,
        }
      });

      if (calendarError) {
        console.error('Calendar error:', calendarError);
        toast.error("שגיאה ביצירת הפגישה ביומן");
        return;
      }

      // עדכון פרטי הפגישה בליד (אם זה ליד)
      if (contactType === 'lead') {
        const meetingDateFormatted = format(meetingDate, "yyyy-MM-dd");
        const { error: updateError } = await supabase
          .from("leads")
          .update({
            meeting_set_date: new Date().toISOString(),
            meeting_date: meetingDateFormatted,
            meeting_time: meetingTime,
            meeting_location: meetingLocation || subject,
            meeting_reminder_day_after_sent_at: null,
            meeting_reminder_same_day_sent_at: null,
          })
          .eq("id", contactId);

        if (updateError) {
          console.error('Error saving meeting details:', updateError);
        }
      }

      // הפעלת אוטומציות
      if (tenantId) {
        try {
          const formattedDate = format(meetingDate, "dd/MM/yyyy");
          await supabase.functions.invoke('trigger-automation', {
            body: {
              trigger_type: 'meeting_created',
              tenant_id: tenantId,
              data: {
                [`${contactType}_id`]: contactId,
                contact_name: contactName,
                meeting_date: formattedDate,
                meeting_time: meetingTime,
                meeting_location: meetingLocation || subject,
              }
            }
          });
        } catch (autoErr) {
          console.error('Automation trigger error:', autoErr);
        }
      }

      if (contactEmail) {
        toast.success("הפגישה נוצרה וזימון נשלח למייל!");
      } else {
        toast.success("הפגישה נוספה ליומן!");
      }

      // איפוס הטופס
      resetForm();

      // קריאה לפונקציית הצלחה
      if (onSuccess) {
        onSuccess();
      }

    } catch (error: any) {
      console.error('Meeting scheduling error:', error);
      toast.error(`שגיאה בקביעת פגישה: ${error.message}`);
    } finally {
      setIsSchedulingMeeting(false);
    }
  };

  /**
   * איפוס הטופס
   */
  const resetForm = () => {
    setMeetingDate(undefined);
    setMeetingTime("10:00");
    setMeetingSubject("");
    setPersonalMessage("");
    setMeetingLocation("");
  };

  return {
    // State
    meetingDate,
    setMeetingDate,
    meetingTime,
    setMeetingTime,
    meetingSubject,
    setMeetingSubject,
    meetingLocation,
    setMeetingLocation,
    personalMessage,
    setPersonalMessage,
    isSchedulingMeeting,
    isLoadingCalendar,
    calendarEvents,
    calendarError,

    // Functions
    handleDateSelect,
    getAvailableTimeSlots,
    scheduleMeeting,
    resetForm,
  };
}
