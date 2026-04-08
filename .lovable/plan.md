

# הסרת כרטיס כרמן הכפול מרשימת הסוכנים

## הבעיה
כרמן מוצגת פעמיים — פעם בהירו בראש הדף ופעם נוספת כ-AgentCard ברשת הסוכנים הפעילים. מיותר.

## הפתרון
סינון כרמן מתוך `activeAgents` ו-`inactiveAgents` כדי שלא תופיע כרטיס כפול ברשת.

### קובץ: `src/pages/AgentHub.tsx`
- בשורה 361-362, סינון הסוכנים לפי שם כדי להוציא את כרמן:
  ```ts
  const isCarmen = (a) => ["כרמן","carmen"].includes(a.name?.toLowerCase?.());
  const activeAgents = agents.filter(a => a.active && !isCarmen(a));
  const inactiveAgents = agents.filter(a => !a.active && !isCarmen(a));
  ```
- עדכון הספירה בבאדג' (שורה 469) כך שלא תספור את כרמן פעמיים

