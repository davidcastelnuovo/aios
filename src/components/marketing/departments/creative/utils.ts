import type { CreativeFormat, CreativeItem, CreativeLayer, CreativeProjectDraft, CreativeProjectType, CreativeVariation, StoryboardFrame } from "./types";

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

export const getStoryboard = (payload: Record<string, unknown> | null | undefined): StoryboardFrame[] => {
  const value = payload?.storyboard;
  if (!Array.isArray(value)) return [];
  return value.filter((frame): frame is StoryboardFrame => {
    if (!frame || typeof frame !== "object") return false;
    return typeof (frame as StoryboardFrame).id === "string";
  });
};

export const DEFAULT_STORYBOARD_STYLE_LOCK = [
  "VISUAL CONTINUITY BIBLE — every frame is the same commercial:",
  "- Medium: photoreal cinematic photography only.",
  "- Forbidden: illustration, infographic, collage, split-screen, comic, 3D arrows, stock montage, mixed art styles.",
  "- Camera: 35mm, shallow depth of field, natural motivated lighting, same color grade.",
  "- Palette: warm neutrals (cream, walnut, charcoal) plus one muted teal accent.",
  "- Cast: same people, faces, age, and wardrobe if they already appeared.",
  "- One continuous photographic moment per frame, same world and location family.",
].join("\n");

export const getStoryboardStyle = (payload: Record<string, unknown> | null | undefined): { lock: string; referenceImageUrl?: string } => {
  const value = payload?.storyboard_style;
  if (!value || typeof value !== "object") return { lock: DEFAULT_STORYBOARD_STYLE_LOCK };
  const style = value as { lock?: unknown; referenceImageUrl?: unknown };
  return {
    lock: typeof style.lock === "string" && style.lock.trim() ? style.lock : DEFAULT_STORYBOARD_STYLE_LOCK,
    referenceImageUrl: typeof style.referenceImageUrl === "string" ? style.referenceImageUrl : undefined,
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

export const makeStoryboardFrame = (order: number, x = (order - 1) * 300, y = 100): StoryboardFrame => ({
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

export const itemToProjectDraft = (item: CreativeItem | null): CreativeProjectDraft => ({
  title: item?.title ?? "",
  briefText: getBriefText(item),
  copyText: getLinkedCopyText(item),
  instructions: String(item?.payload?.instructions ?? ""),
  format: defaultFormat(item?.payload),
  projectType: getProjectType(item?.payload),
});

export const defaultFormat = (payload: Record<string, unknown> | null | undefined): CreativeFormat => {
  const value = payload?.format;
  if (value === "9:16" || value === "1:1" || value === "4:5" || value === "16:9") return value;
  return "1:1";
};

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
}: {
  imageUrl: string;
  format: CreativeFormat;
  copyText?: string;
  name?: string;
  source?: CreativeVariation["source"];
}): CreativeVariation => ({
  id: crypto.randomUUID(),
  name: name ?? `גרסה ${new Date().toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}`,
  imageUrl,
  format,
  layers: [],
  comments: [],
  createdAt: new Date().toISOString(),
  source,
});

export const getLinkedCopyText = (item: CreativeItem | null) => {
  if (!item?.payload) return "";
  return String(item.payload.copy_text ?? "");
};

export const getBriefText = (item: CreativeItem | null) => {
  if (!item?.payload) return "";
  return String(item.payload.brief_text ?? item.payload.brief ?? "");
};

export const cameFromCopy = (item: CreativeItem | null) =>
  item?.payload?.handoff_from === "copy" || item?.payload?.department === "copy";
