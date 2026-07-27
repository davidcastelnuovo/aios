import { createContext, useContext, useState, ReactNode } from "react";

interface ViewAsContextType {
  viewAsUserId: string | null;
  viewAsSalesPersonId: string | null;
  viewAsUserName: string | null;
  isViewingAs: boolean;
  setViewAs: (userId: string, salesPersonId: string | null, userName: string) => void;
  clearViewAs: () => void;
}

const ViewAsContext = createContext<ViewAsContextType | undefined>(undefined);

export function ViewAsProvider({ children }: { children: ReactNode }) {
  const [viewAsUserId, setViewAsUserId] = useState<string | null>(null);
  const [viewAsSalesPersonId, setViewAsSalesPersonId] = useState<string | null>(null);
  const [viewAsUserName, setViewAsUserName] = useState<string | null>(null);

  const isViewingAs = viewAsUserId !== null;

  const setViewAs = (userId: string, salesPersonId: string | null, userName: string) => {
    setViewAsUserId(userId);
    setViewAsSalesPersonId(salesPersonId);
    setViewAsUserName(userName);
  };

  const clearViewAs = () => {
    setViewAsUserId(null);
    setViewAsSalesPersonId(null);
    setViewAsUserName(null);
  };

  return (
    <ViewAsContext.Provider
      value={{
        viewAsUserId,
        viewAsSalesPersonId,
        viewAsUserName,
        isViewingAs,
        setViewAs,
        clearViewAs,
      }}
    >
      {children}
    </ViewAsContext.Provider>
  );
}

export function useViewAs() {
  const context = useContext(ViewAsContext);
  if (context === undefined) {
    // Some layout-level access hooks run immediately before AppLayout mounts
    // the provider. Treat those callers as the authenticated user.
    return {
      viewAsUserId: null,
      viewAsSalesPersonId: null,
      viewAsUserName: null,
      isViewingAs: false,
      setViewAs: () => {},
      clearViewAs: () => {},
    };
  }
  return context;
}
