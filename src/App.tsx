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
            <Route path="/setup" element={<Setup />} />
            <Route path="/" element={<ProtectedRoute requiredPermission="dashboard" redirectTo="/my-profile"><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />
            <Route path="/agencies" element={<ProtectedRoute><AppLayout><Agencies /></AppLayout></ProtectedRoute>} />
            <Route path="/clients" element={<ProtectedRoute><AppLayout><Clients /></AppLayout></ProtectedRoute>} />
            <Route path="/campaigners" element={<ProtectedRoute><AppLayout><Campaigners /></AppLayout></ProtectedRoute>} />
            <Route path="/suppliers" element={<ProtectedRoute><AppLayout><Suppliers /></AppLayout></ProtectedRoute>} />
            <Route path="/finance" element={<ProtectedRoute><AppLayout><Finance /></AppLayout></ProtectedRoute>} />
            <Route path="/tasks" element={<ProtectedRoute><AppLayout><Tasks /></AppLayout></ProtectedRoute>} />
            <Route path="/client-onboarding" element={<ProtectedRoute><AppLayout><ClientOnboarding /></AppLayout></ProtectedRoute>} />
            <Route path="/time-tracking" element={<ProtectedRoute><AppLayout><TimeTracking /></AppLayout></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute><AppLayout><Reports /></AppLayout></ProtectedRoute>} />
            <Route path="/my-profile" element={<ProtectedRoute><AppLayout><MyProfile /></AppLayout></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute><AppLayout><Users /></AppLayout></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AgencyProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
