

# תכנית: הוספת "הוראה ספציפית" לשלב סוכן AI באוטומציה

## בעיה
כרגע שלב סוכן AI באוטומציה לא מאפשר להגדיר מה בדיוק הסוכן צריך לעשות. ה-`command_text` נשלח מה-payload או נופל לברירת מחדל גנרית ("הפעל את האוטומציה"). אין דרך לכתוב הוראה ספציפית כמו "פרמט את מספר הטלפון", "תרגם שם לעברית", "הפרד שם פרטי ומשפחה" וכו'.

## פתרון

### שינוי 1: UI - הוספת שדה "הוראה לסוכן" ב-`AgentStepConfig`
**קובץ: `src/components/automations/StepConfigPanel.tsx`**

- הוספת `Textarea` בשם "הוראה / משימה לשלב זה" מתחת לבחירת הסוכן
- השדה יישמר ב-`configuration.step_instruction`
- הוספת כפתורי "הכנס משתנה" (מתוך `getAvailableFields`) כדי שאפשר לכתוב הוראות כמו:
  - `פרמט את הטלפון {{phone}} לפורמט +972XXXXXXXXX`
  - `הפרד את {{contact_name}} לשם פרטי ושם משפחה, החזר JSON`
  - `תרגם את {{contact_name}} לעברית`
- הוספת דוגמאות מוכנות (quick templates) שאפשר ללחוץ עליהן:
  - 📱 פרמוט טלפון
  - ✂️ הפרדת שם פרטי/משפחה
  - 🌐 תרגום לעברית
  - 📝 סיכום טקסט
  - 🔄 המרת פורמט

### שינוי 2: Backend - שימוש ב-`step_instruction` כ-`command_text`
**קובץ: `supabase/functions/trigger-automation/index.ts`**

- בשורה 320, לפני שליחת ה-`command_text` לסוכן, לבדוק אם יש `stepConfig.step_instruction`
- אם כן — לבצע variable replacement על ה-instruction (להחליף `{{phone}}`, `{{contact_name}}` וכו' בערכים מה-payload) ולשלוח כ-`command_text`
- אם לא — fallback להתנהגות הנוכחית

### שינוי 3: הוספת שדה "פורמט תשובה"
**קובץ: `src/components/automations/StepConfigPanel.tsx`**

- הוספת Select לבחירת פורמט תשובה צפוי:
  - טקסט חופשי (ברירת מחדל)
  - JSON (מובנה)
  - ערך בודד
- נשמר ב-`configuration.output_format`
- מועבר לסוכן כחלק מה-instruction (למשל "החזר תשובה בפורמט JSON בלבד")

## קבצים לעריכה
1. `src/components/automations/StepConfigPanel.tsx` — UI של שלב הסוכן
2. `supabase/functions/trigger-automation/index.ts` — שימוש ב-step_instruction + variable replacement

## פרטים טכניים
- ה-`AgentStepConfig` יקבל prop נוסף: `availableFields` (מ-`getAvailableFields`) + `triggerConfig`
- ה-variable replacement בצד ה-backend כבר קיים ברמת ה-`stepData` (שורה 290-301), צריך רק להפעיל אותו על `step_instruction`

