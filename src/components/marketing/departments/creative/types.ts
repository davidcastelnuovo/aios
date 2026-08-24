export type CreativeFormat = "9:16" | "1:1" | "4:5" | "16:9";

import type { CreativeVisualStyleId } from "./visualStyles";

export type CreativeProjectType = "static" | "video";

export type { CreativeVisualStyleId };

export interface StoryboardStyleLock {
  lock: string;
  referenceImageUrl?: string;
}

export interface StoryboardFrame {
  id: string;
  order: number;
  title: string;
  shot: string;
  visualPrompt: string;
  overlayText: string;
  voiceover: string;
  duration: number;
  imageUrl?: string;
  x: number;
  y: number;
}

export interface CreativeComment {
  id: string;
  text: string;
  createdAt: string;
}

export type LayerShadowStyle = "none" | "soft" | "extrude";

export interface CreativeLayer {
  id: string;
  type: "background" | "text" | "shape";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
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
  rejected?: boolean;
  rejectNote?: string;
  parentId?: string;
}

export interface CreativeItem {
  id: string;
  title: string | null;
  status: string;
  client_id: string | null;
  payload: Record<string, unknown> | null;
  current_stage_id: string | null;
  target_channel: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreativeAssetRow {
  id: string;
  type: string;
  url: string | null;
  content: string | null;
  meta: {
    source?: string;
    variation_id?: string;
    variation_name?: string;
    comments?: CreativeComment[];
    layers?: CreativeLayer[];
    format?: CreativeFormat;
  } | null;
  created_at: string;
  run_id: string | null;
}

export interface CreativeProjectDraft {
  title: string;
  briefText: string;
  copyText: string;
  instructions: string;
  format: CreativeFormat;
  projectType: CreativeProjectType;
  visualStyle: CreativeVisualStyleId;
}
