import { extractCopyAngle, parseCreativeCopy, strongestLine } from "./designedLayers";
import type { CreativeVisualStyleId } from "./visualStyles";

export type CopyMood = "urgent" | "doubt" | "screen" | "offer" | "place" | "human" | "neutral";

const MOOD_RULES: { id: CopyMood; test: RegExp; lock: string }[] = [
  {
    id: "urgent",
    test: /פומו|המתחרים|נסגר|עכשיו|תפסיק|הזדמנות|FOMO|competit|last chance/i,
    lock: "MOOD: urgency. Tight crop, high contrast, a real person mid-decision or mid-loss. Energy comes from the situation, not from purple-orange streaks or a style-board car.",
  },
  {
    id: "doubt",
    test: /מתלבט|לא יודע|רגע|תחשוב|ספק|doubt|hesitat/i,
    lock: "MOOD: doubt. Intimate, quieter, one human beat. Soft directional light. Do not cheer it up into a vacation postcard.",
  },
  {
    id: "screen",
    test: /טיקטוק|צ['׳']אט|גוגל|מגלגל|סקרול|וואטסאפ|מסך|tiktok|google|scroll|chat|whatsapp/i,
    lock: "MOOD: screen life. Contemporary, real hands/phone/glow of THIS action (scrolling, searching, chatting). Not a generic neon city or kinetic light-trail.",
  },
  {
    id: "offer",
    test: /₪|ש["״]ח|מחיר|לילה|מבצע|כולל|price|night|deal/i,
    lock: "MOOD: commercial offer. Clear, premium, the real product/world of the offer. Daylight or a designed grade from the logo — not a catalog cliché.",
  },
  {
    id: "place",
    test: /טיס|רודוס|יעד|חוף|מלון|יעד|flight|rhodes|hotel|beach|destinat/i,
    lock: "MOOD: place. Only because the copy is about a destination. Show THAT place as a designed still, not a generic Santorini / airplane-wing postcard.",
  },
  {
    id: "human",
    test: /לקוח|לקוחות|אנשים|אתה |אתם |client|customer|people/i,
    lock: "MOOD: human. A specific person acting the copy, in a designed environment that belongs to this brand. Not a grey-studio portrait.",
  },
];

const STYLE_BOARD_RECIPES = [
  "Swiss grey catalog / airplane",
  "industrial yellow-on-black blueprint",
  "Mediterranean village / Santorini sand",
  "kinetic purple-orange speed streaks",
  "iridescent glass cube on black",
  "torn-paper explorer collage",
  "Bauhaus primaries + airplane window",
  "cinematic coastline silhouette",
  "pink-cyan hologram / floating suitcase",
  "organic sea-window stone",
].join("; ");

export const detectCopyMood = (text: string): CopyMood => {
  for (const rule of MOOD_RULES) {
    if (rule.test.test(text)) return rule.id;
  }
  return "neutral";
};

const moodLock = (mood: CopyMood) =>
  MOOD_RULES.find((rule) => rule.id === mood)?.lock
  ?? "MOOD: invent a premium commercial treatment that a stranger would say belongs to THIS sentence and THIS brand. Do not pick a look from a style catalog.";

export const isOptionalCostume = (styleId?: CreativeVisualStyleId | null): boolean =>
  !!styleId && styleId !== "adaptive";

export const buildAdaptiveTreatment = ({
  copyText,
  copyLabel,
  title,
  brief,
  brandColors,
  costumeLabel,
}: {
  copyText?: string;
  copyLabel?: string;
  title?: string;
  brief?: string;
  brandColors?: string[];
  costumeLabel?: string;
}): string => {
  const parts = parseCreativeCopy(copyText ?? "", title);
  const idea = strongestLine(copyText ?? "", title) || parts.headline || parts.body;
  const angle = extractCopyAngle(copyText, copyLabel);
  const topic = [brief, title, idea, angle].filter((bit) => bit && bit.trim()).join(" · ").slice(0, 280);
  const mood = detectCopyMood([copyText, copyLabel, title, brief].filter(Boolean).join("\n"));
  const colors = (brandColors ?? []).filter(Boolean);

  return [
    "ADAPTIVE STYLE — invent a treatment for THIS ad. Do not pick a look from the ten style boards.",
    "Style is a function of (1) this copy's idea, (2) the logo/brand colors, (3) the real topic. It must change when any of those change.",
    idea && `The picture's job is to stage: "${idea}".`,
    angle && `Copy angle that must shape light and energy: ${angle}.`,
    topic && `Topic/world: ${topic}. Materials, location and props come from that world — not from a style catalog.`,
    moodLock(mood),
    colors.length
      ? `PALETTE IS THE LOGO: ${colors.join(", ")}. Grade, gels, props and graphic fields use ONLY these colors plus black, white, or paper. Do not import a style-board palette (no purple-orange, no pink-cyan, no Bauhaus primaries, no industrial yellow) unless those hexes are in the logo.`
      : "No logo palette on file — invent a tight commercial palette from the topic's real materials. Still do not import a style-board palette.",
    `Forbidden default recipes (do not recall them): ${STYLE_BOARD_RECIPES}.`,
    costumeLabel
      ? `Optional costume hint only: you may borrow a MATERIAL from "${costumeLabel}" (grain, paper, glass, daylight) — never its palette, layout, or cliché subject. Copy + logo + topic still win.`
      : "No costume lock. Invent the finish.",
    "If this still could be reused for a different brand or a different variation, it failed.",
  ].filter(Boolean).join("\n");
};
