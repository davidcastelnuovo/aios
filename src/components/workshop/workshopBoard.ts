export type FlowNode = {
  id: string;
  type: "workshop";
  position: { x: number; y: number };
  data: { label: string; kind: "project" | "step"; ready?: boolean };
};

export type FlowEdge = { id: string; source: string; target: string };

/** Cards on the pannable board, spaced far enough apart to move between them. */
export function workshopFlow(
  title: string | null | undefined,
  payload: Record<string, unknown> | null | undefined,
): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const steps = boardSteps(payload);
  const nodes: FlowNode[] = [
    {
      id: "project",
      type: "workshop",
      position: { x: 40, y: 220 },
      data: { label: title?.trim() || "פרויקט", kind: "project" },
    },
    ...steps.map((step, index) => ({
      id: step.id,
      type: "workshop" as const,
      position: { x: 380 + index * 340, y: index % 2 === 0 ? 80 : 360 },
      data: { label: step.label, kind: "step" as const, ready: step.ready },
    })),
  ];
  const edges: FlowEdge[] = steps.map((step, index) => ({
    id: `to-${step.id}`,
    source: index === 0 ? "project" : steps[index - 1].id,
    target: step.id,
  }));
  return { nodes, edges };
}

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
