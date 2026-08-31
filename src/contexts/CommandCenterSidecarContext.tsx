import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "aios:cc-sidecar-open";

type SidecarContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
};

const CommandCenterSidecarContext = createContext<SidecarContextValue | null>(null);

function readStoredOpen(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function CommandCenterSidecarProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpenState] = useState(readStoredOpen);

  const setOpen = useCallback((next: boolean) => {
    setOpenState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(() => setOpen(!open), [open, setOpen]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, open ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [open]);

  const value = useMemo(() => ({ open, setOpen, toggle }), [open, setOpen, toggle]);

  return (
    <CommandCenterSidecarContext.Provider value={value}>
      {children}
    </CommandCenterSidecarContext.Provider>
  );
}

export function useCommandCenterSidecar(): SidecarContextValue {
  const ctx = useContext(CommandCenterSidecarContext);
  if (!ctx) {
    throw new Error("useCommandCenterSidecar must be used within CommandCenterSidecarProvider");
  }
  return ctx;
}

/** Safe hook for optional sidecar context (returns no-op when provider missing). */
export function useCommandCenterSidecarOptional(): SidecarContextValue {
  const ctx = useContext(CommandCenterSidecarContext);
  return (
    ctx ?? {
      open: false,
      setOpen: () => {},
      toggle: () => {},
    }
  );
}
