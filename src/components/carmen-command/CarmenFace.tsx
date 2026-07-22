import { useEffect, useRef } from "react";

export type CarmenFaceState = "idle" | "listening" | "speaking" | "alert";

interface CarmenFaceProps {
  state: CarmenFaceState;
  /** Live audio amplitude 0..1 (ref so the canvas loop reads it without re-renders) */
  audioLevelRef?: React.MutableRefObject<number>;
  className?: string;
}

interface Pt { x: number; y: number; }

/** Sample a smooth closed/open curve through control points (Catmull-Rom). */
function sampleCurve(ctrl: Pt[], samples: number, closed = false): Pt[] {
  const pts: Pt[] = [];
  const n = ctrl.length;
  const seg = closed ? n : n - 1;
  for (let i = 0; i < seg; i++) {
    const p0 = ctrl[(i - 1 + n) % n], p1 = ctrl[i], p2 = ctrl[(i + 1) % n], p3 = ctrl[(i + 2) % n];
    const steps = Math.max(2, Math.round(samples / seg));
    for (let s = 0; s < steps; s++) {
      const t = s / steps, t2 = t * t, t3 = t2 * t;
      pts.push({
        x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  return pts;
}

const mirror = (pts: Pt[]): Pt[] => pts.map(p => ({ x: -p.x, y: p.y }));

// Face geometry in normalized space: x,y in [-1,1], y down. Right half; mirrored for left.
const FACE_HALF: Pt[] = [
  { x: 0, y: -0.86 }, { x: 0.3, y: -0.8 }, { x: 0.52, y: -0.58 }, { x: 0.56, y: -0.22 },
  { x: 0.52, y: 0.12 }, { x: 0.42, y: 0.42 }, { x: 0.24, y: 0.66 }, { x: 0, y: 0.76 },
];
const HAIR_HALF: Pt[] = [
  { x: 0, y: -1.0 }, { x: 0.42, y: -0.92 }, { x: 0.66, y: -0.6 }, { x: 0.7, y: -0.1 },
  { x: 0.64, y: 0.42 }, { x: 0.56, y: 0.8 },
];
const BROW_R: Pt[] = [{ x: 0.14, y: -0.34 }, { x: 0.27, y: -0.39 }, { x: 0.4, y: -0.33 }];
const EYE_R: Pt[] = [
  { x: 0.15, y: -0.18 }, { x: 0.26, y: -0.235 }, { x: 0.37, y: -0.18 },
  { x: 0.26, y: -0.13 },
];
const NOSE: Pt[] = [{ x: 0.02, y: -0.16 }, { x: 0.05, y: 0.08 }, { x: -0.03, y: 0.14 }];
const LIP_TOP: Pt[] = [
  { x: -0.2, y: 0.38 }, { x: -0.08, y: 0.345 }, { x: 0, y: 0.365 }, { x: 0.08, y: 0.345 }, { x: 0.2, y: 0.38 },
];
const LIP_BOTTOM: Pt[] = [
  { x: -0.2, y: 0.38 }, { x: -0.09, y: 0.43 }, { x: 0, y: 0.445 }, { x: 0.09, y: 0.43 }, { x: 0.2, y: 0.38 },
];
const NECK_R: Pt[] = [{ x: 0.16, y: 0.74 }, { x: 0.2, y: 0.92 }, { x: 0.44, y: 1.0 }];

const COLORS = {
  idle:      { line: "167, 139, 250", dot: "196, 181, 253" },
  listening: { line: "167, 139, 250", dot: "196, 181, 253" },
  speaking:  { line: "167, 139, 250", dot: "221, 214, 254" },
  alert:     { line: "251, 191, 36",  dot: "252, 211, 77"  },
};

/**
 * Carmen's digital face — a wireframe/particle female face rendered on canvas.
 * States: idle (breathing + blink), listening (sound-wave ring), speaking
 * (audio-reactive mouth), alert (warning tint pulse).
 */
export function CarmenFace({ state, audioLevelRef, className }: CarmenFaceProps) {
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
    let blinkAt = performance.now() + 1800 + Math.random() * 3000;
    let blink = 0; // 0 open .. 1 closed
    let mouth = 0; // smoothed openness 0..1
    // Ambient particles drifting inside the silhouette
    const particles = Array.from({ length: reduced ? 0 : 26 }, (_, i) => ({
      a: (i / 26) * Math.PI * 2, r: 0.15 + ((i * 37) % 100) / 160, s: 0.0004 + ((i * 13) % 10) / 22000,
    }));

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
      const scaleBase = Math.min(w, h) / 2.35;
      const t = now / 1000;

      // Breathing + blink timing
      const breathe = reduced ? 1 : 1 + Math.sin(t * 1.1) * 0.008;
      if (!reduced) {
        if (now > blinkAt) {
          const phase = (now - blinkAt) / 130;
          blink = phase < 1 ? Math.sin(phase * Math.PI) : 0;
          if (phase >= 1) blinkAt = now + 1800 + Math.random() * 3200;
        }
      }
      // Audio-reactive mouth (smoothed); tiny idle murmur while speaking with no signal
      const targetMouth = st === "speaking" ? Math.max(level * 1.6, 0.06 + Math.sin(t * 9) * 0.03) : 0;
      mouth += (targetMouth - mouth) * 0.35;

      const c = COLORS[st];
      const alertPulse = st === "alert" ? 0.6 + Math.sin(t * 6) * 0.4 : 1;
      const scale = scaleBase * breathe;
      const jitter = (i: number, amp: number) =>
        reduced ? 0 : Math.sin(t * 1.7 + i * 1.37) * amp;

      const px = (p: Pt, i = 0, amp = 0.006) => ({
        x: cx + (p.x + jitter(i, amp)) * scale,
        y: cy + (p.y + jitter(i + 50, amp)) * scale,
      });

      ctx.clearRect(0, 0, w, h);

      const strokePoints = (pts: Pt[], lineAlpha: number, dotAlpha: number, dotEvery = 3, amp = 0.006) => {
        ctx.beginPath();
        pts.forEach((p, i) => {
          const q = px(p, i, amp);
          if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
        });
        ctx.strokeStyle = `rgba(${c.line}, ${lineAlpha * alertPulse})`;
        ctx.lineWidth = Math.max(1, scale * 0.006);
        ctx.stroke();
        ctx.shadowColor = `rgba(${c.dot}, 0.9)`;
        ctx.shadowBlur = scale * 0.05;
        for (let i = 0; i < pts.length; i += dotEvery) {
          const q = px(pts[i], i, amp);
          ctx.beginPath();
          ctx.arc(q.x, q.y, Math.max(1, scale * 0.009), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${c.dot}, ${dotAlpha * alertPulse})`;
          ctx.fill();
        }
        ctx.shadowBlur = 0;
      };

      // Hair + face contour (both halves)
      const hairR = sampleCurve(HAIR_HALF, 30);
      strokePoints(hairR, 0.28, 0.5, 4);
      strokePoints(mirror(hairR), 0.28, 0.5, 4);
      const faceR = sampleCurve(FACE_HALF, 40);
      strokePoints(faceR, 0.55, 0.85, 3);
      strokePoints(mirror(faceR), 0.55, 0.85, 3);
      // Neck
      const neckR = sampleCurve(NECK_R, 10);
      strokePoints(neckR, 0.35, 0.55, 3);
      strokePoints(mirror(neckR), 0.35, 0.55, 3);

      // Brows
      const browR = sampleCurve(BROW_R, 10);
      strokePoints(browR, 0.6, 0.8, 3, 0.004);
      strokePoints(mirror(browR), 0.6, 0.8, 3, 0.004);

      // Eyes (blink squashes vertically around the eye center)
      const squashEye = (pts: Pt[]): Pt[] => {
        const cyE = pts.reduce((s, p) => s + p.y, 0) / pts.length;
        return pts.map(p => ({ x: p.x, y: cyE + (p.y - cyE) * (1 - blink * 0.92) }));
      };
      const eyeR = squashEye(sampleCurve(EYE_R, 16, true));
      strokePoints(eyeR, 0.7, 0.95, 2, 0.003);
      strokePoints(mirror(eyeR), 0.7, 0.95, 2, 0.003);
      // Pupils
      if (blink < 0.5) {
        for (const sx of [1, -1]) {
          const q = px({ x: 0.26 * sx, y: -0.18 }, 7, 0.002);
          ctx.beginPath();
          ctx.arc(q.x, q.y, Math.max(1.5, scale * 0.016), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${c.dot}, ${0.95 * (1 - blink) * alertPulse})`;
          ctx.shadowColor = `rgba(${c.dot}, 1)`;
          ctx.shadowBlur = scale * 0.08;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }

      // Nose
      strokePoints(sampleCurve(NOSE, 8), 0.4, 0.6, 3, 0.003);

      // Mouth — lips separate by `mouth`
      const open = mouth * 0.13;
      const lipTop = sampleCurve(LIP_TOP, 16).map(p => ({ x: p.x, y: p.y - open * 0.25 }));
      const lipBot = sampleCurve(LIP_BOTTOM, 16).map(p => ({ x: p.x, y: p.y + open }));
      strokePoints(lipTop, 0.75, 0.95, 2, 0.002);
      strokePoints(lipBot, 0.75, 0.95, 2, 0.002);

      // Ambient particles
      for (const p of particles) {
        p.a += p.s * 16;
        const q = { x: Math.cos(p.a) * p.r * 0.7, y: Math.sin(p.a * 0.8) * p.r };
        const s = px(q, 0, 0);
        ctx.beginPath();
        ctx.arc(s.x, s.y, Math.max(0.8, scale * 0.004), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${c.dot}, 0.18)`;
        ctx.fill();
      }

      // Listening: expanding sound-wave rings around the face
      if (st === "listening" && !reduced) {
        for (let k = 0; k < 3; k++) {
          const phase = ((t * 0.6 + k / 3) % 1);
          ctx.beginPath();
          ctx.arc(cx, cy, scale * (0.95 + phase * 0.35), 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(${c.line}, ${0.35 * (1 - phase)})`;
          ctx.lineWidth = Math.max(1, scale * 0.005);
          ctx.stroke();
        }
      }
      // Speaking: ripples emanating from the mouth
      if (st === "speaking" && !reduced && mouth > 0.04) {
        const m = px({ x: 0, y: 0.4 }, 0, 0);
        for (let k = 0; k < 2; k++) {
          const phase = ((t * 1.2 + k / 2) % 1);
          ctx.beginPath();
          ctx.arc(m.x, m.y, scale * (0.15 + phase * 0.45), Math.PI * 0.15, Math.PI * 0.85);
          ctx.strokeStyle = `rgba(${c.line}, ${0.4 * mouth * (1 - phase)})`;
          ctx.lineWidth = Math.max(1, scale * 0.005);
          ctx.stroke();
        }
      }

      if (reduced) {
        // Calm mode: re-render slowly (mouth/blink state changes only)
        setTimeout(() => { if (running) raf = requestAnimationFrame(draw); }, 200);
      } else {
        raf = requestAnimationFrame(draw);
      }
    };
    raf = requestAnimationFrame(draw);

    return () => { running = false; cancelAnimationFrame(raf); ro.disconnect(); };
  }, [audioLevelRef]);

  return <canvas ref={canvasRef} className={className} aria-label="הפנים הדיגיטליות של כרמן" role="img" />;
}
