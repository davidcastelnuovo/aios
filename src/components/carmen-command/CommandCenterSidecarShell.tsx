import { useIsMobile } from "@/hooks/use-mobile";
import { useCommandCenterSidecar } from "@/contexts/CommandCenterSidecarContext";
import { CommandCenterSidecar } from "./CommandCenterSidecar";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Sheet, SheetContent } from "@/components/ui/sheet";

interface CommandCenterSidecarShellProps {
  children: React.ReactNode;
  /** When true, sidecar is embedded in a parent that already manages open state (e.g. Command Center page). */
  embedded?: boolean;
  /** Override open state when embedded. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * Wraps main content + optional Carmen sidecar. Desktop: resizable push layout.
 * Mobile: drawer overlay.
 */
export function CommandCenterSidecarShell({
  children,
  embedded = false,
  open: openProp,
  onOpenChange,
}: CommandCenterSidecarShellProps) {
  const ctx = useCommandCenterSidecar();
  const isMobile = useIsMobile();
  const open = embedded ? (openProp ?? false) : ctx.open;
  const setOpen = embedded ? (onOpenChange ?? (() => {})) : ctx.setOpen;

  if (isMobile) {
    return (
      <>
        {children}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side="left"
            dir="rtl"
            className="cc-sidecar-sheet w-full border-[var(--cc-line)] bg-[var(--cc-bg)] p-0 sm:max-w-md"
          >
            <CommandCenterSidecar onClose={() => setOpen(false)} className="h-full" />
          </SheetContent>
        </Sheet>
      </>
    );
  }

  if (!open) {
    return <>{children}</>;
  }

  return (
    <ResizablePanelGroup
      direction="horizontal"
      dir="rtl"
      className="min-h-0 flex-1"
      autoSaveId="aios-cc-sidecar"
    >
      <ResizablePanel defaultSize={32} minSize={22} maxSize={45} className="min-h-0">
        <CommandCenterSidecar onClose={() => setOpen(false)} className="h-full border-l border-[var(--cc-line)]" />
      </ResizablePanel>
      <ResizableHandle withHandle className="bg-[var(--cc-line)]" />
      <ResizablePanel defaultSize={68} minSize={40} className="min-h-0">
        {children}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
