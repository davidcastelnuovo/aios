

# תוכנית: בניית עורך פלוו ויזואלי לאוטומציות

## סקירה
הוספת עורך פלוו ויזואלי (כמו Make/n8n) לאוטומציות, עם תמיכה בריבוי צעדים ו-Drag & Drop. כל אוטומציה תורכב מנודים (טריגר, פעולות, תנאים) שמחוברים בקווים.

## מבנה טכני

### 1. מודל נתונים
הוספת טבלה `automation_flow_steps` לשמירת צעדי הפלוו:

```text
automation_flow_steps
├── id (uuid, PK)
├── automation_id (FK → automations)
├── tenant_id (FK → tenants)
├── step_type: 'trigger' | 'action' | 'condition' | 'delay'
├── action_type: text (סוג הפעולה: send_whatsapp, create_task, etc.)
├── configuration: jsonb (הגדרות ספציפיות לצעד)
├── position_x: integer (מיקום הנוד בקנבס)
├── position_y: integer
├── sort_order: integer (סדר הביצוע)
├── parent_step_id: uuid (nullable, לחיבור לצעד הקודם)
├── condition_branch: text (nullable, 'true'/'false' עבור הסתעפויות)
├── created_at, updated_at
```

הוספת שדה `is_flow: boolean` לטבלת `automations` כדי להבדיל בין אוטומציות פלוו לרגילות.

### 2. קומפוננטות UI חדשות

**עורך הפלוו הראשי** (`src/components/automations/FlowEditor.tsx`):
- קנבס SVG/HTML עם zoom ו-pan
- רינדור נודים וחיבורים ביניהם
- Drag & Drop להזזת נודים
- כפתור "+" להוספת צעד חדש בין נודים או בסוף

**נוד בודד** (`src/components/automations/FlowNode.tsx`):
- תצוגת כרטיס עם אייקון, שם, וסוג הצעד
- חיבורי כניסה/יציאה (נקודות)
- לחיצה פותחת פאנל הגדרות

**פאנל הגדרות צעד** (`src/components/automations/StepConfigPanel.tsx`):
- פאנל צדדי שנפתח בלחיצה על נוד
- שימוש חוזר בטפסים הקיימים (בחירת טריגר, הגדרות פעולה, תבנית הודעה וכו')

**קווי חיבור** (`src/components/automations/FlowConnector.tsx`):
- קווים מעוגלים (Bezier curves) בין נודים
- חיצים שמראים כיוון הזרימה

### 3. סוגי נודים

| סוג | אייקון | תפקיד |
|-----|--------|--------|
| טריגר | ⚡ | התחלת הפלוו (ליד נוצר, סטטוס השתנה...) |
| פעולה | ▶️ | ביצוע (שלח WhatsApp, צור משימה...) |
| תנאי | 🔀 | הסתעפות if/else |
| השהייה | ⏱️ | המתנה X דקות/שעות/ימים |

### 4. לוגיקת ביצוע (Backend)
עדכון Edge Function `trigger-automation` כדי:
- לזהות אם האוטומציה היא פלוו (`is_flow = true`)
- לשלוף את כל הצעדים מ-`automation_flow_steps` לפי `sort_order`
- לבצע כל צעד ברצף, עם תמיכה בתנאים ו-delay

### 5. שינויים בדף Automations
- הוספת כפתור "פלוו חדש" לצד "אוטומציה חדשה"
- לחיצה על פלוו פותחת את עורך הפלוו בדף מלא
- route חדש: `/t/:tenantSlug/automations/flow/:automationId`

### 6. ספריית Drag & Drop
שימוש ב-`@dnd-kit` (כבר מותקנת) עבור הזזת נודים בקנבס. קווי החיבור ירונדרו ב-SVG.

## סדר ביצוע
1. מיגרציה: הוספת טבלה `automation_flow_steps` + שדה `is_flow`
2. קומפוננטת FlowEditor עם קנבס, נודים וחיבורים
3. FlowNode + StepConfigPanel
4. דף FlowEditor route + ניווט מדף Automations
5. עדכון `trigger-automation` לתמיכה ב-multi-step

