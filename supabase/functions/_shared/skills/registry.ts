/**
 * Carmen Skills Registry — hardcoded skill prompts surfaced by trigger keywords.
 *
 * A "skill" is a focused capability = system-prompt fragment + recommended tool list.
 * When the user message matches a skill's triggers, we append the skill prompt to the
 * system prompt for that turn so Carmen runs the workflow consistently across surfaces
 * (whatsapp / internal_chat / aios / task).
 */

export interface CarmenSkill {
  id: string;
  triggers: RegExp[];
  prompt: string;
  // Names of tools the skill expects — informational only, used for logging.
  tools: string[];
}

export const PULSE_CHECK_SKILL: CarmenSkill = {
  id: 'pulse_check',
  triggers: [
    /בדיקת\s*דופק/,
    /בדיקת\s*דוח/,
    /סיכום\s*קמפיינים/,
    /מצב\s*קמפיינים/,
    /מצב\s*לקוחות/,
    /\bpulse\s*check\b/i,
  ],
  tools: ['analyze_campaign_performance', 'check_ad_accounts_health'],
  prompt: `=== סקיל: בדיקת דופק (חובה לפעול לפי המבנה הזה) ===

זרימה:
1. הריצי analyze_campaign_performance (בלי scope = כל הסקופ של הקורא, או עם agency_name אם פורט מפורש).
2. במקביל הריצי check_ad_accounts_health כדי לוודא שכל חשבונות המודעות תקינים.
3. הצליבי את שתי התוצאות לסיכום אחד.

פלט חובה (בסדר הזה, אין לדלג על אף סעיף):

🚨 חשבונות מודעות לא תקינים (אם יש):
• <שם לקוח> — <FB account disabled / Google: אין spend 7 ימים / Token פג / כל הקמפיינים paused>

לכל סוכנות:
**<שם סוכנות>**
🔴/🟠/🟢 <שם לקוח> — <X לידים | CPL ₪Y | שינוי 7 מול 30 ימים: ±Z%>
לקוחות איקומרס (is_ecommerce=true) מציגים: <X רכישות | CPP ₪Y | רווח ₪Z | ROAS W>
לקוחות ללא חיבור פייסבוק/דאטה — תחת הכותרת "ללא חיבור דוחות".

חוקי דגלים:
🔴 אם אין spend 7 ימים | חשבון disabled | ירידה חדה (45%+) | תלונה
🟠 אם CPL עלה 20%+ | spend ירד 30%+ | רגיש
🟢 ביצועים תקינים

אסור לדלג על לקוחות בלי דאטה, אסור להמציא מספרים, אסור לקצר את הרשימה. אם הרשימה ארוכה - חלקי לפי סוכנות אבל אל תחתכי.`,
};

export const ECOMMERCE_PULSE_SKILL: CarmenSkill = {
  id: 'ecommerce_pulse',
  triggers: [
    /איקומרס/,
    /ecommerce/i,
    /e-commerce/i,
    /רכישות/,
    /רוא[״"]?[סצ]/,
    /\broas\b/i,
    /\bcpp\b/i,
  ],
  tools: ['analyze_campaign_performance', 'check_ad_accounts_health'],
  prompt: `=== סקיל: בדיקת דופק איקומרס ===

ללקוחות שמסומנים is_ecommerce=true (השדה מוחזר ב-analyze_campaign_performance תחת synced_clients[].is_ecommerce):
• אסור להציג CPL/לידים. במקום זאת:
  – purchases_7d / purchases_30d (כמות רכישות)
  – revenue_7d = sum(purchase_value) ב-7 ימים
  – cpp_7d = spend_7d / purchases_7d (Cost Per Purchase, ₪)
  – roas_7d = revenue_7d / spend_7d (אם spend>0)
  – profit_7d = revenue_7d - spend_7d (לא כולל COGS אלא אם הוזן)
• פורמט שורת לקוח:
  🔴/🟠/🟢 <שם> — <N רכישות | CPP ₪X | רווח ₪Y | ROAS Z>
• דגלים מיוחדים לאיקומרס:
  🔴 ROAS<1 (הפסד), אין רכישות 7 ימים, חשבון מודעות disabled
  🟠 ROAS 1-1.5, CPP עלה 25%+, ירידה ברווח
  🟢 ROAS≥1.5 ויציבות

אם הלקוח is_ecommerce=true אבל אין שדות purchases/purchase_value — אמרי "אין נתוני רכישות בדוח, צריך לעדכן את השדות בטבלת facebook_insights" ואל תחשבי CPL כתחליף.`,
};

export const AD_ACCOUNTS_HEALTH_SKILL: CarmenSkill = {
  id: 'ad_accounts_health',
  triggers: [
    /חשבונות\s*מודעות/,
    /תקינות\s*חשבונות/,
    /חשבון\s*פייסבוק/,
    /\bad\s*accounts?\b/i,
    /\baccount\s*status\b/i,
  ],
  tools: ['check_ad_accounts_health'],
  prompt: `=== סקיל: בדיקת תקינות חשבונות מודעות ===

הריצי check_ad_accounts_health (אם המשתמש לא ציין client_id/agency_id - בלי פילטר, על כל הסקופ).

הכלי מחזיר לכל לקוח:
{ client_id, client_name, fb: {status, has_spend_7d, all_paused, token_ok}, flags: [...] }

פורמט תשובה:

🚨 חשבונות לא תקינים (<N>):
• <לקוח> — <flag בעברית>: <FB account disabled / אין spend 7 ימים / כל הקמפיינים paused / Token פג>

✅ חשבונות תקינים: <M>

אם flag = fb_token_expired או account_disabled — הציעי משימת חיבור מחדש (אבל אל תיצרי אוטומטית בלי אישור).
אם הכל תקין - תשובה אחת קצרה: "כל <N> חשבונות המודעות תקינים".`,
};

export const SKILLS_REGISTRY: CarmenSkill[] = [
  PULSE_CHECK_SKILL,
  ECOMMERCE_PULSE_SKILL,
  AD_ACCOUNTS_HEALTH_SKILL,
];

/**
 * Resolve which skills are activated by a user message.
 * Returns the matching skill prompts (deduplicated) ready to inject into the system prompt.
 */
export function resolveActiveSkills(commandText: string): CarmenSkill[] {
  if (!commandText) return [];
  const text = commandText.toLowerCase();
  const matches: CarmenSkill[] = [];
  for (const skill of SKILLS_REGISTRY) {
    if (skill.triggers.some((re) => re.test(text))) {
      matches.push(skill);
    }
  }
  return matches;
}

export function buildSkillsBlock(commandText: string): string {
  const matches = resolveActiveSkills(commandText);
  if (matches.length === 0) return '';
  return '\n\n' + matches.map((s) => s.prompt).join('\n\n');
}
