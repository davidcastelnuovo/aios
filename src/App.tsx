import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useSessionRefresh } from "@/hooks/useSessionRefresh";
import { AgencyProvider } from "./contexts/AgencyContext";
import { TenantProvider } from "./contexts/TenantContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { UIModeProvider } from "./contexts/UIModeContext";
import { AIOSProvider } from "./contexts/AIOSContext";
import { Suspense, lazy } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { tenantRoutes } from "@/routes/tenantRoutes";

import Auth from "./pages/Auth";
import SignUp from "./pages/SignUp";
import Setup from "./pages/Setup";
import Landing from "./pages/Landing";
import NotFound from "./pages/NotFound";

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
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 10,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      retry: 1,
    },
  },
});

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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <SessionRefreshInitializer />
    <BrowserRouter>
      <TooltipProvider delayDuration={0} skipDelayDuration={0}>
        <Toaster />
        <Sonner />
        <TenantProvider>
          <ThemeProvider>
            <UIModeProvider>
            <AIOSProvider>
            <AgencyProvider>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/" element={<Landing />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/signup" element={<SignUp />} />
                  <Route path="/setup" element={<Setup />} />
                  <Route path="/privacy" element={<Privacy />} />
                  <Route path="/chat-invite/:token" element={<ChatInvite />} />
                  <Route path="/shared/dashboard/:shareToken" element={<SharedDashboard />} />
                  <Route path="/shared/table/:shareToken" element={<SharedTable />} />
                  <Route path="/shared/seo-monthly/:shareToken" element={<SharedSeoMonthly />} />
                  <Route path="/terms" element={<Terms />} />

                  {tenantRoutes()}

                  <Route path="/unified-callback" element={<Suspense fallback={<div />}><UnifiedCallback /></Suspense>} />
                  <Route path="/sign/:token" element={<SignDocument />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </AgencyProvider>
            </AIOSProvider>
            </UIModeProvider>
          </ThemeProvider>
        </TenantProvider>
      </TooltipProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
