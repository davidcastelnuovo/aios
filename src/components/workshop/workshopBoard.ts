export type BoardStepId = "images" | "copy" | "storyboard" | "animation";

export type BoardStep = {
  id: BoardStepId;
  label: string;
  ready: boolean;
};

const text = (value: unknown) =>
  typeof value === "string" && value.trim().length > 0;

const list = (value: unknown) => Array.isArray(value) && value.length > 0;

/** What one project already holds, in the order the workshop shows it. */
export function boardSteps(
  payload: Record<string, unknown> | null | undefined,
): BoardStep[] {
  const data = payload ?? {};
  const video =
    data.video && typeof data.video === "object"
      ? (data.video as Record<string, unknown>)
      : null;
  const production =
    video?.production && typeof video.production === "object"
      ? (video.production as Record<string, unknown>)
      : null;
  return [
    {
      id: "images",
      label: "תמונות",
      ready: list(data.variations) || text(data.image_url),
    },
    {
      id: "copy",
      label: "קופי",
      ready:
        list(data.copy_concepts) ||
        text(data.copy_text) ||
        text(data.brief_text),
    },
    {
      id: "storyboard",
      label: "סטוריבורד",
      ready: list(data.storyboard) || data.project_type === "video",
    },
    {
      id: "animation",
      label: "הנפשה",
      ready: production?.status === "done" || production?.status === "running",
    },
  ];
}
