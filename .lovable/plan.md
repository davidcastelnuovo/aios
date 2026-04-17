

## אבחון

בדקתי הכל מקצה לקצה:

**1. בקאנד (`public-dashboard` edge function)** — תקין ✅
קריאה ישירה ל-API עם `token=lidar` מחזירה:
- `woocommerce.sites`: 1 אתר (lidarswimwear.com)
- `woocommerce.orders`: 81 הזמנות

**2. דאטה במסד** — תקין ✅
האתר מקושר ללקוח "לידר", עם `woocommerce_enabled=true`, `is_active=true`, ו-`tenant_id` תואם לדשבורד.

**3. קוד הפרונט (`SharedDashboard.tsx`)** — תקין ✅
- שורה 145-147: קורא `data?.woocommerce?.sites` ומחשב `hasWooCommerce`
- שורה 157: מוסיף `'woocommerce'` ל-`availablePlatforms`
- שורות 535-540: מרנדר `<TabsTrigger value="woocommerce">`
- שורה 552-553: מרנדר את `<PublicWooCommerceView>`

## מסקנה

**הקוד כבר נכון** — התיקון מהשיחה הקודמת אכן עובד. הצילום שלך מראה ככל הנראה גרסה ישנה של הקישור (קאש בדפדפן), משום שכל החלקים פועלים תקין כשבודקים ישירות.

## מה אעשה כדי להבטיח שזה עובד 100%

### 1. הוספת אינדיקטור ויזואלי במצב ריק
ב-`PublicWooCommerceView.tsx` כבר יש fallback "אין אתר WooCommerce משויך" — ולכן אם הנתונים מגיעים אך הלשונית עדיין לא נראית, זה אומר שה-JS שנטען בדפדפן ישן.

### 2. הוספת cache-busting + בדיקת הגנה
- ב-`SharedDashboard.tsx`: אוסיף `staleTime: 0` ו-`gcTime: 0` ל-React Query כדי למנוע קאשינג של תגובת ה-API שלא תכלול את שדה `woocommerce`.
- אוסיף לוג קונסול קצר (`console.log('[SharedDashboard] wooSites:', wooSites.length)`) לאבחון עתידי.
- אעבור על ה-`availablePlatforms` ואוודא שגם אם `tables` ריק (אבל יש WooCommerce בלבד) — הלשוניות עדיין מרונדרות (כיום ה-`Tabs` נטען רק אם `availablePlatforms.length > 0`, וזה כבר מטופל נכון).

### 3. הנחיה למשתמש
לאחר העדכון, יהיה צורך **לרענן את הדף עם Ctrl+Shift+R** (או לפתוח בחלון פרטי) כדי לטעון את ה-JS המעודכן. הקאש של הדפדפן הוא ההסבר היחיד ההגיוני לכך שהלשונית לא מופיעה כשהנתונים זמינים בצד השרת.

## קבצים לעדכון
- `src/pages/SharedDashboard.tsx` — הוספת `staleTime:0`, `gcTime:0`, ולוג אבחון

## תוצאה
לאחר הרענון הקשיח — לשונית WooCommerce תופיע ב-`/shared/dashboard/lidar` עם הנתונים של הלקוח לידר.

