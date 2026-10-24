import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useCommandCenterSidecar } from "@/contexts/CommandCenterSidecarContext";
import { CommandCenterSidecar } from "./CommandCenterSidecar";
import { useCommandCenterAccess } from "./access";
import "./carmen-session.css";

const ignoreOpenChange = () => {};

interface CommandCenterSidecarShellProps {
  children: React.ReactNode;
  embedded?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/** Keep the workspace mounted and interactive throughout a Carmen session. */
export function CommandCenterSidecarShell({
  children,
  embedded = false,
  open: openProp,
  onOpenChange,
}: CommandCenterSidecarShellProps) {
  const ctx = useCommandCenterSidecar();
  const access = useCommandCenterAccess();
  const onWorkshop = useLocation().pathname.includes("/workshop");
  const open = (embedded ? (openProp ?? false) : ctx.open) && access.allowed;
  const setOpen = embedded ? (onOpenChange ?? ignoreOpenChange) : ctx.setOpen;

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  // In RTL the first flex child sits on the right, so the session column
  // docks on the right edge and the page content shrinks beside it.
  return (
    <div className={`carmen-session-layout${onWorkshop ? " is-workshop" : ""}`}>
      {open && (
        <aside
          className="carmen-session"
          aria-label="פגישת עבודה עם כרמן"
          dir="rtl"
        >
          <CommandCenterSidecar
            onClose={() => setOpen(false)}
            session
            keepSkin={onWorkshop}
          />
        </aside>
      )}
      <div className="carmen-session-content">{children}</div>
    </div>
  );
}
