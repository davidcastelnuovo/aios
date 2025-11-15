import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AgencyProvider } from "./contexts/AgencyContext";
import { TenantProvider } from "./contexts/TenantContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import Dashboard from "./pages/Dashboard";
import Branding from "./pages/Branding";
import Auth from "./pages/Auth";
import SignUp from "./pages/SignUp";
import Setup from "./pages/Setup";
import Landing from "./pages/Landing";
import Agencies from "./pages/Agencies";
import Clients from "./pages/Clients";
import Campaigners from "./pages/Campaigners";
import Suppliers from "./pages/Suppliers";
import Finance from "./pages/Finance";
import Tasks from "./pages/Tasks";
import ClientOnboarding from "./pages/ClientOnboarding";
import TimeTracking from "./pages/TimeTracking";
import Reports from "./pages/Reports";
import MyProfile from "./pages/MyProfile";
import Users from "./pages/Users";
import SalesPeople from "./pages/SalesPeople";
import Leads from "./pages/Leads";
import SalesDashboard from "./pages/SalesDashboard";
import LeadIntegrations from "./pages/LeadIntegrations";
import Tenants from "./pages/Tenants";
import Automations from "./pages/Automations";
import Products from "./pages/Products";
import AccountingIntegrations from "./pages/AccountingIntegrations";
import AISupport from "./pages/AISupport";
import MenuManagement from "./pages/MenuManagement";
import FieldsManagement from "./pages/FieldsManagement";
import DynamicTables from "./pages/DynamicTables";
import DynamicTableView from "./pages/DynamicTableView";
import Chat from "./pages/Chat";
import ManyChatSettings from "./pages/ManyChatSettings";
import NotFound from "./pages/NotFound";
import { SuperAdminRoute } from "./components/SuperAdminRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <TooltipProvider delayDuration={0} skipDelayDuration={0}>
        <Toaster />
        <Sonner />
        <TenantProvider>
          <ThemeProvider>
            <AgencyProvider>
              <Routes>
            {/* Public routes */}
            <Route path="/landing" element={<SuperAdminRoute><Landing /></SuperAdminRoute>} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/setup" element={<Setup />} />
            
            {/* Tenant-scoped routes */}
            <Route path="/t/:tenantSlug" element={<ProtectedRoute requiredPermission="dashboard" redirectTo="/my-profile"><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />
            <Route path="/t/:tenantSlug/dashboard" element={<ProtectedRoute requiredPermission="dashboard" redirectTo="/my-profile"><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />
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
            <Route path="/t/:tenantSlug/products" element={<ProtectedRoute requiredPermission="leads"><AppLayout><Products /></AppLayout></ProtectedRoute>} />
            <Route path="/t/:tenantSlug/branding" element={<ProtectedRoute requiredPermission="branding"><AppLayout><Branding /></AppLayout></ProtectedRoute>} />
            <Route path="/t/:tenantSlug/accounting-integrations" element={<ProtectedRoute requiredPermission="accounting"><AppLayout><AccountingIntegrations /></AppLayout></ProtectedRoute>} />
            <Route path="/t/:tenantSlug/ai-support" element={<ProtectedRoute requiredPermission="ai_support"><AppLayout><AISupport /></AppLayout></ProtectedRoute>} />
            <Route path="/t/:tenantSlug/menu-management" element={<ProtectedRoute requiredPermission="menu_management"><AppLayout><MenuManagement /></AppLayout></ProtectedRoute>} />
            <Route path="/t/:tenantSlug/fields-management" element={<ProtectedRoute requiredPermission="fields_management"><AppLayout><FieldsManagement /></AppLayout></ProtectedRoute>} />
            <Route path="/t/:tenantSlug/dynamic-tables" element={<ProtectedRoute requiredPermission="branding"><AppLayout><DynamicTables /></AppLayout></ProtectedRoute>} />
            <Route path="/t/:tenantSlug/table/:tableSlug" element={<ProtectedRoute><AppLayout><DynamicTableView /></AppLayout></ProtectedRoute>} />
            <Route path="/t/:tenantSlug/chat" element={<ProtectedRoute requiredPermission="chat"><AppLayout><Chat /></AppLayout></ProtectedRoute>} />
            <Route path="/t/:tenantSlug/chat/:clientId" element={<ProtectedRoute requiredPermission="chat"><AppLayout><Chat /></AppLayout></ProtectedRoute>} />
            <Route path="/t/:tenantSlug/manychat-settings" element={<ProtectedRoute requiredPermission="settings"><AppLayout><ManyChatSettings /></AppLayout></ProtectedRoute>} />
            
            {/* Root path redirects to auth */}
            <Route path="/" element={<Auth />} />
            
            {/* Catch-all for 404 - must be last */}
            <Route path="*" element={<NotFound />} />
            </Routes>
            </AgencyProvider>
          </ThemeProvider>
        </TenantProvider>
      </TooltipProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
