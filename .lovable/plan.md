
# תיקון: עדכוני כרמן לא מופיעים בדשבורד + שגיאת בנייה

## 1. תיקון שגיאת בנייה ב-SocialDashboard
**קובץ:** `src/pages/SocialDashboard.tsx` שורה 131
- החלפת `setIsNewPostOpen(false)` ב-`setIsComposerOpen(false)` (המשתנה הנכון שמוגדר כ-state)

## 2. מיגרציה — הפעלת Realtime
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.communication_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.clients;
```

## 3. עדכון DMMDashboard — Realtime + mood mapping + staleTime
**קובץ:** `src/pages/DMMDashboard.tsx`

### 3a. ייבואים חדשים
הוספת `useEffect` ו-`useQueryClient` לייבואים:
```typescript
import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
```

### 3b. הוספת פונקציית מיפוי mood_status
לפני הקומפוננטה הראשית, הוספת:
```typescript
function mapMoodToCommStatus(mood: string | null): "normal" | "sensitive" | "complaint" | null {
  if (!mood) return null;
  switch (mood) {
    case "churn_risk": return "complaint";
    case "wavering": return "sensitive";
    case "happy": case "normal": return "normal";
    default: return null;
  }
}
```

### 3c. הפחתת staleTime
- `crmFields` query: `staleTime: 60_000` → `staleTime: 10_000`
- `commLogs` query: `staleTime: 60_000` → `staleTime: 10_000`
- `seoUpdates` query: `staleTime: 60_000` → `staleTime: 10_000`

### 3d. הוספת Realtime subscription
בתוך הקומפוננטה, אחרי ההגדרה של `queryClient`:
```typescript
const queryClient = useQueryClient();

useEffect(() => {
  if (!tenantId) return;
  const channel = supabase
    .channel("dmm-realtime")
    .on("postgres_changes", { event: "*", schema: "public", table: "communication_logs", filter: `tenant_id=eq.${tenantId}` }, () => {
      queryClient.invalidateQueries({ queryKey: ["communication-logs-latest"] });
      queryClient.invalidateQueries({ queryKey: ["dmm-clients-crm-fields"] });
    })
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "clients", filter: `tenant_id=eq.${tenantId}` }, () => {
      queryClient.invalidateQueries({ queryKey: ["dmm-clients"] });
      queryClient.invalidateQueries({ queryKey: ["dmm-clients-crm-fields"] });
    })
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}, [tenantId, queryClient]);
```

### 3e. שימוש ב-mapMoodToCommStatus
בשורה ~317, שינוי:
```typescript
communicationStatus: latestComm?.status ?? mood_status ?? null,
```
ל:
```typescript
communicationStatus: latestComm?.status ?? mapMoodToCommStatus(mood_status) ?? null,
```
וגם בשורה ~333 באותו אופן.

## קבצים לעריכה
| קובץ | שינוי |
|---|---|
| `src/pages/SocialDashboard.tsx` | תיקון שם משתנה (שגיאת בנייה) |
| `src/pages/DMMDashboard.tsx` | Realtime + mood mapping + staleTime |
| מיגרציה | Realtime publication |
