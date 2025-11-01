import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AgencyProvider } from "./contexts/AgencyContext";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import Signup from "./pages/Signup";
import Setup from "./pages/Setup";
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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AgencyProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/setup" element={<Setup />} />
            <Route path="/" element={<ProtectedRoute requiredPermission="dashboard" redirectTo="/my-profile"><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />
            <Route path="/agencies" element={<ProtectedRoute requiredPermission="agencies"><AppLayout><Agencies /></AppLayout></ProtectedRoute>} />
            <Route path="/clients" element={<ProtectedRoute requiredPermission="clients"><AppLayout><Clients /></AppLayout></ProtectedRoute>} />
            <Route path="/campaigners" element={<ProtectedRoute requiredPermission="campaigners"><AppLayout><Campaigners /></AppLayout></ProtectedRoute>} />
            <Route path="/suppliers" element={<ProtectedRoute requiredPermission="suppliers"><AppLayout><Suppliers /></AppLayout></ProtectedRoute>} />
            <Route path="/finance" element={<ProtectedRoute requiredPermission="finance"><AppLayout><Finance /></AppLayout></ProtectedRoute>} />
            <Route path="/tasks" element={<ProtectedRoute requiredPermission="tasks"><AppLayout><Tasks /></AppLayout></ProtectedRoute>} />
            <Route path="/client-onboarding" element={<ProtectedRoute requiredPermission="client_onboarding"><AppLayout><ClientOnboarding /></AppLayout></ProtectedRoute>} />
            <Route path="/time-tracking" element={<ProtectedRoute requiredPermission="time_tracking"><AppLayout><TimeTracking /></AppLayout></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute requiredPermission="reports"><AppLayout><Reports /></AppLayout></ProtectedRoute>} />
            <Route path="/my-profile" element={<ProtectedRoute><AppLayout><MyProfile /></AppLayout></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute requiredPermission="users"><AppLayout><Users /></AppLayout></ProtectedRoute>} />
            <Route path="/sales-dashboard" element={<ProtectedRoute requiredPermission="sales_dashboard"><AppLayout><SalesDashboard /></AppLayout></ProtectedRoute>} />
            <Route path="/sales-people" element={<ProtectedRoute requiredPermission="sales_people"><AppLayout><SalesPeople /></AppLayout></ProtectedRoute>} />
            <Route path="/leads" element={<ProtectedRoute requiredPermission="leads"><AppLayout><Leads /></AppLayout></ProtectedRoute>} />
            <Route path="/lead-integrations" element={<ProtectedRoute requiredPermission="lead_integrations"><AppLayout><LeadIntegrations /></AppLayout></ProtectedRoute>} />
            <Route path="/tenants" element={<ProtectedRoute requiredPermission="tenants"><AppLayout><Tenants /></AppLayout></ProtectedRoute>} />
            <Route path="/automations" element={<ProtectedRoute requiredPermission="automations"><AppLayout><Automations /></AppLayout></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AgencyProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
