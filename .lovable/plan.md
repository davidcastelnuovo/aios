## מטרה
לעדכן את לשונית "עדכונים" כך ש"עדכון שבועי" יהיה ברירת המחדל, ולגרום לכך שכאשר נשלח דוח בוואטסאפ דרך לשונית הדוחות — הטקסט יישמר אוטומטית גם כעדכון שבועי בלשונית העדכונים.

## שינויים

### 1. `src/components/clients/ClientUpdatesTab.tsx`
- שינוי `useState<string>("call")` → `useState<string>("weekly_update")` עבור `newUpdateType` (שורה 70).
- שינוי גם של `commInteraction` הפנימי ל-`"weekly_update"` כברירת מחדל לעקביות (שורה 77).

### 2. `src/components/clients/ClientReportPanel.tsx`
- בתוך `handleSend` (שורה ~383), לאחר שליחת וואטסאפ מוצלחת (`toast.success("הדוח נשלח בוואטסאפ בהצלחה")`):
  - אם `messageText.trim()` לא ריק — להוסיף `INSERT` לטבלת `client_updates`:
    ```ts
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("client_updates").insert({
      client_id: clientId,
      tenant_id: tenantId,
      user_id: user?.id,
      content: messageText.trim(),
      update_type: "weekly_update",
    } as any);
    queryClient.invalidateQueries({ queryKey: ["client-updates"] });
    ```
- כשל בשמירה נרשם ל-console בלבד (לא עוצר את זרימת השליחה).

## מה שלא משתנה
- לוגיקת שליחת הדוח, הצילום, מבנה ה-UI, וטבלאות אחרות לא משתנים.
- לא משנים את `ClientUpdatesTab` מעבר לברירת המחדל.