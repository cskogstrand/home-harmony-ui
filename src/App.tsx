import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppProvider } from "@/contexts/AppContext";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AppLayout } from "@/components/layout/AppLayout";
import Dashboard from "./pages/Dashboard";
import Devices from "./pages/Devices";
import DeviceDetail from "./pages/DeviceDetail";
import Rooms from "./pages/Rooms";
import Moods from "./pages/Moods";
import Automation from "./pages/Automation";
import EnergySaver from "./pages/EnergySaver";
import History from "./pages/History";
import Notifications from "./pages/Notifications";
import HomeSettings from "./pages/HomeSettings";
import Support from "./pages/Support";
import Alarm from "./pages/Alarm";
import Services from "./pages/Services";
import UserSettings from "./pages/UserSettings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AppProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<AppLayout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/devices" element={<Devices />} />
                <Route path="/devices/:deviceId" element={<DeviceDetail />} />
                <Route path="/rooms" element={<Rooms />} />
                <Route path="/rooms/:roomId" element={<Rooms />} />
                <Route path="/moods" element={<Moods />} />
                <Route path="/automation" element={<Automation />} />
                <Route path="/energy" element={<EnergySaver />} />
                <Route path="/alarm" element={<Alarm />} />
                <Route path="/services" element={<Services />} />
                <Route path="/history" element={<History />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/settings" element={<HomeSettings />} />
                <Route path="/support" element={<Support />} />
                <Route path="/user-settings" element={<UserSettings />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AppProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
