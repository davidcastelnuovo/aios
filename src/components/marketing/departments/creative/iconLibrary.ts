export const CREATIVE_ICONS = [
  { id: "search", label: "חיפוש", keywords: "search google ai" },
  { id: "file-search", label: "בדיקת אתר", keywords: "audit site file" },
  { id: "clipboard-list", label: "רשימה", keywords: "list plan strategy" },
  { id: "shield", label: "הגנה", keywords: "shield trust" },
  { id: "sparkles", label: "ניצוץ", keywords: "ai magic sparkle" },
  { id: "message-circle", label: "הודעה", keywords: "chat whatsapp" },
  { id: "phone", label: "טלפון", keywords: "call phone" },
  { id: "badge-check", label: "וי", keywords: "check verified" },
  { id: "mail", label: "מייל", keywords: "email mail" },
  { id: "send", label: "שליחה", keywords: "send paper plane" },
  { id: "calendar", label: "יומן", keywords: "calendar date" },
  { id: "clock", label: "שעון", keywords: "time clock" },
  { id: "map-pin", label: "מיקום", keywords: "map pin location" },
  { id: "globe", label: "גלובוס", keywords: "web globe" },
  { id: "users", label: "קהל", keywords: "users people" },
  { id: "heart", label: "לב", keywords: "heart like" },
  { id: "star", label: "כוכב", keywords: "star review" },
  { id: "zap", label: "ברק", keywords: "zap energy" },
  { id: "target", label: "מטרה", keywords: "target goal" },
  { id: "megaphone", label: "מגפון", keywords: "ads campaign" },
  { id: "gift", label: "מתנה", keywords: "gift offer" },
  { id: "shopping-bag", label: "קנייה", keywords: "shop bag" },
  { id: "credit-card", label: "תשלום", keywords: "card pay" },
  { id: "home", label: "בית", keywords: "home house" },
  { id: "building-2", label: "עסק", keywords: "building office" },
  { id: "camera", label: "מצלמה", keywords: "camera photo" },
  { id: "play", label: "ניגון", keywords: "play video" },
  { id: "award", label: "פרס", keywords: "award medal" },
  { id: "trophy", label: "גביע", keywords: "trophy win" },
  { id: "rocket", label: "טיל", keywords: "rocket launch" },
  { id: "lightbulb", label: "רעיון", keywords: "idea bulb" },
  { id: "quote", label: "ציטוט", keywords: "quote" },
  { id: "headphones", label: "אוזניות", keywords: "audio support" },
  { id: "thumbs-up", label: "לייק", keywords: "like thumbs" },
  { id: "circle-check", label: "סימון", keywords: "done check" },
  { id: "wand-sparkles", label: "קסם", keywords: "wand generate" },
] as const;

export type CreativeIconId = (typeof CREATIVE_ICONS)[number]["id"];

export const CREATIVE_ICON_IDS = CREATIVE_ICONS.map((item) => item.id);

export const isCreativeIconId = (value?: string): value is CreativeIconId =>
  !!value && (CREATIVE_ICON_IDS as readonly string[]).includes(value);

export const searchCreativeIcons = (query: string) => {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...CREATIVE_ICONS];
  return CREATIVE_ICONS.filter((item) =>
    item.label.includes(query.trim())
    || item.id.includes(needle)
    || item.keywords.includes(needle),
  );
};
