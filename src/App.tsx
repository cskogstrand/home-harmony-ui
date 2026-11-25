import { lazy, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, Navigate, Routes, Route, RouterProvider } from "react-router-dom";
import { AppProvider } from "@/contexts/AppProvider";
import { AppLayout } from "@/components/layout/AppLayout";
import { FamilyProvider } from "@/contexts/FamilyProvider";
import { NotificationProvider } from "@/contexts/NotificationProvider";
import { HaHealthProvider } from "@/contexts/HaHealthProvider";
import { CameraPersonImageProvider } from "@/contexts/CameraPersonImageProvider";
import { CameraPreviewImageProvider } from "@/contexts/CameraPreviewImageProvider";
import { mainPaths } from "@/lib/navigation";

const NotFound = lazy(() => import("./pages/NotFound"));
const DeviceGallery = lazy(() => import("./pages/DeviceGallery"));
const Cameras = lazy(() => import("./pages/Cameras"));
const Sonos = lazy(() => import("./pages/Sonos"));
const Devices = lazy(() => import("./pages/Devices"));
const DeviceDetail = lazy(() => import("./pages/DeviceDetail"));
const EntityDetail = lazy(() => import("./pages/EntityDetail"));
const Areas = lazy(() => import("./pages/Areas"));
const Zones = lazy(() => import("./pages/Zones"));
const Moods = lazy(() => import("./pages/Moods"));
const EnergySaver = lazy(() => import("./pages/EnergySaver"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Settings = lazy(() => import("./pages/Settings"));
const Support = lazy(() => import("./pages/Support"));
const Alarm = lazy(() => import("./pages/Alarm"));
const Onboarding = lazy(() => import("./pages/Onboarding"));

const queryClient = new QueryClient();

// Every page sits under one splat route of a data router, so pages can block navigation while they hold unsaved work.
const Pages = () => (
  <NotificationProvider><AppLayout>
    <Routes>
      {mainPaths.map(path => <Route key={path} path={path} element={null} />)}
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/device-gallery" element={<DeviceGallery />} />
      <Route path="/cameras" element={<Cameras />} />
      <Route path="/sonos" element={<Sonos />} />
      <Route path="/devices" element={<Devices />} />
      <Route path="/devices/:deviceId" element={<DeviceDetail />} />
      <Route path="/entities/:entityId" element={<EntityDetail />} />
      <Route path="/areas" element={<Areas />} />
      <Route path="/areas/:areaId" element={<Areas />} />
      <Route path="/rooms" element={<Navigate to="/areas" replace />} />
      <Route path="/rooms/:areaId" element={<Areas />} />
      <Route path="/zones" element={<Zones />} />
      <Route path="/moods" element={<Moods />} />
      <Route path="/automations" element={<Navigate to="/settings/automations" replace />} />
      <Route path="/automation" element={<Navigate to="/settings/automations" replace />} />
      <Route path="/energy" element={<EnergySaver />} />
      <Route path="/alarm" element={<Alarm />} />
      <Route path="/integrations" element={<Navigate to="/settings/integrations" replace />} />
      <Route path="/services" element={<Navigate to="/settings/integrations" replace />} />
      <Route path="/history" element={<Navigate to="/settings/activity" replace />} />
      <Route path="/notifications" element={<Notifications />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/settings/:section" element={<Settings />} />
      <Route path="/support" element={<Support />} />
      <Route path="/user-settings" element={<Navigate to="/settings/appearance" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  </AppLayout></NotificationProvider>
);

const App = () => {
  // Made on first render, so the router reads the address the page (or a test) starts at.
  const [router] = useState(() => createBrowserRouter([{ path: "*", element: <Pages /> }]));
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppProvider>
          <FamilyProvider><HaHealthProvider>
            <CameraPersonImageProvider><CameraPreviewImageProvider>
            <Toaster />
            <Sonner />
            <RouterProvider router={router} />
          </CameraPreviewImageProvider></CameraPersonImageProvider></HaHealthProvider></FamilyProvider>
        </AppProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
