

# הוספת גלילה בגלגלת (wheel) לוויטבורד

## המצב הנוכחי
הקנבס תומך ב-pan בגרירת עכבר (mouse drag) וב-zoom עם כפתורים, אבל **אין תמיכה בגלגלת העכבר** – לא לגלילה ולא לזום.

## הפתרון
להוסיף `onWheel` handler לקנבס:
- **גלילה רגילה** (wheel) → pan אנכי/אופקי
- **Ctrl+wheel** → zoom in/out

### שינוי ב-`src/components/automations/FlowEditor.tsx`:

1. הוספת `handleWheel` callback:
```typescript
const handleWheel = useCallback((e: React.WheelEvent) => {
  e.preventDefault();
  if (e.ctrlKey || e.metaKey) {
    // Zoom
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(z => Math.min(Math.max(z + delta, 0.3), 2));
  } else {
    // Pan
    setPan(p => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
  }
}, []);
```

2. הוספת `onWheel={handleWheel}` ל-div של הקנבס (שורה 334)

3. הוספת `useEffect` עם `{ passive: false }` על ה-canvas ref כדי למנוע את ברירת המחדל של הדפדפן (ב-React, `onWheel` לא יכול לעשות `preventDefault` ב-passive listener)

| קובץ | שינוי |
|-------|-------|
| `src/components/automations/FlowEditor.tsx` | הוספת wheel handler לגלילה + zoom |

