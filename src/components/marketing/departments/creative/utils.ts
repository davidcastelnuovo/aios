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
          layers: overlayText ? buildTextLayersFromCopy(overlayText) : [],
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
      layers: buildTextLayersFromCopy(String(payload?.copy_text ?? "")),
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
  layers: buildTextLayersFromCopy(copyText ?? ""),
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
