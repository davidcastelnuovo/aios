## הבעיה

האוטומציה של כרמן הוגדרה נכון: `carmen_scope_mode = specific_group` ורשימת `carmen_allowed_group_ids` מכילה מזהי צ׳אט (`120363...@g.us`).

אבל ה-webhook (`green-api-webhook`) שולח ל-`trigger-automation` payload עם:
- `group_id` = ה-UUID של הקבוצה ב-DB (`whatsapp_groups.id`)
- `group_chat_id` = המזהה של ווטסאפ (`@g.us`)

הבדיקה ב-`trigger-automation/index.ts` (שורה 276) משווה `safeData.group_id` (UUID) מול `carmen_allowed_group_ids` (`@g.us`) — תמיד נכשל → הטריגר נדחה עם `carmen_scope_group_mismatch` ולכן כרמן לא עונה (אין שום `automation_executions` חדש לטננט).

אותה בעיה קיימת גם בבדיקות הרגילות:
- שורה 327: `safeConfig.group_id !== safeData.group_id`
- שורה 348-371: `source_filter` שמשתמש ב-`selected_group_ids` / `excluded_group_ids` (גם שם נשמרים `@g.us` ב-UI).

## התיקון

ב-`supabase/functions/trigger-automation/index.ts`, להתאים את כל השוואות הקבוצות כך שיתאימו גם ל-`group_chat_id` וגם ל-`group_id` (UUID):

```text
const candidates = [safeData.group_id, safeData.group_chat_id].filter(Boolean)
const matches = allowedGroupIds.some(id => candidates.includes(id))
```

מקומות לעדכן:
1. בדיקת `carmen_scope_mode === 'specific_group'` (~שורה 276)
2. בדיקת `safeConfig.group_id` הישנה (~שורה 327)
3. `source_filter === 'multiple_groups'` עם `selected_group_ids` (~שורה 367)
4. `source_filter === 'all_groups_except'` עם `excluded_group_ids` (~שורה 358)

לא נדרשים שינויי DB או UI — רק יישור של הבדיקה ב-edge function.

## איך לוודא

לאחר ההטמעה: לשלוח "כרמן" באחת מהקבוצות המורשות. נצפה ל-`automation_executions` חדש לטננט עם `status` שונה מ-running תקוע, וכרמן תענה.
