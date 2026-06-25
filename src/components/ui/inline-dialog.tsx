import { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface InlineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When true, render embedded in the page flow instead of as a modal overlay. */
  inline?: boolean;
  title?: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  /** className applied to the DialogContent (modal) or the inline card. */
  className?: string;
}

/**
 * Renders its content either as a modal dialog (default) or, when `inline` is
 * true, embedded directly in the page flow as a card — no overlay, no portal.
 * Lets the same form be used as a popup elsewhere and inline inside chat views.
 */
export function InlineDialog({
  open,
  onOpenChange,
  inline = false,
  title,
  description,
  footer,
  children,
  className,
}: InlineDialogProps) {
  if (inline) {
    if (!open) return null;
    return (
      <div
        dir="rtl"
        className={cn(
          "rounded-lg border bg-card shadow-sm p-4 flex flex-col gap-3 animate-in fade-in-0 slide-in-from-top-1",
          className
        )}
      >
        {(title || description) && (
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              {title && (
                <h3 className="font-semibold leading-none tracking-tight">{title}</h3>
              )}
              {description && (
                <p className="text-sm text-muted-foreground">{description}</p>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 -mt-1 -ml-1"
              onClick={() => onOpenChange(false)}
              aria-label="סגור"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
        <div>{children}</div>
        {footer && <div className="flex justify-end gap-2">{footer}</div>}
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className={className}>
        {(title || description) && (
          <DialogHeader>
            {title && <DialogTitle>{title}</DialogTitle>}
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
        )}
        {children}
        {footer && <DialogFooter className="gap-2 sm:gap-2">{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}
