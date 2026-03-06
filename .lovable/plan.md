

## תוכנית: תיקון הצגת שם חבר חדש בדיאלוג ניהול חברים

### בעיה
כשמוסיפים חבר חדש, ה-query של `team-member-profiles` לא מתעדכן. הוא משתמש ב-`members` מה-props (שעדיין ישנים), ולכן הפרופיל של החבר החדש לא נטען ומופיע "?" ו-"משתמש".

### פתרון
ב-`addMember.onSuccess` (שורה ~436), צריך להוסיף invalidation גם ל-`team-member-profiles`:

```typescript
queryClient.invalidateQueries({ queryKey: ["team-channel-members", channel.id] });
queryClient.invalidateQueries({ queryKey: ["team-member-profiles", channel.id] });
```

אותו דבר ב-`removeMember.onSuccess` (שורה ~453).

### קובץ לעדכון
- `src/pages/TeamChat.tsx` - שתי שורות invalidation נוספות

