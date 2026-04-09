

# תיקון: קמפיינים של וואטסאפ מציגים 0 לידים

## הבעיה
קמפיינים מסוג WhatsApp/Messaging משתמשים בסוגי המרות שונים מקמפייני לידים רגילים. פייסבוק מדווח עליהם כ-`onsite_conversion.messaging_conversation_started_7d`, `messaging_conversation_started_7d` וכדומה — אבל הסנכרון לא סופר אותם כ"לידים".

## התיקון

### קובץ: `supabase/functions/sync-facebook-insights/index.ts`

**הוספת סוגי המרות messaging ל-`leadActionTypes`** (שורה ~242):

```typescript
const leadActionTypes = [
  'lead',
  'leadgen_grouped',
  'offsite_conversion.fb_pixel_lead',
  'onsite_conversion.lead_grouped',
  'app_custom_event.fb_mobile_lead',
  // WhatsApp / Messaging conversions
  'onsite_conversion.messaging_conversation_started_7d',
  'messaging_conversation_started_7d',
  'onsite_conversion.messaging_first_reply',
  'messaging_first_reply',
];
```

כך קמפיינים של וואטסאפ/מסנג'ר ייספרו כלידים, ועלות לליד תחושב בהתאם.

## תוצאה
קמפיין "וואטסאפ חדש" יציג את מספר שיחות הוואטסאפ שנפתחו כלידים במקום 0.

