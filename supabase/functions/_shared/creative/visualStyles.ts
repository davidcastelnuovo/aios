import type { CreativeVisualStyleId } from "./types.ts";

export type { CreativeVisualStyleId };

export interface CreativeVisualStyle {
  id: CreativeVisualStyleId;
  label: string;
}

const LABELS: Record<CreativeVisualStyleId, string> = {
  adaptive: "אדפטיבי",
  swiss: "שוויצרי",
  industrial: "תעשייתי",
  mediterranean: "ים תיכוני",
  kinetic: "קינטי",
  glass: "זכוכית",
  collage: "קולאז'",
  bauhaus: "בauhaus",
  cinematic: "קולנועי",
  holographic: "הולוגרפי",
  organic: "אורגני",
  photoreal: "פוטו-ריאל",
  animation: "אנימציה 3D",
  illustration: "איור",
  popart: "פופ-ארט",
  render3d: "רנדר 3D",
  editorial: "עיתונאי",
  ugc: "UGC",
  watercolor: "צבעי מים",
  comic: "קומיקס",
};

export const visualStyleById = (id: CreativeVisualStyleId): CreativeVisualStyle => ({
  id,
  label: LABELS[id] ?? id,
});
