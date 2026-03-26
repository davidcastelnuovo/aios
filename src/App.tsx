import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useSessionRefresh } from "@/hooks/useSessionRefresh";
import { AppLayout } from "./components/layout/AppLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AgencyProvider } from "./contexts/AgencyContext";
import { TenantProvider } from "./contexts/TenantContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { UIModeProvider } from "./contexts/UIModeContext";
import { AIOSProvider } from "./contexts/AIOSContext";
import { Suspense, lazy } from "react";
import { Skeleton } from "@/components/ui/skeleton";

// Eagerly loaded pages (frequently accessed)
import DashboardRouter from "./pages/DashboardRouter";
import Auth from "./pages/Auth";
import SignUp from "./pages/SignUp";
import Setup from "./pages/Setup";
import Landing from "./pages/Landing";
import NotFound from "./pages/NotFound";
const AIOSDashboard = lazy(() => import("./pages/AIOSDashboard"));

// Lazily loaded pages
const Branding = lazy(() => import("./pages/Branding"));
const Agencies = lazy(() => import("./pages/Agencies"));
const Clients = lazy(() => import("./pages/Clients"));
const Campaigners = lazy(() => import("./pages/Campaigners"));
const Suppliers = lazy(() => import("./pages/Suppliers"));
const Finance = lazy(() => import("./pages/Finance"));
const Tasks = lazy(() => import("./pages/Tasks"));
const ClientOnboarding = lazy(() => import("./pages/ClientOnboarding"));
const TimeTracking = lazy(() => import("./pages/TimeTracking"));
const Reports = lazy(() => import("./pages/Reports"));
const MyProfile = lazy(() => import("./pages/MyProfile"));
const Users = lazy(() => import("./pages/Users"));
const SalesPeople = lazy(() => import("./pages/SalesPeople"));
const Leads = lazy(() => import("./pages/Leads"));
const SalesDashboard = lazy(() => import("./pages/SalesDashboard"));
const LeadIntegrations = lazy(() => import("./pages/LeadIntegrations"));
const Tenants = lazy(() => import("./pages/Tenants"));
const Automations = lazy(() => import("./pages/Automations"));
const Products = lazy(() => import("./pages/Products"));
const AccountingIntegrations = lazy(() => import("./pages/AccountingIntegrations"));
const AccountingSettings = lazy(() => import("./pages/AccountingSettings"));
const AISupport = lazy(() => import("./pages/AISupport"));
const MenuManagement = lazy(() => import("./pages/MenuManagement"));
const FieldsManagement = lazy(() => import("./pages/FieldsManagement"));
const DynamicTables = lazy(() => import("./pages/DynamicTables"));
const DynamicTableView = lazy(() => import("./pages/DynamicTableView"));
const DashboardView = lazy(() => import("./pages/DashboardView"));
const Chat = lazy(() => import("./pages/Chat"));
const ManyChatSettings = lazy(() => import("./pages/ManyChatSettings"));
const ChatIntegrations = lazy(() => import("./pages/ChatIntegrations"));
const GreenAPISettings = lazy(() => import("./pages/GreenAPISettings"));
const FacebookSettings = lazy(() => import("./pages/FacebookSettings"));
const FacebookCallback = lazy(() => import("./pages/FacebookCallback"));
const GoogleAdsSettings = lazy(() => import("./pages/GoogleAdsSettings"));
const GoogleAnalyticsSettings = lazy(() => import("./pages/GoogleAnalyticsSettings"));
const MakeSettings = lazy(() => import("./pages/MakeSettings"));
const GoogleSearchConsoleSettings = lazy(() => import("./pages/GoogleSearchConsoleSettings"));
const AhrefsSettings = lazy(() => import("./pages/AhrefsSettings"));
const Integrations = lazy(() => import("./pages/Integrations"));
const SiteAnalytics = lazy(() => import("./pages/SiteAnalytics"));
const RankTracking = lazy(() => import("./pages/RankTracking"));
const RankTrackingProject = lazy(() => import("./pages/RankTrackingProject"));
const SerpApiSettings = lazy(() => import("./pages/SerpApiSettings"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const ZoomSettings = lazy(() => import("./pages/ZoomSettings"));
const Recordings = lazy(() => import("./pages/Recordings"));
const AutomationFlow = lazy(() => import("./pages/AutomationFlow"));
const TeamChat = lazy(() => import("./pages/TeamChat"));
const ChatInvite = lazy(() => import("./pages/ChatInvite"));
const GmailSettings = lazy(() => import("./pages/GmailSettings"));
const Gmail = lazy(() => import("./pages/Gmail"));
const Signatures = lazy(() => import("./pages/Signatures"));
const SignDocument = lazy(() => import("./pages/SignDocument"));
const ManusSettings = lazy(() => import("./pages/ManusSettings"));
const ManusTasksPage = lazy(() => import("./pages/ManusTasksPage"));
const AgentHub = lazy(() => import("./pages/AgentHub"));
const SharedDashboard = lazy(() => import("./pages/SharedDashboard"));
const AiDetection = lazy(() => import("./pages/AiDetection"));
const TelephonySettings = lazy(() => import("./pages/TelephonySettings"));

// QueryClient with optimized defaults for better caching
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes - data considered fresh
      gcTime: 1000 * 60 * 10, // 10 minutes - cache garbage collection
      refetchOnWindowFocus: false, // Don't refetch when tab regains focus
      refetchOnMount: false, // Don't refetch when component mounts if data is fresh
      retry: 1, // Only retry failed requests once
    },
  },
});

// Loading fallback for lazy-loaded pages
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

// Component to initialize session refresh
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
                  {/* Public routes */}
                  <Route path="/" element={<Landing />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/signup" element={<SignUp />} />
                  <Route path="/setup" element={<Setup />} />
                   <Route path="/privacy" element={<Privacy />} />
                   <Route path="/chat-invite/:token" element={<ChatInvite />} />
                   <Route path="/shared/dashboard/:shareToken" element={<SharedDashboard />} />
                  <Route path="/terms" element={<Terms />} />
                  
                  {/* Tenant-scoped routes */}
                  <Route path="/t/:tenantSlug" element={<ProtectedRoute requiredPermission="dashboard" redirectTo="/my-profile"><AppLayout><DashboardRouter /></AppLayout></ProtectedRoute>} />
                  <Route path="/t/:tenantSlug/dashboard" element={<ProtectedRoute requiredPermission="dashboard" redirectTo="/my-profile"><AppLayout><DashboardRouter /></AppLayout></ProtectedRoute>} />
                  <Route path="/t/:tenantSlug/agencies" element={<ProtectedRoute requiredPermission="agencies"><AppLayout><Agencies /></AppLayout></ProtectedRoute>} />
                  <Route path="/t/:tenantSlug/clients" element={<ProtectedRoute requiredPermission="clients"><AppLayout><Clients /></AppLayout></ProtectedRoute>} />
                  <Route path="/t/:tenantSlug/campaigners" element={<ProtectedRoute requiredPermission="campaigners"><AppLayout><Campaigners /></AppLayout></ProtectedRoute>} />
                  <Route path="/t/:tenantSlug/suppliers" element={<ProtectedRoute requiredPermission="suppliers"><AppLayout><Suppliers /></AppLayout></ProtectedRoute>} />
                  <Route path="/t/:tenantSlug/finance" element={<ProtectedRoute requiredPermission="finance"><AppLayout><Finance /></AppLayout></ProtectedRoute>} />
                  <Route path="/t/:tenantSlug/tasks" element={<ProtectedRoute requiredPermission="tasks"><AppLayout><Tasks /></AppLayout></ProtectedRoute>} />
                  <Route path="/t/:tenantSlug/client-onboarding" element={<ProtectedRoute requiredPermission="client_onboarding"><AppLayout><ClientOnboarding /></AppLayout></ProtectedRoute>} />
                  <Route path="/t/:tenantSlug/time-tracking" element={<ProtectedRoute requiredPermission="time_tracking"><AppLayout><TimeTracking /></AppLayout></ProtectedRoute>} />
                  <Route path="/t/:tenantSlug/reports" element={<ProtectedRoute requiredPermission="reports"><AppLayout><Reports /></AppLayout></ProtectedRoute>} />
                  <Route path="/t/:tenantSlug/my-profile" element={<ProtectedRoute><AppLayout><MyProfile /></AppLayout></ProtectedRoute>} />
                  <Route path="/t/:tenantSlug/users" element={<ProtectedRoute requiredPermission="users"><AppLayout><Users /></AppLayout></ProtectedRoute>} />
                  <Route path="/t/:tenantSlug/sales-dashboard" element={<ProtectedRoute requiredPermission="sales_dashboard"><AppLayout><SalesDashboard /></AppLayout></ProtectedRoute>} />
                  <Route path="/t/:tenantSlug/sales-people" element={<ProtectedRoute requiredPermission="sales_people"><AppLayout><SalesPeople /></AppLayout></ProtectedRoute>} />
                  <Route path="/t/:tenantSlug/leads" element={<ProtectedRoute requiredPermission="leads"><AppLayout><Leads /></AppLayout></ProtectedRoute>} />
                  <Route path="/t/:tenantSlug/lead-integrations" element={<ProtectedRoute requiredPermission="lead_integrations"><AppLayout><LeadIntegrations /></AppLayout></ProtectedRoute>} />
                  <Route path="/t/:tenantSlug/tenants" element={<ProtectedRoute requiredPermission="tenants"><AppLayout><Tenants /></AppLayout></ProtectedRoute>} />
                  <Route path="/t/:tenantSlug/automations" element={<ProtectedRoute requiredPermission="automations"><AppLayout><Automations /></AppLayout></ProtectedRoute>} />
                  <Route path="/t/:tenantSlug/automations/flow/:automationId" element={<ProtectedRoute requiredPermission="automations"><AutomationFlow /></ProtectedRoute>} />
                  <Route path="/t/:tenantSlug/products" element={<ProtectedRoute requiredPermission="leads"><AppLayout><Products /></AppLayout></ProtectedRoute>} />
                  <Route path="/t/:tenantSlug/branding" element={<ProtectedRoute requiredPermission="branding"><AppLayout><Branding /></AppLayout></ProtectedRoute>} />
                  <Route path="/t/:tenantSlug/accounting-integrations" element={<ProtectedRoute requiredPermission="accounting"><AppLayout><AccountingIntegrations /></AppLayout></ProtectedRoute>} />
                  <Route path="/t/:tenantSlug/accounting-settings" element={<ProtectedRoute requiredPermission="accounting"><AppLayout><AccountingSettings /></AppLayout></ProtectedRoute>} />
                  {/* AIOS is now accessed via header button, keeping route for backward compat */}
                  <Route path="/t/:tenantSlug/ai-support" element={<ProtectedRoute><AppLayout><DashboardRouter /></AppLayout></ProtectedRoute>} />
                  <Route path="/t/:tenantSlug/menu-management" element={<ProtectedRoute requiredPermission="menu_management"><AppLayout><MenuManagement /></AppLayout></ProtectedRoute>} />
                  <Route path="/t/:tenantSlug/fields-management" element={<ProtectedRoute requiredPermission="fields_management"><AppLayout><FieldsManagement /></AppLayout></ProtectedRoute>} />
                  <Route path="/t/:tenantSlug/dynamic-tables" element={<ProtectedRoute requiredPermission="branding"><AppLayout><DynamicTables /></AppLayout></ProtectedRoute>} />
                  <Route path="/t/:tenantSlug/table/:tableSlug" element={<ProtectedRoute><AppLayout><DynamicTableView /></AppLayout></ProtectedRoute>} />
                  <Route path="/t/:tenantSlug/dashboard/:dashboardId" element={<ProtectedRoute><AppLayout><DashboardView /></AppLayout></ProtectedRoute>} />
                  <Route path="/t/:tenantSlug/chat" element={<ProtectedRoute requiredPermission="chat"><AppLayout><Chat /></AppLayout></ProtectedRoute>} />
                  <Route path="/t/:tenantSlug/chat/:clientId" element={<ProtectedRoute requiredPermission="chat"><AppLayout><Chat /></AppLayout></ProtectedRoute>} />
                  <Route path="/t/:tenantSlug/chat-integrations" element={<ProtectedRoute requiredPermission="chat_integrations"><AppLayout><ChatIntegrations /></AppLayout></ProtectedRoute>} />
                  <Route path="/t/:tenantSlug/manychat-settings" element={<ProtectedRoute requiredPermission="manychat_settings"><AppLayout><ManyChatSettings /></AppLayout></ProtectedRoute>} />
                  <Route path="/t/:tenantSlug/green-api-settings" element={<ProtectedRoute requiredPermission="green_api_settings"><AppLayout><GreenAPISettings /></AppLayout></ProtectedRoute>} />
                  <Route path="/t/:tenantSlug/integrations" element={<ProtectedRoute requiredPermission="lead_integrations"><AppLayout><Integrations /></AppLayout></ProtectedRoute>} />
                  <Route path="/t/:tenantSlug/integrations/facebook" element={<ProtectedRoute requiredPermission="lead_integrations"><AppLayout><FacebookSettings /></AppLayout></ProtectedRoute>} />
                  <Route path="/t/:tenantSlug/facebook-settings" element={<ProtectedRoute requiredPermission="lead_integrations"><AppLayout><FacebookSettings /></AppLayout></ProtectedRoute>} />
                  <Route path="/t/:tenantSlug/facebook-callback" element={<ProtectedRoute><AppLayout><FacebookCallback /></AppLayout></ProtectedRoute>} />
                  <Route path="/t/:tenantSlug/google-ads-settings" element={<ProtectedRoute requiredPermission="lead_integrations"><AppLayout><GoogleAdsSettings /></AppLayout></ProtectedRoute>} />
                  <Route path="/t/:tenantSlug/google-analytics-settings" element={<ProtectedRoute requiredPermission="lead_integrations"><AppLayout><GoogleAnalyticsSettings /></AppLayout></ProtectedRoute>} />
                  <Route path="/t/:tenantSlug/google-search-console-settings" element={<ProtectedRoute requiredPermission="lead_integrations"><AppLayout><GoogleSearchConsoleSettings /></AppLayout></ProtectedRoute>} />
                  <Route path="/t/:tenantSlug/ahrefs-settings" element={<ProtectedRoute requiredPermission="lead_integrations"><AppLayout><AhrefsSettings /></AppLayout></ProtectedRoute>} />
                  <Route path="/t/:tenantSlug/make-settings" element={<ProtectedRoute requiredPermission="lead_integrations"><AppLayout><MakeSettings /></AppLayout></ProtectedRoute>} />
                  <Route path="/t/:tenantSlug/site-analytics" element={<ProtectedRoute requiredPermission="clients"><AppLayout><SiteAnalytics /></AppLayout></ProtectedRoute>} />
                  <Route path="/t/:tenantSlug/rank-tracking" element={<ProtectedRoute requiredPermission="clients"><AppLayout><RankTracking /></AppLayout></ProtectedRoute>} />
                  <Route path="/t/:tenantSlug/rank-tracking/:projectId" element={<ProtectedRoute requiredPermission="clients"><AppLayout><RankTrackingProject /></AppLayout></ProtectedRoute>} />
                  <Route path="/t/:tenantSlug/integrations/serpapi" element={<ProtectedRoute requiredPermission="lead_integrations"><AppLayout><SerpApiSettings /></AppLayout></ProtectedRoute>} />
                  <Route path="/t/:tenantSlug/zoom-settings" element={<ProtectedRoute requiredPermission="lead_integrations"><AppLayout><ZoomSettings /></AppLayout></ProtectedRoute>} />
                  <Route path="/t/:tenantSlug/recordings" element={<ProtectedRoute requiredPermission="recordings"><AppLayout><Recordings /></AppLayout></ProtectedRoute>} />
                  <Route path="/t/:tenantSlug/team-chat" element={<ProtectedRoute requiredPermission="team_chat"><AppLayout><TeamChat /></AppLayout></ProtectedRoute>} />
                  <Route path="/t/:tenantSlug/gmail-settings" element={<ProtectedRoute><AppLayout><GmailSettings /></AppLayout></ProtectedRoute>} />
                  <Route path="/t/:tenantSlug/gmail" element={<ProtectedRoute><AppLayout><Gmail /></AppLayout></ProtectedRoute>} />
                  <Route path="/t/:tenantSlug/signatures" element={<ProtectedRoute requiredPermission="signatures"><AppLayout><Signatures /></AppLayout></ProtectedRoute>} />
                  <Route path="/t/:tenantSlug/manus-settings" element={<ProtectedRoute requiredPermission="lead_integrations"><AppLayout><ManusSettings /></AppLayout></ProtectedRoute>} />
                  <Route path="/t/:tenantSlug/manus-tasks" element={<ProtectedRoute><AppLayout><ManusTasksPage /></AppLayout></ProtectedRoute>} />
                  <Route path="/t/:tenantSlug/agents" element={<ProtectedRoute><AppLayout><AgentHub /></AppLayout></ProtectedRoute>} />
                  <Route path="/t/:tenantSlug/ai-detection" element={<ProtectedRoute><AppLayout><AiDetection /></AppLayout></ProtectedRoute>} />
                  <Route path="/t/:tenantSlug/telephony-settings" element={<ProtectedRoute requiredPermission="lead_integrations"><AppLayout><TelephonySettings /></AppLayout></ProtectedRoute>} />
                   
                   {/* Public signing page */}
                  <Route path="/sign/:token" element={<SignDocument />} />
                   
                  {/* Legacy route - redirect to root */}
                  
                  {/* Catch-all for 404 - must be last */}
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