

# תוכנית: טריגר "פקודה ידנית" (Chat Command) לאוטומציות

## סקירה
הוספת סוג טריגר חדש `manual_command` שמאפשר למשתמש להפעיל אוטומציה ידנית דרך תיבת טקסט (כמו צ'אט). המשתמש כותב הוראה חופשית, וזה מטריג את האוטומציה עם הטקסט כפרמטר.

## שינויי קוד

### 1. StepConfigPanel.tsx
- הוספת טריגר חדש לרשימת `TRIGGER_OPTIONS`:
  ```
  { value: "manual_command", label: "פקודה ידנית (צ'אט)" }
  ```
- הוספת שדות זמינים עבור הטריגר החדש ב-`getAvailableFields`:
  - `command_text` - טקסט הפקודה
  - `user_name` - שם המשתמש שהפעיל
- הוספת קונפיגורציה ייעודית לטריגר: תיאור/הסבר מה הפקודה עושה, placeholder לדוגמה

### 2. FlowNode.tsx
- הוספת `manual_command` ל-`ACTION_TYPE_LABELS`:
  ```
  manual_command: "פקודה ידנית"
  ```

### 3. FlowEditor.tsx
- הוספת כפתור "הפעל ידנית" (אייקון `MessageSquare`) בכותרת העורך, שנראה רק כשהטריגר הוא `manual_command`
- לחיצה על הכפתור פותחת דיאלוג `ManualTriggerDialog` עם:
  - תיבת טקסט לכתיבת הפקודה/הוראה
  - כפתור "הפעל" שקורא ל-Edge Function `trigger-automation` עם `automationId` + `command_text`

### 4. קומפוננטה חדשה: ManualTriggerDialog
- דיאלוג פשוט עם:
  - Textarea לכתיבת ההוראה
  - כפתור שליחה
  - קריאה ל-`trigger-automation` עם הנתונים

## ללא שינויי DB
הטריגר `manual_command` ישתמש בתשתית הקיימת של `trigger-automation` Edge Function שכבר תומך ב-direct execution mode עם `automationId`.

## סיכום
שינוי ב-3 קבצים קיימים + דיאלוג חדש קטן. ללא מיגרציות.

