import { matchPath } from "react-router-dom";
import { Music2, Camera, SlidersHorizontal, Grid2X2, Lightbulb, DoorOpen, MapPin, Sparkles, Shield, Zap, Bell, Settings } from "lucide-react";

const familyPaths = ["/", "/calendar", "/lists", "/school"];
export const mainPaths = [...familyPaths, "/home"];
export const mainPagePath = (path: string) => mainPaths.find(page => page === (path.replace(/\/+$/, "") || "/").toLowerCase());
export const isMainPage = (path: string) => !!mainPagePath(path);

export const smartItems = [
  { path: "/home", label: "Overview", icon: Grid2X2 }, { path: "/areas", label: "Areas", icon: DoorOpen },
  { path: "/sonos", label: "Sonos", icon: Music2 },
  { path: "/devices", label: "Devices", icon: Lightbulb }, { path: "/cameras", label: "Cameras", icon: Camera }, { path: "/moods", label: "Scenes", icon: Sparkles },
  { path: "/alarm", label: "Security", icon: Shield },
];
export const moreItems = [
  { path: "/energy", label: "Car & energy", icon: Zap }, { path: "/zones", label: "Zones", icon: MapPin },
  { path: "/notifications", label: "Alerts", icon: Bell },
  { path: "/settings", label: "Home settings", icon: Settings },
];

const homePaths = [...smartItems, ...moreItems].map(item => item.path).filter(path => path !== "/settings");
homePaths.push("/areas/:areaId", "/devices/:deviceId", "/entities/:entityId", "/device-gallery", "/support");
export const isHomeSection = (path: string) => homePaths.some(pattern => matchPath(pattern, path));
