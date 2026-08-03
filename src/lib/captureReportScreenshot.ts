import { toJpeg } from "html-to-image";
import { waitForSnapshotReady } from "@/lib/reportSync";

export type CaptureReportScreenshotResult = {
  dataUrl: string;
  blob: Blob;
};

/**
 * Capture a report snapshot node to JPEG (faster encode + smaller than PNG).
 * Mirrors the cropping / canvas-size guards used by ClientReportPanel.
 */
export async function captureReportScreenshotNode(
  node: HTMLElement,
  options?: { settleMs?: number; timeoutMs?: number },
): Promise<CaptureReportScreenshotResult> {
  await waitForSnapshotReady(node, options?.timeoutMs ?? 30_000, {
    settleMs: options?.settleMs ?? 200,
  });

  const endMarker = node.querySelector<HTMLElement>('[data-snapshot-end="true"]');
  let height: number | undefined;
  if (endMarker) {
    const nodeRect = node.getBoundingClientRect();
    const markerRect = endMarker.getBoundingClientRect();
    const computed = Math.ceil(markerRect.top - nodeRect.top);
    if (computed > 100) height = computed;
  }

  const MAX_CANVAS_PX = 16000;
  const fullHeight = height ?? Math.ceil(node.getBoundingClientRect().height);
  const widthPx = Math.max(node.getBoundingClientRect().width, node.scrollWidth || 0);
  const totalPx = fullHeight * widthPx;

  let pixelRatio = 1.25;
  if (totalPx > 6_000_000) pixelRatio = 1.0;
  if (totalPx > 12_000_000) pixelRatio = 0.85;
  if (totalPx > 20_000_000) pixelRatio = 0.7;
  if (fullHeight * pixelRatio > MAX_CANVAS_PX) {
    pixelRatio = Math.max(0.75, MAX_CANVAS_PX / fullHeight);
  }

  let captureHeight = height;
  if (fullHeight * pixelRatio > MAX_CANVAS_PX) {
    captureHeight = Math.floor(MAX_CANVAS_PX / pixelRatio);
  }

  const dataUrl = await toJpeg(node, {
    quality: 0.82,
    pixelRatio,
    backgroundColor: "#ffffff",
    skipFonts: true,
    ...(captureHeight
      ? { height: captureHeight, canvasHeight: Math.floor(captureHeight * pixelRatio) }
      : {}),
  });

  if (!dataUrl || dataUrl.length < 200) {
    throw new Error("Screenshot produced an empty image (canvas too large?)");
  }

  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return { dataUrl, blob };
}
