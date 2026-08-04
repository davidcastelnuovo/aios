import { lazy, Suspense } from "react";
import { Route, Navigate } from "react-router-dom";
import { ModulePermissionGate } from "@/components/ModulePermissionGate";
import { TenantAppShell } from "@/components/layout/TenantAppShell";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import type { ModulePermission } from "@/hooks/useUserPermissions";
import DashboardRouter from "@/pages/DashboardRouter";

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

function gate(
  element: React.ReactNode,
  permission?: ModulePermission,
  redirectTo = "my-profile",
) {
  if (!permission) return element;
  return (
    <ModulePermissionGate permission={permission} redirectTo={redirectTo}>
      {element}
    </ModulePermissionGate>
  );
}

/** Tenant-scoped routes. AppLayout + auth shell persist across child navigations. */
export function tenantRoutes() {
  return (
    <>
      <Route path="/t/:tenantSlug/marketing" element={<ProtectedRoute><MarketingDepartment /></ProtectedRoute>} />
      <Route path="/t/:tenantSlug/marketing/department/:department" element={<ProtectedRoute><MarketingDepartment /></ProtectedRoute>} />
      <Route path="/t/:tenantSlug/marketing/:clientId" element={<ProtectedRoute><MarketingDepartment /></ProtectedRoute>} />
      <Route path="/t/:tenantSlug/marketing/:clientId/:department" element={<ProtectedRoute><MarketingDepartment /></ProtectedRoute>} />
      <Route path="/t/:tenantSlug/automations/flow/:automationId" element={<ProtectedRoute requiredPermission="automations"><AutomationFlow /></ProtectedRoute>} />
      <Route path="/t/:tenantSlug/command-center" element={<ProtectedRoute><CarmenCommandCenter /></ProtectedRoute>} />
      <Route path="/t/:tenantSlug/unified-callback" element={<Suspense fallback={<div />}><UnifiedCallback /></Suspense>} />

      <Route path="/t/:tenantSlug" element={<TenantAppShell />}>
        <Route index element={gate(<Home />, "dashboard")} />
        <Route path="home" element={<Home />} />
        <Route path="dashboard" element={gate(<DashboardRouter />, "dashboard")} />
        <Route path="agencies" element={gate(<Agencies />, "agencies")} />
        <Route path="clients" element={gate(<Clients />, "clients")} />
        <Route path="campaigners" element={gate(<Campaigners />, "campaigners")} />
        <Route path="suppliers" element={gate(<Suppliers />, "suppliers")} />
        <Route path="finance" element={gate(<Finance />, "finance")} />
        <Route path="tasks" element={gate(<Tasks />, "tasks")} />
        <Route path="time-tracking" element={gate(<TimeTracking />, "time_tracking")} />
        <Route path="my-profile" element={<MyProfile />} />
        <Route path="users" element={gate(<Users />, "users")} />
        <Route path="sales-dashboard" element={gate(<SalesDashboard />, "sales_dashboard")} />
        <Route path="sales-people" element={gate(<SalesPeople />, "sales_people")} />
        <Route path="leads" element={gate(<Leads />, "leads")} />
        <Route path="lead-integrations" element={gate(<LeadIntegrations />, "lead_integrations")} />
        <Route path="tenants" element={gate(<Tenants />, "tenants")} />
        <Route path="automations" element={gate(<Automations />, "automations")} />
        <Route path="broadcast" element={gate(<Broadcast />, "broadcast")} />
        <Route path="carmen-insights" element={<Navigate to="../agents?tab=learning" replace />} />
        <Route path="visual-workspace" element={<VisualWorkspace />} />
        <Route path="campaign-alerts" element={<CampaignAlerts />} />
        <Route path="products" element={gate(<Products />, "leads")} />
        <Route path="branding" element={gate(<Branding />, "branding")} />
        <Route path="accounting-integrations" element={gate(<AccountingIntegrations />, "accounting_integrations")} />
        <Route path="accounting-settings" element={gate(<AccountingSettings />, "accounting_integrations")} />
        <Route path="ai-support" element={<DashboardRouter />} />
        <Route path="menu-management" element={gate(<MenuManagement />, "menu_management")} />
        <Route path="fields-management" element={gate(<FieldsManagement />, "fields_management")} />
        <Route path="dynamic-tables" element={gate(<DynamicTables />, "dynamic_tables")} />
        <Route path="table/:tableSlug" element={<DynamicTableView />} />
        <Route path="dashboard/:dashboardId" element={<DashboardView />} />
        <Route path="chat" element={gate(<Chat />, "chat")} />
        <Route path="chat/:clientId" element={gate(<Chat />, "chat")} />
        <Route path="chat-integrations" element={gate(<ChatIntegrations />, "chat_integrations")} />
        <Route path="manychat-settings" element={gate(<ManyChatSettings />, "manychat_settings")} />
        <Route path="green-api-settings" element={gate(<GreenAPISettings />, "green_api_settings")} />
        <Route path="manus-wa-settings" element={gate(<ManusWhatsAppSettings />, "manus_wa_settings")} />
        <Route path="meta-whatsapp-settings" element={gate(<MetaWhatsAppSettings />, "chat_integrations")} />
        <Route path="llm-settings" element={gate(<LLMSettings />, "lead_integrations")} />
        <Route path="telegram-settings" element={gate(<TelegramSettings />, "lead_integrations")} />
        <Route path="integrations" element={gate(<Integrations />, "lead_integrations")} />
        <Route path="integrations/facebook" element={gate(<FacebookSettings />, "lead_integrations")} />
        <Route path="facebook-settings" element={gate(<FacebookSettings />, "lead_integrations")} />
        <Route path="facebook-callback" element={<FacebookCallback />} />
        <Route path="google-ads-settings" element={gate(<GoogleAdsSettings />, "lead_integrations")} />
        <Route path="google-analytics-settings" element={gate(<GoogleAnalyticsSettings />, "lead_integrations")} />
        <Route path="google-search-console-settings" element={gate(<GoogleSearchConsoleSettings />, "lead_integrations")} />
        <Route path="ahrefs-settings" element={gate(<AhrefsSettings />, "lead_integrations")} />
        <Route path="tiktok-settings" element={gate(<TikTokSettings />, "lead_integrations")} />
        <Route path="make-settings" element={gate(<MakeSettings />, "lead_integrations")} />
        <Route path="site-analytics" element={gate(<SiteAnalytics />, "site_analytics")} />
        <Route path="rank-tracking" element={gate(<RankTracking />, "rank_tracking")} />
        <Route path="rank-tracking/:projectId" element={gate(<RankTrackingProject />, "rank_tracking")} />
        <Route path="dmm-dashboard" element={gate(<DMMDashboard />, "crm_dashboard")} />
        <Route path="integrations/serpapi" element={gate(<SerpApiSettings />, "lead_integrations")} />
        <Route path="zoom-settings" element={gate(<ZoomSettings />, "lead_integrations")} />
        <Route path="recordings" element={gate(<Recordings />, "recordings")} />
        <Route path="team-chat" element={gate(<TeamChat />, "team_chat")} />
        <Route path="gmail-settings" element={<GmailSettings />} />
        <Route path="gmail" element={<Gmail />} />
        <Route path="signatures" element={gate(<Signatures />, "signatures")} />
        <Route path="manus-settings" element={gate(<ManusSettings />, "lead_integrations")} />
        <Route path="manus-tasks" element={<ManusTasksPage />} />
        <Route path="agents" element={<AgentHub />} />
        <Route path="agent-tasks" element={<AgentTasksPage />} />
        <Route path="skins" element={<SkinsManager />} />
        <Route path="carmen-access" element={<Navigate to="../agents?tab=access" replace />} />
        <Route path="carmen-studio" element={<Navigate to="../agents" replace />} />
        <Route path="github-agent" element={<GithubAgent />} />
        <Route path="telephony-settings" element={gate(<TelephonySettings />, "lead_integrations")} />
        <Route path="maskyoo-settings" element={gate(<MaskyooSettings />, "lead_integrations")} />
        <Route path="wordpress-settings" element={gate(<WordPressSettings />, "lead_integrations")} />
        <Route path="landing-page-submissions" element={<LandingPageSubmissions />} />
        <Route path="unified-settings" element={gate(<UnifiedSettings />, "lead_integrations")} />
      </Route>
    </>
  );
}
