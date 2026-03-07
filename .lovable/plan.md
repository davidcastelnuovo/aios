

# תכנית: AIOS - עוזר AI מרכזי בפופאפ

## סקירה
הפיכת עוזר ה-AI מעמוד נפרד לכפתור בהדר שפותח Dialog/Drawer מרכזי. שדרוג הכלים שלו כך שיתמוך בפעולות נוספות: יצירת אוטומציות, שליחת הודעות, ניהול לידים ועוד.

## שינויים

### 1. רכיב AIOS Dialog חדש
**קובץ חדש: `src/components/AIOSDialog.tsx`**
- רכיב Dialog (מ-Radix) שמכיל את כל הלוגיקה הקיימת מ-`AISupport.tsx` (שיחות, streaming, הודעות)
- עיצוב מותאם לפופאפ: גובה `80vh`, רוחב `max-w-2xl`
- סיידבר שיחות בתוך Sheet (גם בדסקטופ)
- שם "AIOS" במקום "עוזר AI תמיכה טכנית"

### 2. כפתור AIOS בהדר
**קובץ: `src/components/layout/AppLayout.tsx`**
- הוספת כפתור עם אייקון Bot/Sparkles ליד כפתור הלוגו בהדר
- לחיצה פותחת את `AIOSDialog`
- Badge עם אנימציית pulse אופציונלי

### 3. הסרה מהתפריט והניתוב
**קבצים: `src/App.tsx`, `src/components/layout/AppSidebar.tsx`**
- הסרת הנתיב `/t/:tenantSlug/ai-support`
- הסרת הפריט מתפריט הצד
- (שמירת `AISupport.tsx` כ-fallback או מחיקתו)

### 4. שדרוג Edge Function עם כלים נוספים
**קובץ: `supabase/functions/ai-support-chat/index.ts`**
- מעבר מ-OpenAI ישיר ל-**Lovable AI Gateway** (הקוד הנוכחי משתמש ב-`api.openai.com` ישירות!)
- הוספת כלים חדשים:
  - **`create_automation`** - יצירת אוטומציה חדשה עם trigger ושלבים
  - **`send_message`** - שליחת הודעת WhatsApp/ManyChat ללקוח/ליד
  - **`create_lead`** - יצירת ליד חדש
  - **`update_lead_status`** - עדכון סטטוס ליד
  - **`list_leads`** - הצגת לידים
  - **`list_clients`** - הצגת לקוחות
  - **`create_client`** - יצירת לקוח חדש
  - **`search_leads`** - חיפוש לידים
- עדכון System Prompt ל-"AIOS" עם הכלים החדשים

### 5. עדכון ה-System Prompt
- שינוי השם ל-AIOS
- הוספת תיאור הכלים החדשים
- הנחיות לסוכן: לפני שליחת הודעה לחפש את איש הקשר, לפני יצירת אוטומציה לוודא פרטים

## סדר ביצוע
1. יצירת `AIOSDialog.tsx` (העתקת לוגיקה מ-AISupport + התאמה לפופאפ)
2. הוספת כפתור בהדר ב-`AppLayout.tsx`
3. הסרה מתפריט וניתוב
4. שדרוג Edge Function: מעבר ל-Lovable AI + כלים חדשים
5. Deploy

## פרטים טכניים

### מעבר ל-Lovable AI Gateway
הקוד הנוכחי משתמש ב-`OPENAI_API_KEY` עם `api.openai.com`. נעביר ל-Lovable AI Gateway (`ai.gateway.lovable.dev`) עם `LOVABLE_API_KEY` ומודל `google/gemini-3-flash-preview` (מהיר, תומך tool calling).

### כלי create_automation
```text
parameters:
  - name: שם האוטומציה
  - trigger_type: lead_status_changed | task_status_changed | manual_command | ...
  - action_type: send_whatsapp | create_task | add_update | ...
  - action_config: הגדרות הפעולה (template, etc.)
```

### כלי send_message  
```text
parameters:
  - contact_type: lead | client
  - contact_id: UUID
  - message: תוכן ההודעה
  - provider: manychat | green_api (אוטומטי לפי tenant_integrations)
```

