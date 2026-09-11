import { Suspense } from "react";
import { Route, Navigate } from "react-router-dom";
import { TenantAppShell } from "@/components/layout/TenantAppShell";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { lazyWithRetry as lazy } from "@/lib/lazyWithRetry";
const DashboardRouter = lazy(() => import("@/pages/DashboardRouter"));

const CarmenCommandCenter = lazy(() => import("@/pages/CarmenCommandCenter"));
const Home = lazy(() => import("@/pages/Home"));
const Branding = lazy(() => import("@/pages/Branding"));
const Agencies = lazy(() => import("@/pages/Agencies"));
const Clients = lazy(() => import("@/pages/Clients"));
const Campaigners = lazy(() => import("@/pages/Campaigners"));
const Suppliers = lazy(() => import("@/pages/Suppliers"));
const Finance = lazy(() => import("@/pages/Finance"));
const Tasks = lazy(() => import("@/pages/Tasks"));
const TimeTracking = lazy(() => import("@/pages/TimeTracking"));
const MyProfile = lazy(() => import("@/pages/MyProfile"));
const Users = lazy(() => import("@/pages/Users"));
const SalesPeople = lazy(() => import("@/pages/SalesPeople"));
const Leads = lazy(() => import("@/pages/Leads"));
const LeadsArchive = lazy(() => import("@/pages/LeadsArchive"));
const SalesDashboard = lazy(() => import("@/pages/SalesDashboard"));
const LeadIntegrations = lazy(() => import("@/pages/LeadIntegrations"));
const Tenants = lazy(() => import("@/pages/Tenants"));
const Automations = lazy(() => import("@/pages/Automations"));
const MarketingDepartment = lazy(() => import("@/pages/MarketingDepartment"));
const CampaignAlerts = lazy(() => import("@/pages/CampaignAlerts"));
const Broadcast = lazy(() => import("@/pages/Broadcast"));
const Products = lazy(() => import("@/pages/Products"));
const AccountingIntegrations = lazy(() => import("@/pages/AccountingIntegrations"));
const AccountingSettings = lazy(() => import("@/pages/AccountingSettings"));
const MenuManagement = lazy(() => import("@/pages/MenuManagement"));
const FieldsManagement = lazy(() => import("@/pages/FieldsManagement"));
const DynamicTables = lazy(() => import("@/pages/DynamicTables"));
const DynamicTableView = lazy(() => import("@/pages/DynamicTableView"));
const DashboardView = lazy(() => import("@/pages/DashboardView"));
const Chat = lazy(() => import("@/pages/Chat"));
const ManyChatSettings = lazy(() => import("@/pages/ManyChatSettings"));
const ChatIntegrations = lazy(() => import("@/pages/ChatIntegrations"));
const GreenAPISettings = lazy(() => import("@/pages/GreenAPISettings"));
const ManusWhatsAppSettings = lazy(() => import("@/pages/ManusWhatsAppSettings"));
const MetaWhatsAppSettings = lazy(() => import("@/pages/MetaWhatsAppSettings"));
const LLMSettings = lazy(() => import("@/pages/LLMSettings"));
const FacebookSettings = lazy(() => import("@/pages/FacebookSettings"));
const FacebookCallback = lazy(() => import("@/pages/FacebookCallback"));
const GoogleAdsSettings = lazy(() => import("@/pages/GoogleAdsSettings"));
const GoogleAnalyticsSettings = lazy(() => import("@/pages/GoogleAnalyticsSettings"));
const MakeSettings = lazy(() => import("@/pages/MakeSettings"));
const GoogleSearchConsoleSettings = lazy(() => import("@/pages/GoogleSearchConsoleSettings"));
const AhrefsSettings = lazy(() => import("@/pages/AhrefsSettings"));
const TikTokSettings = lazy(() => import("@/pages/TikTokSettings"));
const Integrations = lazy(() => import("@/pages/Integrations"));
const SiteAnalytics = lazy(() => import("@/pages/SiteAnalytics"));
const RankTracking = lazy(() => import("@/pages/RankTracking"));
const RankTrackingProject = lazy(() => import("@/pages/RankTrackingProject"));
const SerpApiSettings = lazy(() => import("@/pages/SerpApiSettings"));
const ZoomSettings = lazy(() => import("@/pages/ZoomSettings"));
const Recordings = lazy(() => import("@/pages/Recordings"));
const AutomationFlow = lazy(() => import("@/pages/AutomationFlow"));
const TeamChat = lazy(() => import("@/pages/TeamChat"));
const GmailSettings = lazy(() => import("@/pages/GmailSettings"));
const Gmail = lazy(() => import("@/pages/Gmail"));
const Signatures = lazy(() => import("@/pages/Signatures"));
const ManusSettings = lazy(() => import("@/pages/ManusSettings"));
const ManusTasksPage = lazy(() => import("@/pages/ManusTasksPage"));
const AgentHub = lazy(() => import("@/pages/AgentHub"));
const VisualWorkspace = lazy(() => import("@/pages/VisualWorkspace"));
const AgentTasksPage = lazy(() => import("@/pages/AgentTasksPage"));
const SkinsManager = lazy(() => import("@/pages/SkinsManager"));
const TelephonySettings = lazy(() => import("@/pages/TelephonySettings"));
const MaskyooSettings = lazy(() => import("@/pages/MaskyooSettings"));
const TelegramSettings = lazy(() => import("@/pages/TelegramSettings"));
const GithubAgent = lazy(() => import("@/pages/GithubAgent"));
const WordPressSettings = lazy(() => import("@/pages/WordPressSettings"));
const LandingPageSubmissions = lazy(() => import("@/pages/LandingPageSubmissions"));
const UnifiedSettings = lazy(() => import("@/pages/UnifiedSettings"));
const UnifiedCallback = lazy(() => import("@/pages/UnifiedCallback"));
const DMMDashboard = lazy(() => import("@/pages/DMMDashboard"));

/** Unknown subpath under /t/:slug — stay in shell, redirect to home (avoids global 404 flash). */
function TenantUnknownRoute() {
  return <Navigate to="home" replace />;
}

/** Tenant-scoped routes. AppLayout + auth shell persist across child navigations. */
export function tenantRoutes() {
  return (
    <>
      <Route path="/t/:tenantSlug/marketing" element={<ProtectedRoute><MarketingDepartment /></ProtectedRoute>} />
      <Route path="/t/:tenantSlug/marketing/department/:department" element={<ProtectedRoute><MarketingDepartment /></ProtectedRoute>} />
      <Route path="/t/:tenantSlug/marketing/:clientId/:department" element={<ProtectedRoute><MarketingDepartment /></ProtectedRoute>} />
      <Route path="/t/:tenantSlug/marketing/:clientId" element={<ProtectedRoute><MarketingDepartment /></ProtectedRoute>} />
      <Route path="/t/:tenantSlug/automations/flow/:automationId" element={<ProtectedRoute requiredPermission="automations"><AutomationFlow /></ProtectedRoute>} />
      <Route path="/t/:tenantSlug/command-center" element={<ProtectedRoute><CarmenCommandCenter /></ProtectedRoute>} />
      <Route path="/t/:tenantSlug/unified-callback" element={<Suspense fallback={<div />}><UnifiedCallback /></Suspense>} />

      <Route path="/t/:tenantSlug" element={<TenantAppShell />}>
        <Route index element={<Home />} />
        <Route path="home" element={<Home />} />
        <Route path="dashboard" element={<Suspense fallback={<div />}><DashboardRouter /></Suspense>} />
        <Route path="agencies" element={<Agencies />} />
        <Route path="clients" element={<Clients />} />
        <Route path="campaigners" element={<Campaigners />} />
        <Route path="suppliers" element={<Suppliers />} />
        <Route path="finance" element={<Finance />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="time-tracking" element={<TimeTracking />} />
        <Route path="my-profile" element={<MyProfile />} />
        <Route path="users" element={<Users />} />
        <Route path="sales-dashboard" element={<SalesDashboard />} />
        <Route path="sales-people" element={<SalesPeople />} />
        <Route path="leads" element={<Leads />} />
        <Route path="leads/archive" element={<LeadsArchive />} />
        <Route path="lead-integrations" element={<LeadIntegrations />} />
        <Route path="tenants" element={<Tenants />} />
        <Route path="automations" element={<Automations />} />
        <Route path="broadcast" element={<Broadcast />} />
        <Route path="carmen-insights" element={<Navigate to="../agents?tab=learning" replace />} />
        <Route path="visual-workspace" element={<VisualWorkspace />} />
        <Route path="campaign-alerts" element={<CampaignAlerts />} />
        <Route path="products" element={<Products />} />
        <Route path="branding" element={<Branding />} />
        <Route path="accounting-integrations" element={<AccountingIntegrations />} />
        <Route path="accounting-settings" element={<AccountingSettings />} />
        <Route path="ai-support" element={<Suspense fallback={<div />}><DashboardRouter /></Suspense>} />
        <Route path="menu-management" element={<MenuManagement />} />
        <Route path="fields-management" element={<FieldsManagement />} />
        <Route path="dynamic-tables" element={<DynamicTables />} />
        <Route path="table/:tableSlug" element={<DynamicTableView />} />
        <Route path="dashboard/:dashboardId" element={<DashboardView />} />
        <Route path="chat" element={<Chat />} />
        <Route path="chat/:clientId" element={<Chat />} />
        <Route path="chat-integrations" element={<ChatIntegrations />} />
        <Route path="manychat-settings" element={<ManyChatSettings />} />
        <Route path="green-api-settings" element={<GreenAPISettings />} />
        <Route path="manus-wa-settings" element={<ManusWhatsAppSettings />} />
        <Route path="meta-whatsapp-settings" element={<MetaWhatsAppSettings />} />
        <Route path="llm-settings" element={<LLMSettings />} />
        <Route path="telegram-settings" element={<TelegramSettings />} />
        <Route path="integrations" element={<Integrations />} />
        <Route path="integrations/facebook" element={<FacebookSettings />} />
        <Route path="facebook-settings" element={<FacebookSettings />} />
        <Route path="facebook-callback" element={<FacebookCallback />} />
        <Route path="google-ads-settings" element={<GoogleAdsSettings />} />
        <Route path="google-analytics-settings" element={<GoogleAnalyticsSettings />} />
        <Route path="google-search-console-settings" element={<GoogleSearchConsoleSettings />} />
        <Route path="ahrefs-settings" element={<AhrefsSettings />} />
        <Route path="tiktok-settings" element={<TikTokSettings />} />
        <Route path="make-settings" element={<MakeSettings />} />
        <Route path="site-analytics" element={<SiteAnalytics />} />
        <Route path="rank-tracking" element={<RankTracking />} />
        <Route path="rank-tracking/:projectId" element={<RankTrackingProject />} />
        <Route path="dmm-dashboard" element={<DMMDashboard />} />
        <Route path="integrations/serpapi" element={<SerpApiSettings />} />
        <Route path="zoom-settings" element={<ZoomSettings />} />
        <Route path="recordings" element={<Recordings />} />
        <Route path="team-chat" element={<TeamChat />} />
        <Route path="gmail-settings" element={<GmailSettings />} />
        <Route path="gmail" element={<Gmail />} />
        <Route path="signatures" element={<Signatures />} />
        <Route path="manus-settings" element={<ManusSettings />} />
        <Route path="manus-tasks" element={<ManusTasksPage />} />
        <Route path="agents" element={<AgentHub />} />
        <Route path="agent-tasks" element={<AgentTasksPage />} />
        <Route path="skins" element={<SkinsManager />} />
        <Route path="carmen-access" element={<Navigate to="../agents?tab=access" replace />} />
        <Route path="carmen-studio" element={<Navigate to="../agents" replace />} />
        <Route path="github-agent" element={<GithubAgent />} />
        <Route path="telephony-settings" element={<TelephonySettings />} />
        <Route path="maskyoo-settings" element={<MaskyooSettings />} />
        <Route path="wordpress-settings" element={<WordPressSettings />} />
        <Route path="landing-page-submissions" element={<LandingPageSubmissions />} />
        <Route path="unified-settings" element={<UnifiedSettings />} />
        <Route path="*" element={<TenantUnknownRoute />} />
      </Route>
    </>
  );
}
