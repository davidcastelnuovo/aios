import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  carmenSceneJustEnded,
  registerCarmenScene,
  registerCarmenWait,
} from "@/lib/carmenLoaderSignal";

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

/** Feathered ellipse over the keyboard, where the two typing poses differ. */
const HANDS_MASK =
  "radial-gradient(ellipse 26% 19% at 57% 79%, #000 40%, rgba(0,0,0,0.6) 70%, transparent 100%)";

/** Same idea for the wink: borrow only the eyes from the glance frame. */
const EYES_MASK =
  "radial-gradient(ellipse 12% 8% at 49% 30%, #000 45%, rgba(0,0,0,0.5) 75%, transparent 100%)";

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

/** Kept across mounts so a hand-off continues the sequence instead of restarting. */
let lastMessageIndex = 0;

function useRotatingMessage(messages: string[], intervalMs: number, resume: boolean) {
  const [index, setIndex] = useState(() => (resume ? lastMessageIndex : 0));

  useEffect(() => {
    if (messages.length < 2 || prefersReducedMotion()) return;
    const timer = window.setInterval(
      () =>
        setIndex((current) => {
          lastMessageIndex = (current + 1) % messages.length;
          return lastMessageIndex;
        }),
      intervalMs,
    );
    return () => window.clearInterval(timer);
  }, [messages, intervalMs]);

  return messages[index % messages.length];
}

/**
 * Hold the scene back so short waits only ever show the thin route bar, then
 * fade it in. A scene that follows straight after another one (route chunk →
 * page query) skips the wait, so the two read as a single loading moment.
 */
function useSceneVisible(delayMs: number) {
  const [continued] = useState(carmenSceneJustEnded);
  const [visible, setVisible] = useState(() => continued || delayMs <= 0);

  useEffect(() => {
    if (visible) return;
    const timer = window.setTimeout(() => setVisible(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [visible, delayMs]);

  useEffect(() => (visible ? registerCarmenScene() : registerCarmenWait()), [visible]);

  return { visible, continued };
}

/**
 * React removes the scene the instant its data lands, which reads as a cut.
 * On unmount we hand a positioned copy to the body and fade that out, so the
 * scene dissolves while the freshly loaded content fades in underneath.
 */
function useFadeOutOnUnmount<T extends HTMLElement>(active: boolean) {
  const ref = useRef<T>(null);

  useLayoutEffect(() => {
    if (!active) return;
    const element = ref.current;
    return () => {
      if (!element?.isConnected || prefersReducedMotion()) return;

      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const ghost = element.cloneNode(true) as HTMLElement;
      Object.assign(ghost.style, {
        position: "fixed",
        left: `${rect.left}px`,
        right: "auto",
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        margin: "0",
        pointerEvents: "none",
        zIndex: "45",
      });
      document.body.appendChild(ghost);

      const remove = () => ghost.remove();
      ghost
        .animate([{ opacity: 1 }, { opacity: 0, transform: "scale(0.985)" }], {
          duration: 260,
          easing: "ease-in",
        })
        .addEventListener("finish", remove);
      window.setTimeout(remove, 800);
    };
  }, [active]);

  return ref;
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
        {/* Second pose, masked to the hands: swapping the full render makes the
            whole picture twitch, because the two frames differ everywhere. */}
        <img
          src={FRAME_KEYS_DOWN}
          alt=""
          aria-hidden
          decoding="async"
          style={{ maskImage: HANDS_MASK, WebkitMaskImage: HANDS_MASK }}
          className="absolute inset-0 h-full w-full animate-carmen-keystroke object-cover motion-reduce:animate-none motion-reduce:opacity-100"
        />
        <img
          src={FRAME_GLANCE}
          alt=""
          aria-hidden
          decoding="async"
          style={{ maskImage: EYES_MASK, WebkitMaskImage: EYES_MASK }}
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
              style={{ left: `${52 + i * 6}%`, animationDelay: `${i * 0.8}s` }}
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
  /** Wait this long before showing the scene; the thin route bar covers this gap. */
  delayMs?: number;
  className?: string;
}

export function CarmenLoadingScreen({
  variant = "page",
  title = "כרמן מכינה לך את המסך",
  messages = DEFAULT_MESSAGES,
  delayMs = 450,
  className,
}: CarmenLoadingScreenProps) {
  const { visible, continued } = useSceneVisible(delayMs);
  const message = useRotatingMessage(messages, 3400, continued);
  const fadeOutRef = useFadeOutOnUnmount<HTMLDivElement>(visible);

  if (!visible) return null;

  // A continued scene is already on screen from the previous step — no re-entry.
  const enter = continued
    ? ""
    : "animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-700";

  if (variant === "inline") {
    return (
      <div
        ref={fadeOutRef}
        dir="rtl"
        role="status"
        aria-live="polite"
        aria-busy
        className={cn("flex items-center gap-3", enter, className)}
      >
        <CarmenWorkingScene size="sm" />
        <div className="flex flex-col gap-1">
          <span
            key={message}
            className="animate-in text-sm font-medium text-foreground fade-in duration-700"
          >
            {message}
          </span>
          <TypingDots />
        </div>
      </div>
    );
  }

  return (
    <div
      ref={fadeOutRef}
      dir="rtl"
      role="status"
      aria-live="polite"
      aria-busy
      className={cn(
        "flex w-full flex-col items-center justify-center gap-5",
        variant === "page" ? "min-h-[60vh] p-8" : "py-10",
        enter,
        className,
      )}
    >
      <CarmenWorkingScene size={variant === "page" ? "lg" : "md"} />

      <div className="flex flex-col items-center gap-2 text-center">
        <p className="text-base font-semibold text-foreground">{title}</p>
        <div className="flex items-center gap-2">
          <p key={message} className="animate-in text-sm text-muted-foreground fade-in duration-700">
            {message}
          </p>
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
