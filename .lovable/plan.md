

## הפיכת האפליקציה ל-PWA (Progressive Web App)

כרגע אין שום הגדרת PWA בפרויקט. צריך להוסיף 3 דברים:

### 1. קובץ `public/manifest.json`
- שם האפליקציה, צבעים, אייקונים, `display: standalone`, `start_url`, כיוון RTL
- אייקונים בגדלים 192x192 ו-512x512 (נייצר מה-favicon הקיים)

### 2. Service Worker — `public/sw.js`
- Cache של קבצים סטטיים (HTML, CSS, JS, תמונות)
- אסטרטגיית network-first כדי שהאפליקציה תעבוד גם אופליין חלקית

### 3. רישום ב-`index.html`
- תג `<link rel="manifest">` ב-head
- תגי `<meta>` ל-iOS (apple-mobile-web-app-capable, apple-touch-icon, theme-color)
- סקריפט רישום Service Worker

### תוצאה
- באנדרואיד: המשתמשים יראו כפתור "Install" / "Add to Home Screen" בדפדפן
- באייפון: Share → Add to Home Screen
- האפליקציה תיפתח במסך מלא בלי שורת כתובת

