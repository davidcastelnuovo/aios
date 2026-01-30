

## תוכנית תיקון - לוגיקת חיפוש Subscriber במניצ'ט

### הבעיה שזוהתה

הפונקציה `findSubscriberByCustomFieldMC` ב-Edge Function `trigger-automation` מצפה לתגובת API בפורמט:
```json
{ "status": "success", "data": { "id": "123" } }
```

אבל ה-API של ManyChat מחזיר **מערך**:
```json
{ "status": "success", "data": [ { "id": "123" }, { "id": "456" } ] }
```

לכן הבדיקה `data?.data?.id` מחזירה `undefined` והמערכת מדלגת על התוצאה למרות שנמצא subscriber תקין.

---

### הפתרון

#### שינוי 1: תיקון findSubscriberByCustomFieldMC (שורות 86-91)

**לפני:**
```typescript
if (data?.status === 'success' && data?.data?.id) {
  return String(data.data.id);
}
```

**אחרי:**
```typescript
if (data?.status === 'success' && data?.data) {
  // Handle both array and object responses
  const subscribers = Array.isArray(data.data) ? data.data : [data.data];
  // Find first ACTIVE subscriber (not deleted)
  const activeSubscriber = subscribers.find((s: any) => s.status !== 'deleted' && s.id);
  if (activeSubscriber?.id) {
    return String(activeSubscriber.id);
  }
}
```

#### לוגיקה נוספת

- **תיעדוף subscribers פעילים**: אם יש מספר תוצאות, נבחר את ה-subscriber הראשון שהוא לא `deleted`
- **תמיכה בשני פורמטים**: הקוד יטפל גם באובייקט בודד וגם במערך

---

### פרטים טכניים

| קובץ | שינוי |
|------|-------|
| `supabase/functions/trigger-automation/index.ts` | תיקון לוגיקת parsing בפונקציה `findSubscriberByCustomFieldMC` |

### צעדים ליישום

1. עדכון הפונקציה `findSubscriberByCustomFieldMC` לטפל בתגובת מערך
2. הוספת סינון לפי `status !== 'deleted'` כדי להתעלם מ-subscribers שנמחקו
3. Deploy מחדש של ה-Edge Function

