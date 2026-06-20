import { cn } from "@/lib/utils";
import { forwardRef } from "react";

interface Props extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  children?: React.ReactNode;
}

export const GlassPanel = forwardRef<HTMLDivElement, Props>(({ className, children, ...rest }, ref) => (
  <div
    ref={ref}
    {...rest}
    className={cn(
      "relative rounded-3xl border border-white/60 bg-white/55 backdrop-blur-xl",
      "shadow-[0_8px_32px_-8px_rgba(15,23,42,0.12),0_2px_8px_-2px_rgba(15,23,42,0.06)]",
      "ring-1 ring-black/[0.03]",
      className
    )}
  >
    {children}
  </div>
));
GlassPanel.displayName = "GlassPanel";
