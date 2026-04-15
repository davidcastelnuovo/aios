

# תוכנית: אנימציית עבודה לכרמן + תיקון יכולת ביצוע משימות ארוכות

## הבעיות שזוהו

### 1. אין אינדיקציה חזותית שכרמן עובדת
כרגע יש רק נקודה ירוקה קבועה עם `animate-pulse`. אין הבדל בין "כרמן זמינה" ל"כרמן עובדת".

### 2. כרמן לא יכולה לבצע את המשימה שהיא טוענת
המשימה של חיבור 75 לקוחות לטבלאות Google Ads/Meta Ads דורשת כלים שקיימים רק ב-`run-ai-agent` אבל **לא קיימים ב-`ai-support-chat`** (שזה מה שה-AIOS Dialog משתמש בו):
- `list_unconnected_clients` — לא קיים
- `create_facebook_report_table` — לא קיים  
- `create_google_ads_table` — לא קיים

כלומר כרמן "מדברת" על ביצוע המשימה אבל אין לה את הכלים לעשות את זה בפועל.

בנוסף, גם אם נוסיף את הכלים, עם 75 לקוחות מגבלת ה-25 סבבים ב-`MAX_TOOL_ROUNDS` עלולה לא להספיק.

---

## התיקון

### חלק 1: אנימציית "כרמן עובדת" (גלואו)

**קובץ: `src/components/layout/AppLayout.tsx`**
- הוספת state `carmenWorking` שמתחבר ל-`isStreaming` מה-AIOSDialog
- כשכרמן עובדת: הוספת ring animation זוהר (emerald glow) סביב האווטאר שלה בהדר
- שימוש ב-CSS animation עם `box-shadow` ירוק מהבהב עדין

**קובץ: `tailwind.config.ts`**
- הוספת keyframe חדש `carmen-glow` עם אפקט glow ירוק עדין

**קובץ: `src/components/AIOSDialog.tsx`**
- חשיפת `isStreaming` כ-callback ל-AppLayout (דרך prop `onWorkingChange`)

### חלק 2: הוספת כלים חסרים ל-ai-support-chat

**קובץ: `supabase/functions/ai-support-chat/index.ts`**
- הוספת הגדרות כלים: `list_unconnected_clients`, `create_facebook_report_table`, `create_google_ads_table` (לטבלאות Google Ads)
- הוספת ה-executeTool handlers עבור כל כלי
- **הגדלת MAX_TOOL_ROUNDS** מ-25 ל-50 כדי לאפשר לופ ארוך יותר על 75 לקוחות

### חלק 3: כלי batch לחיבור טבלאות (Google Ads + Meta)

**קובץ: `supabase/functions/ai-support-chat/index.ts`**
- הוספת כלי `batch_create_report_tables` שמקבל מערך של `{client_id, ad_account_id, ad_account_name, type: 'meta'|'google_ads'}` ויוצר את כל הטבלאות בקריאה אחת
- זה חוסך עשרות סבבים — במקום קריאת tool נפרדת לכל לקוח

