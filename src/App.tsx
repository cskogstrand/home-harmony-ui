import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import { AppProvider } from "@/contexts/AppContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { FamilyProvider } from "@/contexts/FamilyContext";
import Calendar from "./pages/Calendar";
import Lists from "./pages/Lists";
import School from "./pages/School";
import SmartHome from "./pages/SmartHome";
import Dashboard from "./pages/Dashboard";
import Devices from "./pages/Devices";
import DeviceDetail from "./pages/DeviceDetail";
import EntityDetail from "./pages/EntityDetail";
import Areas from "./pages/Areas";
import Zones from "./pages/Zones";
import Moods from "./pages/Moods";
import Automations from "./pages/Automations";
import EnergySaver from "./pages/EnergySaver";
import History from "./pages/History";
import Notifications from "./pages/Notifications";
import HomeSettings from "./pages/HomeSettings";
import Support from "./pages/Support";
import Alarm from "./pages/Alarm";
import Integrations from "./pages/Integrations";
import UserSettings from "./pages/UserSettings";
import NotFound from "./pages/NotFound";
import Onboarding from "./pages/Onboarding";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppProvider>
          <FamilyProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
            <Routes>
              <Route element={<AppLayout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/onboarding" element={<Onboarding />} />
                <Route path="/calendar" element={<Calendar />} />
                <Route path="/lists" element={<Lists />} />
                <Route path="/school" element={<School />} />
                <Route path="/home" element={<SmartHome />} />
                <Route path="/devices" element={<Devices />} />
                <Route path="/devices/:deviceId" element={<DeviceDetail />} />
                <Route path="/entities/:entityId" element={<EntityDetail />} />
                <Route path="/areas" element={<Areas />} />
                <Route path="/areas/:areaId" element={<Areas />} />
                <Route path="/rooms" element={<Navigate to="/areas" replace />} />
                <Route path="/rooms/:areaId" element={<Areas />} />
                <Route path="/zones" element={<Zones />} />
                <Route path="/moods" element={<Moods />} />
                <Route path="/automations" element={<Automations />} />
                <Route path="/automation" element={<Navigate to="/automations" replace />} />
                <Route path="/energy" element={<EnergySaver />} />
                <Route path="/alarm" element={<Alarm />} />
                <Route path="/integrations" element={<Integrations />} />
                <Route path="/services" element={<Navigate to="/integrations" replace />} />
                <Route path="/history" element={<History />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/settings" element={<HomeSettings />} />
                <Route path="/support" element={<Support />} />
                <Route path="/user-settings" element={<UserSettings />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter></FamilyProvider>
        </AppProvider>
      </TooltipProvider>
  </QueryClientProvider>
);

export default App;
