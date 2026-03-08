

# תיקון: סינון אוטומציות לפי group_id ברמת השאילתה

## הבעיה
כשמגיעה הודעה מקבוצה, ה-`trigger-automation` מושך **את כל** האוטומציות עם טריגר `whatsapp_message_received` באותו tenant — בלי לסנן לפי `group_id`. אז אוטומציה שהוגדרה לקבוצה אחת רצה גם על הודעות מקבוצות אחרות.

## הפתרון — סינון כבר בשלב השליפה
במקום לשלוף את כל הטריגרים ואז לבדוק תנאים, נשלוף את ה-`configuration` של כל trigger step ונסנן **לפני** שמביאים את האוטומציות:

**קובץ**: `supabase/functions/trigger-automation/index.ts` — שורות 248-279

**לפני**: שולף את כל ה-trigger steps לפי `action_type` בלבד:
```typescript
const { data: flowTriggerSteps } = await supabase
  .from('automation_flow_steps')
  .select('automation_id')
  .eq('tenant_id', payload.tenant_id)
  .eq('step_type', 'trigger')
  .eq('action_type', payload.trigger_type)
```

**אחרי**: שולף גם את ה-`configuration` ומסנן לפי `group_id`, `keyword`, `connection_user_id`:
```typescript
const { data: flowTriggerSteps } = await supabase
  .from('automation_flow_steps')
  .select('automation_id, configuration')
  .eq('tenant_id', payload.tenant_id)
  .eq('step_type', 'trigger')
  .eq('action_type', payload.trigger_type)

// Filter by trigger configuration BEFORE fetching automations
const matchingSteps = (flowTriggerSteps || []).filter(step => {
  const config = step.configuration || {}
  // If trigger has group_id filter, payload must match
  if (config.group_id && config.group_id !== payloadData.group_id) return false
  // If trigger has connection_user_id filter, payload must match  
  if (config.connection_user_id && config.connection_user_id !== payloadData.connection_user_id) return false
  // If trigger has keyword filter, message must contain it
  if (config.keyword && payloadData.message_text && 
      !payloadData.message_text.includes(config.keyword)) return false
  // If trigger filters by source (group/private), must match
  if (config.source_filter === 'group' && !payloadData.group_id) return false
  if (config.source_filter === 'private' && payloadData.group_id) return false
  return true
})
const flowAutomationIds = matchingSteps.map(s => s.automation_id)
```

זה אומר שאוטומציה שהוגדרה לקבוצה X פשוט לא תישלף בכלל כשההודעה מגיעה מקבוצה Y. אין צורך ב-`checkConditions` על שלב הטריגר אחר כך — הסינון כבר קרה.

שלב הטריגר ב-`for` loop (שורות 324-327) ימשיך לעשות `continue` כרגיל — הוא כבר עבר סינון.

