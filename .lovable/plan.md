
המשתמש רוצה שכששולחים דשבורד באימייל, זה ישתמש בתמונה שכבר צולמה (auto-snapshot) במקום לצלם מחדש.

אבדוק את הקוד הקיים כדי להבין איך זה עובד עכשיו.
<lov-tool-use id="toolu_vrtx_01L1CT4vQqxuboJahdLZiLBh" name="code--search_files" integration-id="code" data="{\"query\": \"captureScreenshot|snapshot|sendDashboard|email.*dashboard\", \"include_patterns\": \"src/**/*.tsx,src/**/*.ts\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01Y71GX1gUEVSAUF4YffK6La" name="code--search_files" integration-id="code" data="{\"query\": \"captureScreenshot|sendDashboardEmail|snapshot_url|dashboard.*email\", \"include_patterns\": \"src/**/*.tsx,src/**/*.ts\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01QjqypchVz6Uy6PrKFc3tCi" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/clients/ClientDashboardPanel.tsx\", \"lines\": \"200-450\"}">
</lov-tool-use>
I have enough context. The bug: `handleSend` checks `if (!blob)` where `blob = screenshotBlob`. If blob exists, it should reuse. But user says it re-captures. Let me check — actually looking at line 333-341, it does reuse `screenshotBlob` if it exists. So why is it re-capturing?

Perhaps because the auto-capture is triggered on mount (line 319-330), and `screenshotBlob` wasn't set yet (only `screenshotUrl` was loaded from cache localStorage), so when user clicks send, blob is null → triggers re-capture.

Let me check the cache restore logic:
<lov-tool-use id="toolu_vrtx_0132pDofk99rkpy4PnbxA5bU" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/clients/ClientDashboardPanel.tsx\", \"lines\": \"1-200\"}">
</lov-tool-use>
Now I understand. The cache logic looks correct — restores from localStorage. But:

1. The auto-capture on mount will fire if `screenshotUrl` was loaded from cache but `setSnapshotMounted(true)` happens after `shareLink` resolves — and at that moment `screenshotUrl` is already set, so it should skip. But if cache miss → it auto-captures → fine.

2. The real issue: when user clicks "send", if `screenshotBlob` is null (e.g., cache failed to convert to blob, or no cache existed and capture didn't complete), it re-captures. But user says "it captures again" — meaning `screenshotUrl` IS shown but `handleSend` triggers a new capture.

Looking again: `handleSend` only captures if `!blob` (line 333-336). So `screenshotBlob` is null when sending. Possible causes:
- Cache restore fetch failed silently
- The auto-capture finished, set state, but somehow blob got cleared

Most likely fix per user request: just use the existing `screenshotUrl` (data URL) to derive the blob on send if the blob is null — never re-capture on send. The image they see is what should be sent.

<lov-plan>
## הבעיה

כשהמשתמש לוחץ "שלח אימייל", הקוד הנוכחי ב-`handleSend` בודק רק את `screenshotBlob` (state נפרד). אם ה-blob חסר — גם כשתמונה כבר מוצגת על המסך מתוך ה-cache (`screenshotUrl`) — הוא מצלם מחדש, וזה תופס מצב לא-טעון של הדשבורד.

המקור: `useEffect` בקאש (שורות 72-81) מנסה להמיר את ה-cached data URL חזרה ל-blob דרך `fetch()`. אם זה נכשל בשקט (למשל data URL פגום, או network policy), `screenshotUrl` נשאר ו-`screenshotBlob` נשאר null → הלחיצה על "שלח" מפעילה `captureScreenshot()` חדש.

## הפתרון

**עיקרון:** מה שרואים הוא מה ששולחים. לעולם לא לצלם מחדש מתוך `handleSend`.

### שינוי ב-`src/components/clients/ClientDashboardPanel.tsx`

בתוך `handleSend` (שורות 332-341):

1. אם יש `screenshotBlob` — להשתמש בו.
2. **אחרת, אם יש `screenshotUrl` (data URL) — להמיר אותו ל-blob ולשלוח** (בלי לצלם מחדש).
3. רק אם אין כלום (לא תמונה ולא URL) — אז להציע צילום, או להציג שגיאה ברורה "אין צילום, לחץ על 'צלם מחדש'".

קוד מוצע:
```ts
const handleSend = async () => {
  let blob = screenshotBlob;
  if (!blob && screenshotUrl) {
    // Reuse the image already shown on screen — never re-capture on send
    try {
      const r = await fetch(screenshotUrl);
      blob = await r.blob();
      setScreenshotBlob(blob);
    } catch {
      blob = null;
    }
  }
  if (!blob) {
    toast.error("אין צילום זמין — לחץ על 'צלם מחדש' לפני שליחה");
    return;
  }
  // ... continue with send
};
```

בנוסף, ב-cache restore effect (שורות 72-81), להוסיף לוג שגיאה במקום `.catch(() => {})` השתוק, כדי שנדע אם ההמרה נכשלת.

## תוצאה

- לחיצה על "שלח אימייל" תשלח **בדיוק את התמונה שמוצגת בתצוגה המקדימה**.
- לא יקרה יותר צילום-מחדש אוטומטי בעת שליחה.
- אם המשתמש רוצה צילום עדכני — הוא משתמש בכפתור "צלם מחדש" במפורש.

## קובץ שיתעדכן

- `src/components/clients/ClientDashboardPanel.tsx` — תיקון ב-`handleSend` + שיפור לוג ב-cache restore.
