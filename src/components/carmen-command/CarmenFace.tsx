import { useEffect, useRef } from "react";

export type CarmenFaceState = "idle" | "listening" | "speaking" | "alert";

interface CarmenFaceProps {
  state: CarmenFaceState;
  /** Live audio amplitude 0..1 (ref so the canvas loop reads it without re-renders) */
  audioLevelRef?: React.MutableRefObject<number>;
  className?: string;
}

interface P3 { x: number; y: number; z: number; }
interface Pt { x: number; y: number; }

/** Sample a smooth open curve through 3D control points (Catmull-Rom per axis). */
function sampleCurve3(ctrl: P3[], samples: number): P3[] {
  const pts: P3[] = [];
  const n = ctrl.length;
  for (let i = 0; i < n - 1; i++) {
    const p0 = ctrl[Math.max(0, i - 1)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(n - 1, i + 2)];
    const steps = Math.max(2, Math.round(samples / (n - 1)));
    for (let s = 0; s < steps; s++) {
      const t = s / steps, t2 = t * t, t3 = t2 * t;
      const c = (a: number, b: number, cc: number, d: number) =>
        0.5 * ((2 * b) + (-a + cc) * t + (2 * a - 5 * b + 4 * cc - d) * t2 + (-a + 3 * b - 3 * cc + d) * t3);
      pts.push({ x: c(p0.x, p1.x, p2.x, p3.x), y: c(p0.y, p1.y, p2.y, p3.y), z: c(p0.z, p1.z, p2.z, p3.z) });
    }
  }
  pts.push(ctrl[n - 1]);
  return pts;
}

const mirror3 = (pts: P3[]): P3[] => pts.map(p => ({ x: -p.x, y: p.y, z: p.z }));

/* ---------- Geometry (normalized: x right, y down, z toward viewer) ---------- */

// Face dome radii at a given y (forehead hidden under the hat, tapered chin)
function faceRx(y: number): number {
  const base = 0.52 * Math.sqrt(Math.max(0.05, 1 - (y / 0.7) ** 2));
  return y > 0.2 ? base * (1 - (y - 0.2) * 0.5) : base;
}
function faceRz(y: number): number {
  return 0.46 * Math.sqrt(Math.max(0.05, 1 - (y / 0.74) ** 2));
}

function buildFaceMesh(): P3[][] {
  const lines: P3[][] = [];
  // latitude rings (front half only)
  for (let i = 0; i <= 8; i++) {
    const y = -0.26 + (0.86 / 8) * i;
    const row: P3[] = [];
    for (let s = 0; s <= 22; s++) {
      const phi = -1.25 + (2.5 / 22) * s;
      row.push({ x: faceRx(y) * Math.sin(phi), y, z: faceRz(y) * Math.cos(phi) });
    }
    lines.push(row);
  }
  // longitude arcs
  for (let l = 0; l <= 6; l++) {
    const phi = -1.25 + (2.5 / 6) * l;
    const col: P3[] = [];
    for (let s = 0; s <= 14; s++) {
      const y = -0.26 + (0.86 / 14) * s;
      col.push({ x: faceRx(y) * Math.sin(phi), y, z: faceRz(y) * Math.cos(phi) });
    }
    lines.push(col);
  }
  return lines;
}

function buildHat(): P3[][] {
  const lines: P3[][] = [];
  // Brim — wide front arc dipping over the eyes, doubled for thickness
  for (const [r, dy] of [[0.98, 0], [0.9, -0.015]] as const) {
    const arc: P3[] = [];
    for (let s = 0; s <= 26; s++) {
      const phi = -1.45 + (2.9 / 26) * s;
      arc.push({ x: r * Math.sin(phi), y: -0.3 + 0.055 * Math.cos(phi) + dy, z: 0.5 * Math.cos(phi) + 0.1 });
    }
    lines.push(arc);
  }
  // Crown — short and wide, sitting right on the brim (fedora, not a lampshade)
  const ring = (r: number, y: number, zs: number): P3[] => {
    const arc: P3[] = [];
    for (let s = 0; s <= 18; s++) {
      const phi = -1.25 + (2.5 / 18) * s;
      arc.push({ x: r * Math.sin(phi), y, z: zs * Math.cos(phi) });
    }
    return arc;
  };
  const bottom = ring(0.68, -0.33, 0.44);
  const top = ring(0.54, -0.74, 0.34);
  lines.push(bottom, top);
  for (const phi of [-1.25, -0.55, 0.55, 1.25]) {
    lines.push(sampleCurve3([
      { x: 0.68 * Math.sin(phi), y: -0.33, z: 0.44 * Math.cos(phi) },
      { x: 0.62 * Math.sin(phi), y: -0.55, z: 0.4 * Math.cos(phi) },
      { x: 0.54 * Math.sin(phi), y: -0.74, z: 0.34 * Math.cos(phi) },
    ], 8));
  }
  // center crease of the fedora crown
  lines.push(sampleCurve3([
    { x: 0, y: -0.74, z: 0.34 }, { x: 0.02, y: -0.62, z: 0.4 }, { x: 0, y: -0.5, z: 0.43 },
  ], 8));
  return lines;
}

function buildHairSide(): P3[][] {
  const strand = (o: number): P3[] => sampleCurve3([
    { x: 0.46 + o * 0.5, y: -0.3, z: 0.2 },
    { x: 0.58 + o, y: 0.02, z: 0.1 },
    { x: 0.54 + o, y: 0.36, z: 0.04 },
    { x: 0.4 + o * 0.6, y: 0.6, z: 0 },
  ], 16);
  return [strand(0), strand(0.05), strand(0.1)];
}

function buildCollarSide(): P3[][] {
  // Big coat collar rising in front of the jaw — the strongest, closest shape.
  // The inner edges of the two sides converge to a tight V under the lips.
  const outline = sampleCurve3([
    { x: 0.68, y: 1.05, z: 0.5 },
    { x: 0.5, y: 0.56, z: 0.52 },
    { x: 0.2, y: 0.3, z: 0.55 },
    { x: 0.06, y: 0.62, z: 0.55 },
    { x: 0.03, y: 1.05, z: 0.53 },
  ], 30);
  const fold = sampleCurve3([
    { x: 0.56, y: 1.05, z: 0.51 },
    { x: 0.42, y: 0.62, z: 0.53 },
    { x: 0.24, y: 0.42, z: 0.55 },
  ], 14);
  return [outline, fold];
}

// Facial features (z sits on the dome front)
const EYE_R: P3[] = [
  { x: 0.07, y: -0.1, z: 0.4 }, { x: 0.24, y: -0.195, z: 0.42 }, { x: 0.44, y: -0.09, z: 0.37 },
  { x: 0.24, y: -0.03, z: 0.42 }, { x: 0.07, y: -0.1, z: 0.4 },
];
const NOSE: P3[] = [{ x: 0.015, y: 0.02, z: 0.46 }, { x: 0.045, y: 0.16, z: 0.46 }, { x: -0.02, y: 0.2, z: 0.47 }];
const LIP_TOP: P3[] = [
  { x: -0.13, y: 0.36, z: 0.45 }, { x: -0.05, y: 0.335, z: 0.46 }, { x: 0, y: 0.35, z: 0.46 },
  { x: 0.05, y: 0.335, z: 0.46 }, { x: 0.13, y: 0.36, z: 0.45 },
];
const LIP_BOTTOM: P3[] = [
  { x: -0.13, y: 0.36, z: 0.45 }, { x: -0.06, y: 0.41, z: 0.46 }, { x: 0, y: 0.425, z: 0.46 },
  { x: 0.06, y: 0.41, z: 0.46 }, { x: 0.13, y: 0.36, z: 0.45 },
];

const FACE_MESH = buildFaceMesh();
const HAT = buildHat();
const HAIR_R = buildHairSide();
const HAIR_L = HAIR_R.map(mirror3);
const COLLAR_R = buildCollarSide();
const COLLAR_L = COLLAR_R.map(mirror3);
const EYE_L = mirror3(EYE_R);

const COLORS = {
  idle:      { line: "46, 230, 166", dot: "110, 240, 200" },
  listening: { line: "46, 230, 166", dot: "110, 240, 200" },
  speaking:  { line: "46, 230, 166", dot: "167, 250, 220" },
  alert:     { line: "251, 191, 36", dot: "252, 211, 77"  },
};

/**
 * Carmen's digital face — a Carmen-Sandiego-style portrait (fedora, intense
 * eyes, raised coat collar) rendered as a dense 3D wireframe with a slow yaw
 * sway for depth. States: idle (breathing + blink), listening (sound rings),
 * speaking (audio-reactive mouth), alert (warning tint).
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
    let blink = 0;
    let mouth = 0;
    const particles = Array.from({ length: reduced ? 0 : 30 }, (_, i) => ({
      a: (i / 30) * Math.PI * 2, r: 0.2 + ((i * 37) % 100) / 130, s: 0.0004 + ((i * 13) % 10) / 22000,
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
      const scale = (Math.min(w, h) / 2.5) * (reduced ? 1 : 1 + Math.sin(now / 1000 * 1.1) * 0.006);
      const t = now / 1000;
      const yaw = reduced ? 0 : Math.sin(t * 0.32) * 0.13;

      if (!reduced && now > blinkAt) {
        const phase = (now - blinkAt) / 130;
        blink = phase < 1 ? Math.sin(phase * Math.PI) : 0;
        if (phase >= 1) blinkAt = now + 1800 + Math.random() * 3200;
      }
      const targetMouth = st === "speaking" ? Math.max(level * 1.6, 0.06 + Math.sin(t * 9) * 0.03) : 0;
      mouth += (targetMouth - mouth) * 0.35;

      const c = COLORS[st];
      const alertPulse = st === "alert" ? 0.6 + Math.sin(t * 6) * 0.4 : 1;

      // 3D → 2D: yaw around the vertical axis + slight perspective by depth
      const project = (p: P3, jitterI = 0, jitterAmp = 0.0035): Pt & { depth: number } => {
        const jx = reduced ? 0 : Math.sin(t * 1.7 + jitterI * 1.37) * jitterAmp;
        const jy = reduced ? 0 : Math.sin(t * 1.9 + jitterI * 2.11) * jitterAmp;
        const x = p.x * Math.cos(yaw) + p.z * Math.sin(yaw);
        const depth = -p.x * Math.sin(yaw) + p.z * Math.cos(yaw);
        const s = 1 + depth * 0.14;
        return { x: cx + (x * s + jx) * scale, y: cy + ((p.y - 0.08) * (1 + depth * 0.03) + jy) * scale, depth };
      };

      ctx.clearRect(0, 0, w, h);

      // Ambient glow behind the portrait
      const glow = ctx.createRadialGradient(cx, cy, scale * 0.1, cx, cy, scale * 1.3);
      glow.addColorStop(0, `rgba(${c.line}, ${0.07 * alertPulse})`);
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      const strokeLine = (
        pts: P3[],
        baseAlpha: number,
        width: number,
        dots: { every: number; alpha: number } | null = null,
        jitterAmp = 0.0035,
      ) => {
        let depthSum = 0;
        ctx.beginPath();
        pts.forEach((p, i) => {
          const q = project(p, i, jitterAmp);
          depthSum += q.depth;
          if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
        });
        // depth shading: nearer lines glow brighter — this sells the 3D
        const shade = Math.max(0.3, Math.min(1, 0.55 + (depthSum / pts.length) * 1.1));
        ctx.strokeStyle = `rgba(${c.line}, ${baseAlpha * shade * alertPulse})`;
        ctx.lineWidth = Math.max(1, scale * width);
        ctx.stroke();
        if (dots) {
          ctx.shadowColor = `rgba(${c.dot}, 0.9)`;
          ctx.shadowBlur = scale * 0.045;
          for (let i = 0; i < pts.length; i += dots.every) {
            const q = project(pts[i], i, jitterAmp);
            ctx.beginPath();
            ctx.arc(q.x, q.y, Math.max(1, scale * 0.008), 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${c.dot}, ${dots.alpha * alertPulse})`;
            ctx.fill();
          }
          ctx.shadowBlur = 0;
        }
      };

      // 1. Face mesh — the dense 3D wireframe skin
      for (const line of FACE_MESH) strokeLine(line, 0.2, 0.004, { every: 4, alpha: 0.35 });

      // 2. Hair
      for (const s2 of HAIR_R) strokeLine(s2, 0.4, 0.005, { every: 4, alpha: 0.5 });
      for (const s2 of HAIR_L) strokeLine(s2, 0.4, 0.005, { every: 4, alpha: 0.5 });

      // 3. Eyes — large, intense, right under the brim
      const squash = (pts: P3[]): P3[] => {
        const cyE = pts.reduce((s2, p) => s2 + p.y, 0) / pts.length;
        return pts.map(p => ({ ...p, y: cyE + (p.y - cyE) * (1 - blink * 0.92) }));
      };
      strokeLine(squash(sampleCurve3(EYE_R, 20)), 0.85, 0.007, { every: 3, alpha: 0.9 }, 0.002);
      strokeLine(squash(sampleCurve3(EYE_L, 20)), 0.85, 0.007, { every: 3, alpha: 0.9 }, 0.002);
      if (blink < 0.5) {
        for (const sx of [1, -1]) {
          const center = project({ x: 0.24 * sx, y: -0.11, z: 0.43 }, 7, 0.002);
          // iris ring + glowing pupil
          ctx.beginPath();
          ctx.arc(center.x, center.y, Math.max(2, scale * 0.042), 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(${c.line}, ${0.8 * (1 - blink) * alertPulse})`;
          ctx.lineWidth = Math.max(1, scale * 0.005);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(center.x, center.y, Math.max(1.5, scale * 0.014), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${c.dot}, ${0.95 * (1 - blink) * alertPulse})`;
          ctx.shadowColor = `rgba(${c.dot}, 1)`;
          ctx.shadowBlur = scale * 0.09;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }

      // 4. Nose + audio-reactive lips (visible in the collar's V gap)
      strokeLine(sampleCurve3(NOSE, 8), 0.4, 0.005, null, 0.002);
      const open = mouth * 0.11;
      strokeLine(sampleCurve3(LIP_TOP, 16).map(p => ({ ...p, y: p.y - open * 0.25 })), 0.8, 0.006, { every: 3, alpha: 0.85 }, 0.002);
      strokeLine(sampleCurve3(LIP_BOTTOM, 16).map(p => ({ ...p, y: p.y + open })), 0.8, 0.006, { every: 3, alpha: 0.85 }, 0.002);

      // 5. Fedora — bold, closest to the viewer after the collar
      for (const line of HAT) strokeLine(line, 0.65, 0.007, { every: 4, alpha: 0.8 });

      // 6. Coat collar — the strongest shape, in front of everything
      for (const s2 of COLLAR_R) strokeLine(s2, 0.8, 0.008, { every: 4, alpha: 0.9 });
      for (const s2 of COLLAR_L) strokeLine(s2, 0.8, 0.008, { every: 4, alpha: 0.9 });

      // Ambient particles drifting around the portrait
      for (const p of particles) {
        p.a += p.s * 16;
        const q = project({ x: Math.cos(p.a) * p.r * 0.9, y: Math.sin(p.a * 0.8) * p.r, z: 0.1 }, 0, 0);
        ctx.beginPath();
        ctx.arc(q.x, q.y, Math.max(0.8, scale * 0.0035), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${c.dot}, 0.16)`;
        ctx.fill();
      }

      // Listening: expanding sound rings
      if (st === "listening" && !reduced) {
        for (let k = 0; k < 3; k++) {
          const phase = ((t * 0.6 + k / 3) % 1);
          ctx.beginPath();
          ctx.arc(cx, cy, scale * (1.05 + phase * 0.32), 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(${c.line}, ${0.3 * (1 - phase)})`;
          ctx.lineWidth = Math.max(1, scale * 0.005);
          ctx.stroke();
        }
      }
      // Speaking: ripples from the mouth
      if (st === "speaking" && !reduced && mouth > 0.04) {
        const m = project({ x: 0, y: 0.38, z: 0.46 }, 0, 0);
        for (let k = 0; k < 2; k++) {
          const phase = ((t * 1.2 + k / 2) % 1);
          ctx.beginPath();
          ctx.arc(m.x, m.y, scale * (0.14 + phase * 0.42), Math.PI * 0.15, Math.PI * 0.85);
          ctx.strokeStyle = `rgba(${c.line}, ${0.4 * mouth * (1 - phase)})`;
          ctx.lineWidth = Math.max(1, scale * 0.005);
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
  }, [audioLevelRef]);

  return <canvas ref={canvasRef} className={className} aria-label="הפנים הדיגיטליות של כרמן" role="img" />;
}
