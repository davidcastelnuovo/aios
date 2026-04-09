

## תיקון בעיית גלילה במודול משימות

### הבעיה
כשגוללים את רשימת המשימות (TaskBacklogPanel), הגלילה "נתקעת" ומתחילה לגלול את כל העמוד במקום להישאר רק בתוך הרשימה. זה קורה בגלל scroll chaining — כשהרשימה מגיעה לקצה, הדפדפן מעביר את הגלילה לאלמנט ההורה.

### הפתרון
הוספת `overscroll-behavior: contain` על אזורי הגלילה הפנימיים כדי למנוע העברת גלילה לעמוד החיצוני. בנוסף, וידוא שהקונטיינר החיצוני של הדסקטופ מגביל גלילה אנכית בצורה נכונה.

### קבצים לתיקון

**1. `src/components/tasks/OverdueTasksPanel.tsx`** (שורה 342)
- הוספת `overscroll-behavior-contain` על ה-div הגולל של רשימת המשימות

**2. `src/components/tasks/WeeklyTaskBoard.tsx`**
- שורה 1179 (מובייל): הוספת `overscroll-contain` על wrapper של TaskBacklogPanel
- שורה 1262 (דסקטופ): הוספת `overflow-y-auto overscroll-contain` על הקונטיינר הראשי
- שורה 1199 (calendar area mobile): הוספת `overscroll-contain`

**3. `src/pages/Tasks.tsx`**
- וידוא שה-wrapper החיצוני לא מאפשר גלילה מיותרת (`overflow-hidden`)

### סיכום
תיקון פשוט של CSS — הוספת `overscroll-behavior: contain` בנקודות המפתח כדי ליצור הפרדה מוחלטת בין הגלילות.

