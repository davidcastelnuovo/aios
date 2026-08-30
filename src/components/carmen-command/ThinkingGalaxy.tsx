interface ThinkingGalaxyProps {
  className?: string;
  size?: "sm" | "md";
  label?: string;
}

/** Spinning galaxy shown while a Command Center brain is thinking. */
export function ThinkingGalaxy({ className = "", size = "md", label = "חושבת" }: ThinkingGalaxyProps) {
  return (
    <span className={`cc-thinking ${size === "sm" ? "is-sm" : ""} ${className}`.trim()} role="status" aria-live="polite">
      <span className="cc-thinking-galaxy" aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  );
}
