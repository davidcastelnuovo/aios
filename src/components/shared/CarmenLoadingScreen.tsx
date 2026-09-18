import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Carmen "working" loading screen — shown while a route chunk or its data is
 * still resolving, so pages never flash an empty state before data lands.
 *
 * The typing motion is a two-pose cut (A/B) plus an occasional glance frame,
 * the same trick limited animation uses: no video, three cached webp frames.
 */

const FRAME_KEYS_DOWN = "/carmen/carmen-working-a.webp";
const FRAME_KEYS_UP = "/carmen/carmen-working-b.webp";
const FRAME_GLANCE = "/carmen/carmen-working-c.webp";

const ALL_FRAMES = [FRAME_KEYS_UP, FRAME_KEYS_DOWN, FRAME_GLANCE];

const DEFAULT_MESSAGES = [
  "כרמן אוספת את הנתונים…",
  "מסדרת את הטבלאות…",
  "בודקת הרשאות…",
  "עוד רגע הכול על המסך…",
];

let framesPrefetched = false;

/** Warm the browser cache so the loader itself never arrives late. */
function prefetchCarmenFrames() {
  if (framesPrefetched || typeof window === "undefined") return;
  framesPrefetched = true;
  for (const src of ALL_FRAMES) {
    const img = new Image();
    img.src = src;
  }
}

function prefersReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function useRotatingMessage(messages: string[], intervalMs: number) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (messages.length < 2 || prefersReducedMotion()) return;
    const timer = window.setInterval(
      () => setIndex((current) => (current + 1) % messages.length),
      intervalMs,
    );
    return () => window.clearInterval(timer);
  }, [messages, intervalMs]);

  return messages[Math.min(index, messages.length - 1)];
}

/** Hold back the loader briefly so fast navigations don't flicker a screen. */
function useVisibleAfter(delayMs: number) {
  const [visible, setVisible] = useState(delayMs <= 0);

  useEffect(() => {
    if (delayMs <= 0) return;
    const timer = window.setTimeout(() => setVisible(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs]);

  return visible;
}

type CarmenSceneSize = "sm" | "md" | "lg";

const SCENE_WIDTH: Record<CarmenSceneSize, string> = {
  sm: "w-[164px]",
  md: "w-[300px]",
  lg: "w-[420px]",
};

/** The animated scene on its own — Carmen typing, without any copy around it. */
export function CarmenWorkingScene({
  size = "md",
  className,
}: {
  size?: CarmenSceneSize;
  className?: string;
}) {
  useEffect(prefetchCarmenFrames, []);

  return (
    <div
      className={cn(
        "relative animate-carmen-breathe motion-reduce:animate-none",
        SCENE_WIDTH[size],
        className,
      )}
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-primary/15 bg-[#0b1020] shadow-[0_18px_45px_-20px_rgba(15,23,42,0.75)]">
        <img
          src={FRAME_KEYS_UP}
          alt=""
          aria-hidden
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <img
          src={FRAME_KEYS_DOWN}
          alt=""
          aria-hidden
          decoding="async"
          className="absolute inset-0 h-full w-full animate-carmen-keystroke object-cover motion-reduce:animate-none motion-reduce:opacity-100"
        />
        <img
          src={FRAME_GLANCE}
          alt=""
          aria-hidden
          decoding="async"
          className="absolute inset-0 h-full w-full animate-carmen-glance object-cover opacity-0 motion-reduce:hidden"
        />

        {/* Keyboard light spill, tied to the keystroke rhythm. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-[38%] bottom-[8%] h-[22%] animate-carmen-screen-flicker rounded-full bg-sky-400/40 blur-2xl motion-reduce:animate-none"
        />

        {/* Data bits lifting off the keyboard toward the holo panels. */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className="absolute bottom-[22%] h-1.5 w-1.5 rounded-[2px] bg-cyan-300/90 animate-carmen-data-rise motion-reduce:hidden"
              style={{ left: `${52 + i * 6}%`, animationDelay: `${i * 0.45}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export interface CarmenLoadingScreenProps {
  /** `page` fills the route area, `card` sits inside a panel, `inline` is a single row. */
  variant?: "page" | "card" | "inline";
  title?: string;
  /** Rotating status lines; pass one item to keep it static. */
  messages?: string[];
  /** Wait this long before showing anything, so quick loads stay silent. */
  delayMs?: number;
  className?: string;
}

export function CarmenLoadingScreen({
  variant = "page",
  title = "כרמן מכינה לך את המסך",
  messages = DEFAULT_MESSAGES,
  delayMs = 120,
  className,
}: CarmenLoadingScreenProps) {
  const visible = useVisibleAfter(delayMs);
  const message = useRotatingMessage(messages, 2200);

  if (!visible) return null;

  if (variant === "inline") {
    return (
      <div
        dir="rtl"
        role="status"
        aria-live="polite"
        aria-busy
        className={cn(
          "flex animate-in items-center gap-3 fade-in duration-300",
          className,
        )}
      >
        <CarmenWorkingScene size="sm" />
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-foreground">{message}</span>
          <TypingDots />
        </div>
      </div>
    );
  }

  return (
    <div
      dir="rtl"
      role="status"
      aria-live="polite"
      aria-busy
      className={cn(
        "flex w-full animate-in flex-col items-center justify-center gap-5 fade-in duration-300",
        variant === "page" ? "min-h-[60vh] p-8" : "py-10",
        className,
      )}
    >
      <CarmenWorkingScene size={variant === "page" ? "lg" : "md"} />

      <div className="flex flex-col items-center gap-2 text-center">
        <p className="text-base font-semibold text-foreground">{title}</p>
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground">{message}</p>
          <TypingDots />
        </div>
      </div>

      <div className="h-1 w-48 overflow-hidden rounded-full bg-muted">
        <div className="h-full w-1/3 animate-carmen-track rounded-full bg-primary/70 motion-reduce:w-full motion-reduce:animate-none" />
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <span aria-hidden className="flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 animate-carmen-typing-dot rounded-full bg-primary motion-reduce:animate-none"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </span>
  );
}

export default CarmenLoadingScreen;
