
# תוכנית: שיפור מערכת האנליטיקס - תמיכה ב-ref ואירועי E-commerce

## בעיות שזוהו

### 1. פרמטר `ref` לא נשמר
- כאשר מישהו מגיע עם `?ref=facebook`, ה-`utm_source` נשאר NULL
- הסקריפט מחפש רק פרמטרים שמתחילים ב-`utm_` ומתעלם מ-`ref`

### 2. אירועי E-commerce לא קיימים
- כרגע נשמרים רק אירועי `click` כלליים
- אין תמיכה מובנית באירועים: הוספה לעגלה, רכישה, שווי רכישה

### 3. הדשבורד לא מציג אירועים
- אין תצוגה של אירועים בדשבורד האנליטיקס

---

## פתרון טכני

### שלב 1: תמיכה בפרמטר `ref` בסקריפט

עדכון פונקציית `getUTMParams()` ב-`analytics-script`:

```javascript
function getUTMParams() {
  var params = {};
  var search = window.location.search.substring(1);
  var pairs = search.split('&');
  
  for (var i = 0; i < pairs.length; i++) {
    var pair = pairs[i].split('=');
    var key = decodeURIComponent(pair[0]);
    var value = decodeURIComponent(pair[1] || '');
    
    // תמיכה ב-utm_ וגם ב-ref
    if (key.indexOf('utm_') === 0) {
      params[key] = value;
    } else if (key === 'ref') {
      // אם אין utm_source, השתמש ב-ref
      if (!params.utm_source) {
        params.utm_source = value;
      }
    }
  }
  
  // ... rest of function
}
```

### שלב 2: API לאירועי E-commerce

הוספת פונקציות ייעודיות לסקריפט הלקוח:

```javascript
// הוספה לעגלה
MC.addToCart = function(productId, productName, value, quantity) {
  MC.track('add_to_cart', {
    product_id: productId,
    product_name: productName,
    value: value,
    quantity: quantity || 1
  });
};

// רכישה
MC.purchase = function(orderId, revenue, items) {
  MC.track('purchase', {
    order_id: orderId,
    revenue: revenue,
    items: items
  });
};
```

### שלב 3: שמירת `event_value` לאירועי E-commerce

עדכון ב-`analytics-track` Edge Function כדי לשמור את הערך הכספי:

```typescript
if (event_type === "event" && data.event_name) {
  await supabase.from("site_events").insert({
    // ... existing fields
    event_value: data.event_data?.value || data.event_data?.revenue || null,
    // ...
  });
}
```

### שלב 4: הוספת סעיף אירועים לדשבורד

הוספת query וטבלה לתצוגת האירועים ב-`AnalyticsDashboard.tsx`:

```text
+----------------------------------+
|          אירועים               |
+----------------------------------+
| שם האירוע   | כמות | שווי כולל   |
|-------------|------|------------|
| add_to_cart |  15  |   ₪750     |
| purchase    |   3  |   ₪2,340   |
| click       | 120  |     -      |
+----------------------------------+
```

---

## קבצים לעדכון

| קובץ | שינוי |
|------|-------|
| `supabase/functions/analytics-script/index.ts` | הוספת תמיכה ב-`ref` + API ל-e-commerce |
| `supabase/functions/analytics-track/index.ts` | שמירת `event_value` מאירועי e-commerce |
| `src/components/analytics/AnalyticsDashboard.tsx` | הוספת טבלת אירועים עם סיכומים |

---

## שימוש לאחר ההטמעה

### באתר הלקוח - יש להוסיף קוד JavaScript:

```javascript
// כאשר מוסיפים לעגלה
MCAnalytics.addToCart('product-123', 'חבילת טיפוח', 150, 1);

// כאשר מתבצעת רכישה
MCAnalytics.purchase('order-456', 350, [
  { name: 'חבילת טיפוח', price: 150, qty: 1 },
  { name: 'בר מים', price: 200, qty: 1 }
]);
```

---

## תוצאה צפויה

1. פרמטר `ref` יתרגם ל-`utm_source` ויוצג בגרף מקורות תנועה
2. ניתן לעקוב אחרי אירועי e-commerce: הוספה לעגלה, רכישות
3. הדשבורד יציג טבלת אירועים עם סיכום כמות ושווי
