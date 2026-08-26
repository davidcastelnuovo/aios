/** Normalized 0–1 coordinates on the working still. */
export type ErasePoint = { x: number; y: number };

export type EraseMark =
  | { type: "stroke"; points: ErasePoint[]; radius: number }
  | { type: "rect"; x: number; y: number; width: number; height: number };

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export const buildErasePrompt = (hint?: string): string => {
  const what = hint?.trim();
  return [
    "INPAINT / ERASE. Delete only the masked (transparent) region.",
    what ? `The marked content is: «${what}». Remove it completely.` : "Remove whatever sits under the mask.",
    "Reconstruct the photograph underneath from surrounding pixels, lighting, and texture.",
    "Do not add letters, numbers, logos, watermarks, buttons, or new objects.",
    "Keep every unmasked pixel: faces, composition, remaining Hebrew type, crop.",
    "If a reference shows red overlay marks, those marks AND the content under them must disappear.",
  ].join(" ");
};

export const createKeepMask = (width: number, height: number): Uint8ClampedArray => {
  const data = new Uint8ClampedArray(Math.max(1, width) * Math.max(1, height) * 4);
  data.fill(255);
  return data;
};

export const maskHasCoverage = (data: Uint8ClampedArray): boolean => {
  for (let index = 3; index < data.length; index += 4) {
    if (data[index] < 128) return true;
  }
  return false;
};

const erasePixel = (data: Uint8ClampedArray, width: number, height: number, x: number, y: number) => {
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const index = (y * width + x) * 4;
  data[index] = 0;
  data[index + 1] = 0;
  data[index + 2] = 0;
  data[index + 3] = 0;
};

const interpolate = (points: ErasePoint[]): ErasePoint[] => {
  if (points.length <= 1) return points;
  const result: ErasePoint[] = [points[0]];
  for (let index = 1; index < points.length; index += 1) {
    const prev = points[index - 1];
    const next = points[index];
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) * 80));
    for (let step = 1; step <= steps; step += 1) {
      result.push({ x: prev.x + (dx * step) / steps, y: prev.y + (dy * step) / steps });
    }
  }
  return result;
};

export const applyEraseMarks = (
  data: Uint8ClampedArray,
  width: number, height: number,
  marks: EraseMark[],
): Uint8ClampedArray => {
  for (const mark of marks) {
    if (mark.type === "rect") {
      const left = Math.floor(clamp01(mark.x) * width);
      const top = Math.floor(clamp01(mark.y) * height);
      const right = Math.ceil(clamp01(mark.x + mark.width) * width);
      const bottom = Math.ceil(clamp01(mark.y + mark.height) * height);
      for (let y = top; y < bottom; y += 1) {
        for (let x = left; x < right; x += 1) erasePixel(data, width, height, x, y);
      }
      continue;
    }
    const radius = Math.max(1, Math.round(mark.radius * Math.min(width, height)));
    for (const point of interpolate(mark.points)) {
      const cx = Math.round(clamp01(point.x) * (width - 1));
      const cy = Math.round(clamp01(point.y) * (height - 1));
      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          if (dx * dx + dy * dy <= radius * radius) erasePixel(data, width, height, cx + dx, cy + dy);
        }
      }
    }
  }
  return data;
};
