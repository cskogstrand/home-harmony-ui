import { lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import { AppProvider } from "@/contexts/AppProvider";
import { AppLayout } from "@/components/layout/AppLayout";
import { FamilyProvider } from "@/contexts/FamilyProvider";
import NotFound from "./pages/NotFound";

const Calendar = lazy(() => import("./pages/Calendar"));
const Lists = lazy(() => import("./pages/Lists"));
const School = lazy(() => import("./pages/School"));
const SmartHome = lazy(() => import("./pages/SmartHome"));
const DeviceGallery = lazy(() => import("./pages/DeviceGallery"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Devices = lazy(() => import("./pages/Devices"));
const DeviceDetail = lazy(() => import("./pages/DeviceDetail"));
const EntityDetail = lazy(() => import("./pages/EntityDetail"));
const Areas = lazy(() => import("./pages/Areas"));
const Zones = lazy(() => import("./pages/Zones"));
const Moods = lazy(() => import("./pages/Moods"));
const Automations = lazy(() => import("./pages/Automations"));
const EnergySaver = lazy(() => import("./pages/EnergySaver"));
const History = lazy(() => import("./pages/History"));
const Notifications = lazy(() => import("./pages/Notifications"));
const HomeSettings = lazy(() => import("./pages/HomeSettings"));
const Support = lazy(() => import("./pages/Support"));
const Alarm = lazy(() => import("./pages/Alarm"));
const Integrations = lazy(() => import("./pages/Integrations"));
const UserSettings = lazy(() => import("./pages/UserSettings"));
const Onboarding = lazy(() => import("./pages/Onboarding"));

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
                <Route path="/device-gallery" element={<DeviceGallery />} />
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
