# החלפת טבלת Google Ads של אביאלי למצב איקומרס

## מה עושים
פשוט מחליפים את ה‑`campaign_type` של הטבלה של אביאלי מ‑`combined` (שהוספתי בטעות) ל‑`ecommerce`. זה דשבורד Google Ads רגיל, פשוט במצב איקומרס במקום לידים — כך שיוצגו רכישות, ערך המרות ו‑ROAS אמיתיים מהקמפיין.

## שינוי יחיד — Data
```sql
UPDATE crm_tables
SET integration_settings = jsonb_set(integration_settings, '{campaign_type}', '"ecommerce"')
WHERE id = '2210de70-b853-49bf-b579-8178f798b357';
```

זה ה‑id של טבלת "אביאלי" בלבד. שאר טבלאות Google Ads לא מושפעות.

## ניקוי הקוד שהוספתי בטעות
מסירים את מצב `combined` שהוספתי — לא נדרש ולא הגיוני (אין דבר כזה "ערך המרה" בקמפיין לידים). חוזרים בדיוק ל‑UI הקודם:

- `src/components/dynamic-tables/GoogleAdsTableDialog.tsx` — להחזיר את הטיפוס ל‑`"leads" | "ecommerce"` ולהסיר את האופציה השלישית "משולב" מה‑RadioGroup (חזרה ל‑`grid-cols-2`).
- `src/pages/DynamicTableView.tsx` — להסיר את `isCombined` ואת ענפי ה‑combined ב‑thead/tbody/tfoot של טבלת הסיכום של Google Ads.
- `src/pages/SharedTable.tsx` — להחזיר את `tableMode` לטיפוס `'leads' | 'ecommerce'` ולהסיר את `isCombinedMode` ואת ענפי ה‑combined ב‑`summary` וב‑`campaignSummary`.

## QA
1. לפתוח `/t/marketingcaptain/table/אביאלי-mo2oc7bk` — צריכות להופיע רק העמודות של איקומרס (חשיפות, קליקים, המרות, עלות, ערך המרות, ROAS), בדיוק כמו כל טבלת Google Ads ecommerce אחרת.
2. כרטיס "סיכום ROI ידני" לא מופיע (הוא מוסתר במצב ecommerce — ככה זה היה תמיד).
3. קישור השיתוף של אביאלי מציג את אותו דבר.
4. טבלאות Google Ads אחרות (leads/ecommerce) — ללא שינוי כלל.
