export const CREATIVE_SHAPES = [
  { id: "rect", label: "מלבן", width: 42, height: 20, borderRadius: 10 },
  { id: "pill", label: "כדור", width: 40, height: 9, borderRadius: 999 },
  { id: "circle", label: "עיגול", width: 16, height: 16, borderRadius: 999 },
  { id: "bar", label: "פס", width: 86, height: 14, borderRadius: 0 },
  { id: "line", label: "קו", width: 36, height: 1.4, borderRadius: 999 },
  { id: "frame", label: "מסגרת", width: 72, height: 38, borderRadius: 14, fill: "#11111122" },
] as const;

export type CreativeShapeId = (typeof CREATIVE_SHAPES)[number]["id"];
