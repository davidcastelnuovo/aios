// Camera-bubble compositor: burns a clean circular camera overlay directly
// into the recorded video frames. Runs in a Worker with insertable streams
// (MediaStreamTrackProcessor readables piped in from the page), so it is NOT
// subject to background-tab rAF/timer throttling — the recorder window can be
// minimized and compositing continues at full frame rate.
//
// The bubble exists only inside the recording: nothing floats on screen, so
// there is no rectangular OS window to be captured.

type Corner = "bottom-right" | "bottom-left" | "top-right" | "top-left";

let latestCam: VideoFrame | null = null;
let corner: Corner = "bottom-right";
let canvas: OffscreenCanvas | null = null;
let ctx: OffscreenCanvasRenderingContext2D | null = null;

function drawBubble(width: number, height: number) {
  if (!ctx || !latestCam) return;
  const d = Math.round(Math.min(width, height) * 0.22); // bubble diameter
  const m = Math.round(d * 0.18);                        // margin from edges
  const x = corner.includes("right") ? width - d - m : m;
  const y = corner.includes("bottom") ? height - d - m : m;
  const cx = x + d / 2;
  const cy = y + d / 2;

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, d / 2, 0, Math.PI * 2);
  ctx.clip();
  // cover-fit the camera frame into the circle
  const cw = latestCam.displayWidth || 640;
  const ch = latestCam.displayHeight || 480;
  const s = Math.max(d / cw, d / ch);
  ctx.drawImage(latestCam, cx - (cw * s) / 2, cy - (ch * s) / 2, cw * s, ch * s);
  ctx.restore();

  // thin clean border
  ctx.beginPath();
  ctx.arc(cx, cy, d / 2 - 1.5, 0, Math.PI * 2);
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(255,255,255,0.92)";
  ctx.stroke();
}

self.onmessage = (e: MessageEvent) => {
  const data = e.data as {
    corner?: Corner;
    screen?: ReadableStream<VideoFrame>;
    cam?: ReadableStream<VideoFrame>;
    out?: WritableStream<VideoFrame>;
  };

  if (data.corner) corner = data.corner;
  if (!data.screen || !data.cam || !data.out) return;

  // Keep only the freshest camera frame.
  data.cam.pipeTo(new WritableStream<VideoFrame>({
    write(frame) {
      latestCam?.close();
      latestCam = frame;
    },
    close() {
      latestCam?.close();
      latestCam = null;
    },
  })).catch(() => { /* camera ended */ });

  data.screen
    .pipeThrough(new TransformStream<VideoFrame, VideoFrame>({
      transform(frame, controller) {
        const w = frame.displayWidth;
        const h = frame.displayHeight;
        if (!canvas || canvas.width !== w || canvas.height !== h) {
          canvas = new OffscreenCanvas(w, h);
          ctx = canvas.getContext("2d");
        }
        if (!ctx) {
          controller.enqueue(frame);
          return;
        }
        ctx.drawImage(frame, 0, 0, w, h);
        drawBubble(w, h);
        const out = new VideoFrame(canvas, { timestamp: frame.timestamp ?? undefined });
        frame.close();
        controller.enqueue(out);
      },
    }))
    .pipeTo(data.out)
    .catch(() => { /* recording stopped */ });
};
