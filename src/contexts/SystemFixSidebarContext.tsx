import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

const STORAGE_KEY = "aios:system-fix-sidebar-open";

type SystemFixSidebarContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  openWithReturnPath: (path?: string | null) => void;
  consumeReturnPath: () => string | null;
};

const SystemFixSidebarContext = createContext<SystemFixSidebarContextValue | undefined>(undefined);

function readStoredOpen(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function SystemFixSidebarProvider({ children }: { children: ReactNode }) {
  const [open, setOpenState] = useState(readStoredOpen);
  const returnPathRef = useRef<string | null>(null);

  const setOpen = useCallback((next: boolean) => {
    setOpenState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(() => {
    setOpenState((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const openWithReturnPath = useCallback((path?: string | null) => {
    if (path) returnPathRef.current = path;
    setOpen(true);
  }, [setOpen]);

  const consumeReturnPath = useCallback(() => {
    const path = returnPathRef.current;
    returnPathRef.current = null;
    return path;
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, open ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [open]);

  const value = useMemo(
    () => ({ open, setOpen, toggle, openWithReturnPath, consumeReturnPath }),
    [open, setOpen, toggle, openWithReturnPath, consumeReturnPath],
  );

  return (
    <SystemFixSidebarContext.Provider value={value}>
      {children}
    </SystemFixSidebarContext.Provider>
  );
}

export function useSystemFixSidebar() {
  const ctx = useContext(SystemFixSidebarContext);
  if (!ctx) throw new Error("useSystemFixSidebar must be used within SystemFixSidebarProvider");
  return ctx;
}
