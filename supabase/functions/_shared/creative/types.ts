import type { CompositionId } from "./compositions.ts";

export type CreativeFormat = "9:16" | "1:1" | "4:5" | "16:9";

export type CreativeVisualStyleId =
  | "adaptive"
  | "swiss"
  | "industrial"
  | "mediterranean"
  | "kinetic"
  | "glass"
  | "collage"
  | "bauhaus"
  | "cinematic"
  | "holographic"
  | "organic"
  | "photoreal"
  | "animation"
  | "illustration"
  | "popart"
  | "render3d"
  | "editorial"
  | "ugc"
  | "watercolor"
  | "comic";

export type LayerShadowStyle = "none" | "soft" | "extrude" | "halo";

export type CreativeLayerRole =
  | "logo"
  | "hero"
  | "type_field"
  | "headline"
  | "sub"
  | "bullet"
  | "icon"
  | "icon_label"
  | "footer"
  | "cta"
  | "cta_fill"
  | "divider";

export interface CreativeLayer {
  id: string;
  type: "background" | "text" | "shape" | "image";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  src?: string;
  role?: CreativeLayerRole;
  icon?: string;
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string;
  color?: string;
  textAlign?: "right" | "center" | "left";
  fill?: string;
  opacity?: number;
  borderRadius?: number;
  textShadow?: string;
  boxShadow?: string;
  letterSpacing?: string;
  lineHeight?: number;
  shadowStyle?: LayerShadowStyle;
  shadowDepth?: number;
  shadowColor?: string;
  shadowBlur?: number;
  locked?: boolean;
}

export interface CreativeVariation {
  id: string;
  name: string;
  imageUrl: string;
  format: CreativeFormat;
  layers: CreativeLayer[];
  comments: CreativeComment[];
  createdAt: string;
  source?: "ai" | "manual_edit" | "storyboard_import";
  visualStyle?: CreativeVisualStyleId;
  copyKey?: string;
  copyLabel?: string;
  copyText?: string;
  conceptId?: string;
  conceptName?: string;
  rejected?: boolean;
  rejectNote?: string;
  parentId?: string;
  compositionId?: CompositionId;
  styleSourceId?: string;
}

export interface CreativeComment {
  id: string;
  text: string;
  createdAt: string;
}
