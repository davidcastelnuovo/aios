import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { getCalendarEvents, addCalendarEvent } from "@/lib/calendarApi";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";

/**
 * Hook לניהול קביעת פגישות עם יומן Google (דרך Unified)
 * משותף בין EditLeadDialog ו-EditClientDialog
 */
export function useMeetingScheduler(tenantId?: string) {
  const [meetingDate, setMeetingDate] = useState<Date | undefined>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });
  const [meetingTime, setMeetingTime] = useState("10:00");
  const [meetingEndTime, setMeetingEndTime] = useState("11:00");
  const [meetingSubject, setMeetingSubject] = useState("");
  const [meetingLocation, setMeetingLocation] = useState("");
  const [personalMessage, setPersonalMessage] = useState("");
  const [isSchedulingMeeting, setIsSchedulingMeeting] = useState(false);
  const [isLoadingCalendar, setIsLoadingCalendar] = useState(false);
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [calendarError, setCalendarError] = useState<string | null>(null);

  /**
   * טעינת אירועי יומן לתאריך נתון (דרך Unified)
   */
  const fetchCalendarEvents = async (selectedDate: Date) => {
    if (!tenantId) return;
    setIsLoadingCalendar(true);
    setCalendarError(null);
    setCalendarEvents([]);

    try {
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);

      const data = await getCalendarEvents(
        startOfDay.toISOString(),
        endOfDay.toISOString(),
        { tenantId }
      );

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
   * יצירת רשימת שעות סיום אפשריות לפי שעת התחלה
   */
  const generateEndTimeOptions = (startTime: string): string[] => {
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const cursor = new Date();
    cursor.setHours(startHour, startMinute, 0, 0);
    cursor.setMinutes(cursor.getMinutes() + 30);

    const maxEnd = new Date();
    maxEnd.setHours(23, 30, 0, 0);

    const options: string[] = [];
    while (cursor <= maxEnd) {
      options.push(`${cursor.getHours().toString().padStart(2, '0')}:${cursor.getMinutes().toString().padStart(2, '0')}`);
      cursor.setMinutes(cursor.getMinutes() + 30);
    }

    return options;
  };

  /**
   * עדכון אוטומטי של שעת סיום כששעת התחלה משתנה
   */
  useEffect(() => {
    if (!meetingTime) return;

    const [startHour, startMinute] = meetingTime.split(':').map(Number);
    const nextHour = new Date();
    nextHour.setHours(startHour, startMinute, 0, 0);
    nextHour.setMinutes(nextHour.getMinutes() + 60);

    const suggestedEnd = `${nextHour.getHours().toString().padStart(2, '0')}:${nextHour
      .getMinutes()
      .toString()
      .padStart(2, '0')}`;

    if (!meetingEndTime || meetingEndTime <= meetingTime) {
      setMeetingEndTime(suggestedEnd);
    }
  }, [meetingTime, meetingEndTime]);

  /**
   * מציאת שעות פנויות על בסיס אירועי היומן
   */
  const getAvailableTimeSlots = () => {
    const allTimeOptions = generateTimeOptions();

    if (!meetingDate || calendarEvents.length === 0 || calendarError) {
      return allTimeOptions.map(time => ({ time, available: true }));
    }

    return allTimeOptions.map(time => {
      const [hours, minutes] = time.split(':').map(Number);
      const slotStart = new Date(meetingDate);
      slotStart.setHours(hours, minutes, 0, 0);
      const slotEnd = new Date(slotStart);
      slotEnd.setMinutes(slotEnd.getMinutes() + 30);

      const isOccupied = calendarEvents.some(event => {
        if (!event.start?.dateTime || !event.end?.dateTime) {
          return false;
        }
        const eventStart = new Date(event.start.dateTime);
        const eventEnd = new Date(event.end.dateTime);
        return slotStart < eventEnd && slotEnd > eventStart;
      });

      return { time, available: !isOccupied };
    });
  };

  /**
   * מציאת שעות סיום אפשריות על בסיס שעת התחלה ואירועי יומן
   */
  const getAvailableEndTimeSlots = () => {
    if (!meetingDate || !meetingTime) {
      return [] as { time: string; available: boolean }[];
    }

    const [startHours, startMinutes] = meetingTime.split(':').map(Number);
    const startDateTime = new Date(meetingDate);
    startDateTime.setHours(startHours, startMinutes, 0, 0);

    const endOptions = generateEndTimeOptions(meetingTime);

    if (calendarEvents.length === 0 || calendarError) {
      return endOptions.map(time => ({ time, available: true }));
    }

    return endOptions.map(time => {
      const [endHours, endMinutes] = time.split(':').map(Number);
      const candidateEnd = new Date(meetingDate);
      candidateEnd.setHours(endHours, endMinutes, 0, 0);

      const hasConflict = calendarEvents.some(event => {
        if (!event.start?.dateTime || !event.end?.dateTime) {
          return false;
        }
        const eventStart = new Date(event.start.dateTime);
        const eventEnd = new Date(event.end.dateTime);
        return startDateTime < eventEnd && candidateEnd > eventStart;
      });

      return { time, available: !hasConflict };
    });
  };

  /**
   * קביעת פגישה (דרך Unified)
   */
  const scheduleMeeting = async (params: {
    contactName: string;
    contactEmail?: string;
    contactId: string;
    contactType: 'lead' | 'client' | 'campaigner';
    additionalEmails?: string[];
    onSuccess?: () => void;
  }) => {
    const { contactName, contactEmail, contactId, contactType, additionalEmails, onSuccess } = params;

    if (!meetingDate || !meetingTime || !meetingEndTime) {
      toast.error("נא לבחור תאריך ושעה");
      return;
    }

    if (!tenantId) {
      toast.error("לא נמצא ארגון פעיל");
      return;
    }

    setIsSchedulingMeeting(true);

    try {
      const [hours, minutes] = meetingTime.split(':').map(Number);
      const startDateTime = new Date(meetingDate);
      startDateTime.setHours(hours, minutes, 0, 0);

      const [endHours, endMinutes] = meetingEndTime.split(':').map(Number);
      const endDateTime = new Date(meetingDate);
      endDateTime.setHours(endHours, endMinutes, 0, 0);

      if (endDateTime <= startDateTime) {
        toast.error("שעת הסיום חייבת להיות אחרי שעת ההתחלה");
        return;
      }

      const subject = meetingSubject || `פגישה עם ${contactName}`;
      const attendees = [
        ...(contactEmail ? [contactEmail] : []),
        ...(additionalEmails || []),
      ].filter((email, index, self) => self.indexOf(email) === index);

      // יצירת אירוע ביומן דרך Unified
      await addCalendarEvent(
        {
          summary: subject,
          description: personalMessage || `פגישה עם ${contactType === 'lead' ? 'ליד' : 'לקוח'}: ${contactName}`,
          start: startDateTime.toISOString(),
          end: endDateTime.toISOString(),
          attendees,
        },
        { tenantId }
      );

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

      resetForm();

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
    setMeetingEndTime("11:00");
    setMeetingSubject("");
    setPersonalMessage("");
    setMeetingLocation("");
  };

  return {
    meetingDate,
    setMeetingDate,
    meetingTime,
    setMeetingTime,
    meetingEndTime,
    setMeetingEndTime,
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
    handleDateSelect,
    getAvailableTimeSlots,
    getAvailableEndTimeSlots,
    scheduleMeeting,
    resetForm,
  };
}
