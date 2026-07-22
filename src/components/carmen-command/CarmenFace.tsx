import { useEffect, useRef } from "react";

export type CarmenFaceState = "idle" | "listening" | "speaking" | "alert";

interface CarmenFaceProps {
  state: CarmenFaceState;
  /** Live audio amplitude 0..1 (ref so the canvas loop reads it without re-renders) */
  audioLevelRef?: React.MutableRefObject<number>;
  className?: string;
  /** Override the hologram portrait (defaults to Carmen's generated hologram) */
  imageUrl?: string;
}

// AI-generated hologram portrait of Carmen (fedora, electric-blue particles).
// Served from CDN like the header CARMEN_ICON; the component degrades to a
// procedural glow if the image can't load.
const CARMEN_HOLOGRAM_URL =
  "https://d8j0ntlcm91z4.cloudfront.net/user_3BBiWCZmwyTleUe5EJZHttLX0mx/hf_20260722_173953_d31cce6f-5f35-4405-86f2-c7a6592778d1.png";

// Where the mouth sits inside the portrait (fractions of image width/height)
const MOUTH_X = 0.5;
const MOUTH_Y = 0.615;

const COLORS = {
  idle:      { line: "76, 195, 255", dot: "160, 220, 255" },
  listening: { line: "76, 195, 255", dot: "160, 220, 255" },
  speaking:  { line: "120, 210, 255", dot: "200, 235, 255" },
  alert:     { line: "251, 191, 36", dot: "252, 211, 77" },
};

/**
 * Carmen's hologram — the portrait drawn on canvas with restrained live
 * overlays only: breathing scale, listening sound-waves, an audio-reactive
 * mouth glow while speaking, and an amber tint pulse on alert. The artwork
 * itself carries the rings/sparkles, so nothing synthetic is drawn on top.
 */
export function CarmenFace({ state, audioLevelRef, className, imageUrl }: CarmenFaceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<CarmenFaceState>(state);
  stateRef.current = state;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let running = true;
    let mouth = 0;

    // No crossOrigin: we only draw (never read pixels), so a tainted canvas is
    // fine and we avoid depending on the CDN's CORS headers.
    const img = new Image();
    let imgReady = false;
    let imgFailed = false;
    img.onload = () => { imgReady = true; };
    img.onerror = () => { imgFailed = true; };
    img.src = imageUrl || CARMEN_HOLOGRAM_URL;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const draw = (now: number) => {
      if (!running) return;
      const st = stateRef.current;
      const level = Math.min(1, Math.max(0, audioLevelRef?.current ?? 0));
      const w = canvas.width, h = canvas.height;
      const cx = w / 2, cy = h / 2;
      const t = now / 1000;
      const c = COLORS[st];
      const alertPulse = st === "alert" ? 0.6 + Math.sin(t * 6) * 0.4 : 1;

      const targetMouth = st === "speaking" ? Math.max(level * 1.5, 0.08) : 0;
      mouth += (targetMouth - mouth) * 0.3;

      ctx.clearRect(0, 0, w, h);

      // Portrait — square image fitted to the panel, breathing gently
      const breathe = reduced ? 1 : 1 + Math.sin(t * 1.1) * 0.006;
      const side = Math.min(w, h) * 1.0 * breathe;
      const ix = cx - side / 2, iy = cy - side / 2;
      let mouthPx = { x: cx, y: cy + side * 0.1 };

      if (imgReady && !imgFailed) {
        // Speaking adds a subtle overall brightness lift on top of the mouth glow
        ctx.globalAlpha = 0.92 + (st === "speaking" ? mouth * 0.08 : 0);
        ctx.drawImage(img, ix, iy, side, side);
        ctx.globalAlpha = 1;
        mouthPx = { x: ix + side * MOUTH_X, y: iy + side * MOUTH_Y };

        if (st === "alert") {
          // Amber tint over the hologram only (keeps the background clean)
          ctx.globalCompositeOperation = "source-atop";
          ctx.fillStyle = `rgba(251, 191, 36, ${0.14 * alertPulse})`;
          ctx.fillRect(ix, iy, side, side);
          ctx.globalCompositeOperation = "source-over";
        }
      } else {
        // Fallback: a glowing core while the image loads (or if it never does)
        const orb = ctx.createRadialGradient(cx, cy, 0, cx, cy, side * 0.4);
        orb.addColorStop(0, `rgba(${c.line}, 0.35)`);
        orb.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = orb;
        ctx.fillRect(0, 0, w, h);
      }

      // Audio-reactive mouth glow — Carmen's voice literally lights her lips
      if (mouth > 0.02) {
        const r = side * (0.05 + mouth * 0.09);
        const g = ctx.createRadialGradient(mouthPx.x, mouthPx.y, 0, mouthPx.x, mouthPx.y, r);
        g.addColorStop(0, `rgba(${c.dot}, ${0.5 * mouth})`);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = g;
        ctx.fillRect(mouthPx.x - r, mouthPx.y - r, r * 2, r * 2);
        ctx.globalCompositeOperation = "source-over";
        // ripples spreading from the mouth
        if (!reduced) {
          for (let k = 0; k < 2; k++) {
            const phase = ((t * 1.2 + k / 2) % 1);
            ctx.beginPath();
            ctx.arc(mouthPx.x, mouthPx.y, side * (0.06 + phase * 0.22), Math.PI * 0.15, Math.PI * 0.85);
            ctx.strokeStyle = `rgba(${c.line}, ${0.35 * mouth * (1 - phase)})`;
            ctx.lineWidth = Math.max(1, side * 0.0025);
            ctx.stroke();
          }
        }
      }

      // The reference artwork already carries its own rings and sparkles —
      // no synthetic orbital rings or particles on top; the portrait stays clean.

      // Listening: expanding sound-wave rings around the hologram
      if (st === "listening" && !reduced) {
        for (let k = 0; k < 3; k++) {
          const phase = ((t * 0.6 + k / 3) % 1);
          ctx.beginPath();
          ctx.arc(cx, cy, side * (0.47 + phase * 0.16), 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(${c.line}, ${0.3 * (1 - phase)})`;
          ctx.lineWidth = Math.max(1, side * 0.002);
          ctx.stroke();
        }
      }

      if (reduced) {
        setTimeout(() => { if (running) raf = requestAnimationFrame(draw); }, 200);
      } else {
        raf = requestAnimationFrame(draw);
      }
    };
    raf = requestAnimationFrame(draw);

    return () => { running = false; cancelAnimationFrame(raf); ro.disconnect(); };
  }, [audioLevelRef, imageUrl]);

  return <canvas ref={canvasRef} className={className} aria-label="ההולוגרמה של כרמן" role="img" />;
}
