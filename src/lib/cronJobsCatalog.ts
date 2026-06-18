// Friendly catalog for system cron jobs.
// Keys are the cron.job.jobname values.

export type CronCategory = "carmen" | "sync" | "reminders" | "telegram" | "system";

export interface CronJobMeta {
  label: string;
  description: string;
  category: CronCategory;
  icon: string;
}

export const CRON_JOB_CATALOG: Record<string, CronJobMeta> = {
  "carmen-memory-worker-1m": {
    label: "כרמן — עיבוד זיכרון",
    description: "מעבד את ה-outbox של זיכרון כרמן ושומר אירועים חדשים.",
    category: "carmen",
    icon: "🧠",
  },
  "carmen-memory-consolidate-daily": {
    label: "כרמן — איחוד זיכרונות יומי",
    description: "מאחד ומקצר את הזיכרונות של כרמן פעם ביום (03:00).",
    category: "carmen",
    icon: "📚",
  },
  "carmen-heartbeat": {
    label: "כרמן — Heartbeat",
    description: "פעימה אוטונומית של כרמן: שולח תזכורות, פותח משימות תקועות.",
    category: "carmen",
    icon: "❤️",
  },
  "sync-facebook-insights-twice-daily": {
    label: "סנכרון Facebook Insights",
    description: "מסנכרן ביצועי קמפיינים פעמיים ביום (05:00, 14:00) ויוצר התראות על ירידות הוצאה / בעיות חיוב.",
    category: "sync",
    icon: "📊",
  },
  "cron-sync-facebook-ecommerce-daily": {
    label: "סנכרון Facebook eCommerce",
    description: "מושך נתוני eCommerce מ-Facebook פעם ביום (05:00).",
    category: "sync",
    icon: "🛒",
  },
  "daily-ga-sync": {
    label: "סנכרון Google Analytics",
    description: "מושך נתוני GA לכל המחוברים פעם ביום (04:00).",
    category: "sync",
    icon: "📈",
  },
  "daily-google-ads-sync": {
    label: "סנכרון Google Ads",
    description: "מסנכרן קמפיינים והוצאות Google Ads (04:00).",
    category: "sync",
    icon: "🎯",
  },
  "check-overdue-tasks-daily": {
    label: "בדיקת משימות באיחור",
    description: "סורק משימות שעבר זמנן ושולח התראות (05:30).",
    category: "reminders",
    icon: "⏰",
  },
  "check-meeting-reminders-daily": {
    label: "תזכורות לפגישות",
    description: "שולח תזכורות לפגישות הקרובות (08:00).",
    category: "reminders",
    icon: "📅",
  },
  "telegram-poll": {
    label: "Telegram — Polling",
    description: "מאזין להודעות חדשות מבוטים בטלגרם.",
    category: "telegram",
    icon: "✈️",
  },
};

export function getCronMeta(jobname: string): CronJobMeta {
  return (
    CRON_JOB_CATALOG[jobname] || {
      label: jobname,
      description: "ג'וב מערכת ללא תיעוד.",
      category: "system",
      icon: "⚙️",
    }
  );
}

const HEBREW_DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

export function describeCronExpression(expr: string): string {
  if (!expr) return "—";
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return `Cron: ${expr}`;
  const [minute, hour, dom, month, dow] = parts;

  const pad = (s: string) => s.padStart(2, "0");
  const timeStr = (h: string, m: string) =>
    `${pad(h)}:${pad(m === "*" ? "00" : m)}`;

  // every minute
  if (expr === "* * * * *") return "כל דקה";
  // every N minutes
  if (hour === "*" && minute.startsWith("*/")) return `כל ${minute.slice(2)} דקות`;
  // every hour at minute X
  if (hour === "*" && /^\d+$/.test(minute)) return `כל שעה ב-:${pad(minute)}`;
  // every N hours
  if (hour.startsWith("*/") && /^\d+$/.test(minute))
    return `כל ${hour.slice(2)} שעות`;

  if (dom === "*" && month === "*" && dow === "*" && /^\d+$/.test(hour) && /^\d+$/.test(minute))
    return `כל יום ב-${timeStr(hour, minute)}`;

  if (dom === "*" && month === "*" && /^\d+$/.test(dow) && /^\d+$/.test(hour))
    return `כל יום ${HEBREW_DAYS[parseInt(dow) % 7]} ב-${timeStr(hour, minute)}`;

  // multiple hours: "0 5,14 * * *"
  if (dom === "*" && month === "*" && dow === "*" && hour.includes(",") && /^\d+$/.test(minute)) {
    const hours = hour.split(",").map(h => `${pad(h)}:${pad(minute)}`).join(", ");
    return `כל יום ב-${hours}`;
  }

  return `Cron: ${expr}`;
}
