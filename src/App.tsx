import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { useSessionRefresh } from "@/hooks/useSessionRefresh";
import { AgencyProvider } from "./contexts/AgencyContext";
import { CommandCenterSidecarProvider } from "./contexts/CommandCenterSidecarContext";
import { TenantProvider } from "./contexts/TenantContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { UIModeProvider } from "./contexts/UIModeContext";
import { AIOSProvider } from "./contexts/AIOSContext";
import { Suspense } from "react";
import { lazyWithRetry as lazy } from "@/lib/lazyWithRetry";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Skeleton } from "@/components/ui/skeleton";
import { tenantRoutes } from "@/routes/tenantRoutes";
import { StagingBanner } from "@/components/StagingBanner";
import { setupReportQueryCachePersistence } from "@/lib/reportQueryCache";
import { REPORT_QUERY_GC_MS, REPORT_QUERY_STALE_MS } from "@/lib/reportQueryOptions";

const Landing = lazy(() => import("./pages/Landing"));
const Auth = lazy(() => import("./pages/Auth"));
const SignUp = lazy(() => import("./pages/SignUp"));
const Setup = lazy(() => import("./pages/Setup"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ChatInvite = lazy(() => import("./pages/ChatInvite"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const SharedDashboard = lazy(() => import("./pages/SharedDashboard"));
const SharedTable = lazy(() => import("./pages/SharedTable"));
const SharedSeoMonthly = lazy(() => import("./pages/SharedSeoMonthly"));
const UnifiedCallback = lazy(() => import("./pages/UnifiedCallback"));
const SignDocument = lazy(() => import("./pages/SignDocument"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: REPORT_QUERY_STALE_MS,
      gcTime: REPORT_QUERY_GC_MS,
      refetchOnWindowFocus: false,
      refetchOnMount: (query) => query.state.status === "error",
      retry: 1,
    },
  },
});

setupReportQueryCachePersistence(queryClient);

function PageLoader() {
  return (
    <div className="flex flex-col gap-4 p-8">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-96" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mt-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    </div>
  );
}

function SessionRefreshInitializer() {
  useSessionRefresh();
  return null;
}

function RoutedErrorBoundary({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  return <ErrorBoundary resetKey={location.pathname}>{children}</ErrorBoundary>;
}

function TenantAppProviders({ children }: { children: React.ReactNode }) {
  return (
    <TenantProvider>
      <ThemeProvider>
        <UIModeProvider>
          <AIOSProvider>
            <AgencyProvider>
              <CommandCenterSidecarProvider>{children}</CommandCenterSidecarProvider>
            </AgencyProvider>
          </AIOSProvider>
        </UIModeProvider>
      </ThemeProvider>
    </TenantProvider>
  );
}

/** Tenant routes need the full provider stack; public routes stay lightweight. */
function RouteScopedProviders({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const isTenantRoute = pathname.startsWith("/t/");

  if (isTenantRoute) {
    return (
      <TenantAppProviders>
        <StagingBanner />
        {children}
      </TenantAppProviders>
    );
  }

  return (
    <>
      <StagingBanner />
      {children}
    </>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <SessionRefreshInitializer />
    <BrowserRouter>
      <RoutedErrorBoundary>
        <TooltipProvider delayDuration={0} skipDelayDuration={0}>
          <Toaster />
          <Sonner />
          <RouteScopedProviders>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/signup" element={<SignUp />} />
                <Route path="/setup" element={<Setup />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/chat-invite/:token" element={<ChatInvite />} />
                <Route
                  path="/shared/dashboard/:shareToken"
                  element={<SharedDashboard />}
                />
                <Route path="/shared/table/:shareToken" element={<SharedTable />} />
                <Route
                  path="/shared/seo-monthly/:shareToken"
                  element={<SharedSeoMonthly />}
                />
                <Route path="/terms" element={<Terms />} />

                {tenantRoutes()}

                <Route
                  path="/unified-callback"
                  element={
                    <Suspense fallback={<div />}>
                      <UnifiedCallback />
                    </Suspense>
                  }
                />
                <Route path="/sign/:token" element={<SignDocument />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </RouteScopedProviders>
        </TooltipProvider>
      </RoutedErrorBoundary>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
