

# שינוי ברירת מחדל: קליטת לידים מ-Facebook Webhook במקום חיפוש

## מצב נוכחי
- ה-`facebook-lead-webhook` כבר יוצר לידים ומפעיל `trigger_type: 'lead_created'` (שורה 397 ב-facebook-lead-webhook)
- **אבל** הוא **לא** מפעיל את `inbound_webhook_lead` כמו שה-`webhook-maskyoo-intake` עושה
- בטריגר של האוטומציות, `inbound_webhook_lead` מופיע כ-"קליטת ליד מ-Webhook (מסקיו)" - צריך לשנות לטקסט כללי יותר
- ב-`TRIGGER_LABELS` בדף Automations חסר `inbound_webhook_lead` לגמרי

## מה צריך לשנות

### 1. Facebook Lead Webhook - הוספת trigger `inbound_webhook_lead`
בקובץ `supabase/functions/facebook-lead-webhook/index.ts`, אחרי שליד נוצר (שורה ~392), נוסיף trigger נוסף של `inbound_webhook_lead` (בדיוק כמו שעושה `webhook-maskyoo-intake`), כך שאוטומציות מסוג זה יופעלו גם מלידים של פייסבוק.

### 2. שינוי טקסט הטריגר
- `AddAutomationForm.tsx` שורה 120: לשנות מ-"קליטת ליד מ-Webhook (מסקיו)" ל-**"קליטת ליד מ-Webhook"**
- `EditAutomationDialog.tsx` שורה 420: אותו שינוי
- `Automations.tsx` שורה 44 (TRIGGER_LABELS): להוסיף `inbound_webhook_lead: "קליטת ליד מ-Webhook"`

### 3. לגבי צד פייסבוק
**לא צריך לשנות שום דבר בפייסבוק** - ה-webhook כבר מוגדר ועובד. השינוי הוא רק בצד שלנו - להוסיף trigger נוסף כשליד מגיע מפייסבוק, כדי שאוטומציות `inbound_webhook_lead` יופעלו גם מלידים של פייסבוק ולא רק ממסקיו.

## סיכום השינויים
| קובץ | שינוי |
|-------|-------|
| `facebook-lead-webhook/index.ts` | הוספת `inbound_webhook_lead` trigger לאחר יצירת ליד |
| `AddAutomationForm.tsx` | שינוי label ל-"קליטת ליד מ-Webhook" |
| `EditAutomationDialog.tsx` | שינוי label ל-"קליטת ליד מ-Webhook" |
| `Automations.tsx` | הוספת `inbound_webhook_lead` ל-TRIGGER_LABELS |

