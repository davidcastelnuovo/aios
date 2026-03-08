

# תוכנית: טריגר הודעת WhatsApp נכנסת (Green API) באוטומציות

## סקירה

הוספת טריגר חדש `whatsapp_message_received` למודול האוטומציות והפלוו, שמופעל כשמתקבלת הודעת WhatsApp דרך Green API. הטריגר יתמוך בסינון לפי:
1. **מזהה קבוצה** — רק הודעות מקבוצה ספציפית
2. **מילת מפתח** — הודעות שמכילות מילה/ביטוי מסוים
3. **זיהוי איש קשר מתויג** — הודעות מלידים/לקוחות שמתויגים בטאג מסוים
4. **חבר צוות** — הודעות ממשתמש צוות ספציפי (לפי connection_user_id)

## שינויים נדרשים

### 1. StepConfigPanel.tsx — הוספת טריגר + UI קונפיגורציה

- הוספת `{ value: "whatsapp_message_received", label: "הודעת WhatsApp נכנסת" }` ל-`TRIGGER_OPTIONS`
- הוספת שדות available fields: `sender_name`, `sender_phone`, `message_text`, `group_name`, `contact_type`, `contact_id`
- בניית קומפוננטת `WhatsAppTriggerConfig` עם:
  - **מקור**: כל ההודעות / קבוצה ספציפית / איש קשר מתויג
  - **בחירת קבוצה**: dropdown מ-`whatsapp_groups` (כשנבחר "קבוצה ספציפית")
  - **בחירת טאג**: dropdown מ-`chat_tags` (כשנבחר "איש קשר מתויג")
  - **מילת מפתח**: שדה טקסט חופשי (אופציונלי, חל על כל המקורות)
  - **חיבור Green API**: בחירת חיבור ספציפי מ-`tenant_integrations`

### 2. green-api-webhook/index.ts — הפעלת טריגר אוטומציות

בסוף עיבוד הודעה נכנסת (incoming), לפני ה-return, להוסיף קריאה ל-`trigger-automation`:

```
trigger_type: "whatsapp_message_received"
data: {
  sender_name, sender_phone, message_text,
  group_name, group_id, group_chat_id,
  contact_type, contact_id (lead/client),
  connection_user_id,
  tags: [tag_ids of the contact]
}
```

### 3. trigger-automation/index.ts — תמיכה בסינון הטריגר החדש

הוספת לוגיקת סינון ב-`trigger-automation` עבור `whatsapp_message_received`:
- בדיקת `conditions.group_id` — התאמה למזהה קבוצה
- בדיקת `conditions.keyword` — חיפוש מילת מפתח בתוכן ההודעה (case-insensitive)
- בדיקת `conditions.tag_id` — האם לאיש הקשר יש את הטאג הנדרש
- בדיקת `conditions.connection_user_id` — התאמה לחיבור ספציפי

### קבצים לעדכון
1. `src/components/automations/StepConfigPanel.tsx` — טריגר חדש + UI
2. `supabase/functions/green-api-webhook/index.ts` — שליחת trigger event
3. `supabase/functions/trigger-automation/index.ts` — סינון conditions

