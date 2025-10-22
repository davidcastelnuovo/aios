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
import Agencies from "./pages/Agencies";
import Clients from "./pages/Clients";
import Campaigners from "./pages/Campaigners";
import Suppliers from "./pages/Suppliers";
import Finance from "./pages/Finance";
import Tasks from "./pages/Tasks";
import ClientOnboarding from "./pages/ClientOnboarding";
import TimeTracking from "./pages/TimeTracking";
import Reports from "./pages/Reports";
import Users from "./pages/Users";
import MyProfile from "./pages/MyProfile";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AgencyProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/" element={<ProtectedRoute allowedRoles={["owner", "agency_manager"]}><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />
          <Route path="/agencies" element={<ProtectedRoute><AppLayout><Agencies /></AppLayout></ProtectedRoute>} />
          <Route path="/clients" element={<ProtectedRoute><AppLayout><Clients /></AppLayout></ProtectedRoute>} />
          <Route path="/campaigners" element={<ProtectedRoute allowedRoles={["admin", "owner", "agency_manager"]}><AppLayout><Campaigners /></AppLayout></ProtectedRoute>} />
          <Route path="/suppliers" element={<ProtectedRoute allowedRoles={["owner", "agency_manager"]}><AppLayout><Suppliers /></AppLayout></ProtectedRoute>} />
          <Route path="/finance" element={<ProtectedRoute allowedRoles={["owner", "agency_manager"]}><AppLayout><Finance /></AppLayout></ProtectedRoute>} />
          <Route path="/tasks" element={<ProtectedRoute><AppLayout><Tasks /></AppLayout></ProtectedRoute>} />
          <Route path="/client-onboarding" element={<ProtectedRoute><AppLayout><ClientOnboarding /></AppLayout></ProtectedRoute>} />
          <Route path="/time-tracking" element={<ProtectedRoute><AppLayout><TimeTracking /></AppLayout></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute allowedRoles={["admin", "owner", "agency_manager"]}><AppLayout><Reports /></AppLayout></ProtectedRoute>} />
          <Route path="/users" element={<ProtectedRoute allowedRoles={["admin", "owner"]}><AppLayout><Users /></AppLayout></ProtectedRoute>} />
          <Route path="/my-profile" element={<ProtectedRoute allowedRoles={["user"]}><AppLayout><MyProfile /></AppLayout></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
    </AgencyProvider>
  </QueryClientProvider>
);

export default App;
