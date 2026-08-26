import { getBrandKit } from "./brandKit";
import type { CreativeFormat, CreativeItem, CreativeLayer, CreativeProjectDraft, CreativeProjectType, CreativeVariation, StoryboardFrame } from "./types";
import { buildDesignedCopyLayers, ensureLogoLayer } from "./designedLayers";
import { buildVisualStyleLock, getVisualStyleId, type CreativeVisualStyleId } from "./visualStyles";
import {
  approvedCopyConcepts,
  formatCopyConceptsForCreative,
  parseCopyConceptsFromPayload,
  type CopyConcept,
} from "@/components/marketing/copyConcepts";

export type { CreativeProjectType, StoryboardFrame };

const FORMAT_CLASS: Record<CreativeFormat, string> = {
  "9:16": "aspect-[9/16]",
  "1:1": "aspect-square",
  "4:5": "aspect-[4/5]",
  "16:9": "aspect-video",
};

export const aspectRatioClass = (format?: string) =>
  FORMAT_CLASS[(format as CreativeFormat) ?? "1:1"] ?? FORMAT_CLASS["1:1"];

export const getProjectType = (payload: Record<string, unknown> | null | undefined): CreativeProjectType => {
  if (payload?.project_type === "video") return "video";
  if (Array.isArray(payload?.storyboard) && payload.storyboard.length > 0) return "video";
  return "static";
};

export const projectTypeLabel = (type: CreativeProjectType) =>
  type === "video" ? "וידאו / storyboard" : "מודעה סטטית";

export const STORYBOARD_FRAME_GAP = 300;

export const storyboardFrameX = (order: number) => -(order - 1) * STORYBOARD_FRAME_GAP;

export const layoutStoryboardRtl = (frames: StoryboardFrame[]): StoryboardFrame[] => {
  if (frames.length <= 1) return frames;
  const ordered = [...frames].sort((a, b) => a.order - b.order);
  const alreadyRtl = ordered.every((frame, index) => index === 0 || frame.x < ordered[index - 1].x);
  if (alreadyRtl) return frames;
  return frames.map((frame) => ({ ...frame, x: storyboardFrameX(frame.order) }));
};

export const getStoryboard = (payload: Record<string, unknown> | null | undefined): StoryboardFrame[] => {
  const value = payload?.storyboard;
  if (!Array.isArray(value)) return [];
  const frames = value.filter((frame): frame is StoryboardFrame => {
    if (!frame || typeof frame !== "object") return false;
    return typeof (frame as StoryboardFrame).id === "string";
  }).sort((a, b) => a.order - b.order);
  return layoutStoryboardRtl(frames);
};

export const getStoryboardStyle = (payload: Record<string, unknown> | null | undefined): { lock: string; referenceImageUrl?: string } => {
  const value = payload?.storyboard_style;
  const stored = value && typeof value === "object" ? value as { referenceImageUrl?: unknown } : {};
  return {
    lock: buildVisualStyleLock(payload, { storyboard: true }),
    referenceImageUrl: typeof stored.referenceImageUrl === "string" ? stored.referenceImageUrl : undefined,
  };
};

export const storyboardReferenceUrls = (frames: StoryboardFrame[], currentId: string): string[] => {
  const ordered = [...frames].sort((a, b) => a.order - b.order);
  const current = ordered.find((frame) => frame.id === currentId);
  const previous = ordered.filter((frame) => frame.imageUrl && frame.order < (current?.order ?? Number.MAX_SAFE_INTEGER));
  const urls = previous.map((frame) => frame.imageUrl).filter((url): url is string => !!url);
  return urls.slice(-2);
};

/** First image is the style bible (faces); second is the immediately previous shot. */
export const pickStoryboardReferences = (
  frames: StoryboardFrame[],
  currentId: string,
  styleUrl?: string,
): string[] => {
  const previous = storyboardReferenceUrls(frames, currentId);
  const immediate = previous[previous.length - 1];
  const firstGenerated = [...frames]
    .sort((a, b) => a.order - b.order)
    .find((frame) => frame.imageUrl)?.imageUrl;
  const bible = styleUrl || firstGenerated;
  return [bible, immediate].filter((url, index, list): url is string => !!url && list.indexOf(url) === index);
};

export const makeStoryboardFrame = (order: number, x = storyboardFrameX(order), y = 100): StoryboardFrame => ({
  id: crypto.randomUUID(),
  order,
  title: `סצנה ${order}`,
  shot: "Medium shot",
  visualPrompt: "",
  overlayText: "",
  voiceover: "",
  duration: 3,
  x,
  y,
});

export const itemToProjectDraft = (item: CreativeItem | null): CreativeProjectDraft => {
  const kit = getBrandKit(item?.payload);
  return {
    title: item?.title ?? "",
    briefText: getBriefText(item),
    copyText: getLinkedCopyText(item),
    instructions: String(item?.payload?.instructions ?? ""),
    format: defaultFormat(item?.payload),
    projectType: getProjectType(item?.payload),
    visualStyle: getVisualStyleId(item?.payload),
    liveTextLayers: isLiveTextLayers(item?.payload),
    clientId: item?.client_id ?? null,
    clientWebsite: kit.website,
    logoUrl: kit.logoUrl,
    brandBook: kit.brandBook,
    styleReferences: kit.styleReferences,
  };
};

export const defaultFormat = (payload: Record<string, unknown> | null | undefined): CreativeFormat => {
  const value = payload?.format;
  if (value === "9:16" || value === "1:1" || value === "4:5" || value === "16:9") return value;
  return "1:1";
};

export const isLiveTextLayers = (payload: Record<string, unknown> | null | undefined): boolean =>
  payload?.live_text_layers === true;

const isVariation = (value: unknown): value is CreativeVariation => {
  if (!value || typeof value !== "object") return false;
  const variation = value as CreativeVariation;
  return typeof variation.id === "string" && typeof variation.imageUrl === "string";
};

export const getVariations = (payload: Record<string, unknown> | null | undefined): CreativeVariation[] => {
  const direct = payload?.variations;
  if (Array.isArray(direct)) {
    return direct.filter(isVariation).sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  }

  const storyboard = payload?.storyboard;
  if (Array.isArray(storyboard) && payload?.project_type !== "video") {
    return storyboard
      .filter((frame): frame is Record<string, unknown> => !!frame && typeof frame === "object")
      .map((frame, index) => {
        const imageUrl = typeof frame.imageUrl === "string" ? frame.imageUrl : "";
        if (!imageUrl) return null;
        const overlayText = typeof frame.overlayText === "string" ? frame.overlayText : "";
        return {
          id: String(frame.id ?? crypto.randomUUID()),
          name: String(frame.title ?? `סצנה ${index + 1}`),
          imageUrl,
          format: defaultFormat(payload),
          layers: [],
          comments: [],
          createdAt: new Date().toISOString(),
          source: "storyboard_import" as const,
        } satisfies CreativeVariation;
      })
      .filter((value): value is CreativeVariation => value !== null);
  }

  const imageUrl = payload?.image_url;
  if (typeof imageUrl === "string" && imageUrl) {
    return [{
      id: crypto.randomUUID(),
      name: "גרסה 1",
      imageUrl,
      format: defaultFormat(payload),
      layers: [],
      comments: [],
      createdAt: new Date().toISOString(),
      source: "ai",
    }];
  }

  return [];
};

export const buildTextLayersFromCopy = (copyText: string): CreativeLayer[] => {
  const lines = copyText
    .split("\n")
    .map((line) => line.replace(/^#+\s*/, "").replace(/\*\*/g, "").trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const headline = lines[0];
  const subline = lines[1] ?? "";

  const layers: CreativeLayer[] = [{
    id: crypto.randomUUID(),
    type: "text",
    x: 8,
    y: 62,
    width: 84,
    height: 16,
    text: headline,
    fontFamily: "Rubik",
    fontSize: 28,
    fontWeight: "700",
    color: "#ffffff",
    textAlign: "right",
  }];

  if (subline) {
    layers.push({
      id: crypto.randomUUID(),
      type: "text",
      x: 10,
      y: 78,
      width: 80,
      height: 12,
      text: subline.slice(0, 120),
      fontFamily: "Rubik",
      fontSize: 18,
      fontWeight: "500",
      color: "#f8fafc",
      textAlign: "right",
    });
  }

  return layers;
};

export const makeVariation = ({
  imageUrl,
  format,
  copyText,
  name,
  source = "ai",
  visualStyle,
  title,
  copyKey,
  copyLabel,
  conceptId,
  conceptName,
  rejected,
  rejectNote,
  parentId,
  logoUrl,
  generationCost,
  compositionId,
  brandColors,
  styleSourceId,
  liveTextLayers,
}: {
  imageUrl: string;
  format: CreativeFormat;
  copyText?: string;
  name?: string;
  source?: CreativeVariation["source"];
  visualStyle?: CreativeVisualStyleId;
  title?: string;
  copyKey?: string;
  copyLabel?: string;
  conceptId?: string;
  conceptName?: string;
  rejected?: boolean;
  rejectNote?: string;
  parentId?: string;
  logoUrl?: string;
  generationCost?: CreativeVariation["generationCost"];
  compositionId?: CreativeVariation["compositionId"];
  brandColors?: string[];
  styleSourceId?: string;
  liveTextLayers?: boolean;
}): CreativeVariation => ({
  id: crypto.randomUUID(),
  name: name ?? `גרסה ${new Date().toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}`,
  imageUrl,
  format,
  layers: liveTextLayers && visualStyle
    ? buildDesignedCopyLayers({ copyText, format, styleId: visualStyle, title, logoUrl, compositionId, brandColors })
    : ensureLogoLayer([], logoUrl),
  comments: [],
  createdAt: new Date().toISOString(),
  source,
  visualStyle,
  copyKey,
  copyLabel,
  copyText,
  conceptId,
  conceptName,
  rejected,
  rejectNote,
  parentId,
  generationCost,
  compositionId,
  styleSourceId,
});

export const getLinkedCopyText = (item: CreativeItem | null) => {
  if (!item?.payload) return "";
  return String(item.payload.copy_text ?? "");
};

export const getBriefText = (item: CreativeItem | null) => {
  if (!item?.payload) return "";
  return String(item.payload.brief_text ?? item.payload.brief ?? "");
};

export const getApprovedCopyConcepts = (item: CreativeItem | null): CopyConcept[] => {
  if (!item?.payload) return [];
  const storedApproved = parseCopyConceptsFromPayload({ copy_concepts: item.payload.approved_concepts });
  if (storedApproved.length > 0) return storedApproved.map((concept) => ({ ...concept, approved: true }));
  return approvedCopyConcepts(parseCopyConceptsFromPayload(item.payload));
};

export const getConceptBrief = (item: CreativeItem | null) => {
  if (!item?.payload) return "";
  const stored = item.payload.concept_brief;
  if (typeof stored === "string" && stored.trim()) return stored.trim();
  return formatCopyConceptsForCreative(getApprovedCopyConcepts(item));
};

export const cameFromCopy = (item: CreativeItem | null) => {
  const payload = item?.payload;
  if (!payload) return false;
  return payload.handoff_from === "copy"
    || payload.intake_source === "copy_link"
    || payload.intake_source === "copy_handoff"
    || typeof payload.linked_copy_item_id === "string"
    || payload.department === "copy";
};
