import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { Home, AlarmMode } from "@/types/api";
import { mockHomes, mockCurrentUser, type AppUser, type UserRole } from "@/mock/data";
import { toast } from "sonner";

// ---- Connection status simulation ---------------------------
export type ConnectionStatus = "connected" | "reconnecting" | "offline";

interface AppContextValue {
  // Home
  homes: Home[];
  currentHome: Home | null;
  selectHome: (id: string) => void;

  // User
  currentUser: AppUser;
  setUserRole: (role: UserRole) => void;

  // Connection
  connectionStatus: ConnectionStatus;
  setConnectionStatus: (s: ConnectionStatus) => void;

  // UI state
  compactMode: boolean;
  toggleCompactMode: () => void;
  homeOnline: boolean;
  updateDeviceAttribute: (deviceId: string, name: string, value: unknown) => boolean;
  activateMood: (id: string) => void;
  setAlarmMode: (mode: AlarmMode) => void;
  setRuleEnabled: (id: string, enabled: boolean) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [homes, setHomes] = useState<Home[]>(mockHomes);
  const [currentHomeId, setCurrentHomeId] = useState(mockHomes[0].id);
  const [currentUser, setCurrentUser] = useState<AppUser>(mockCurrentUser);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connected");
  const [compactMode, setCompactMode] = useState(false);

  const currentHome = homes.find(h => h.id === currentHomeId) ?? null;
  const selectHome = useCallback((id: string) => setCurrentHomeId(id), []);
  const setUserRole = useCallback((role: UserRole) => setCurrentUser(u => ({ ...u, role })), []);
  const toggleCompactMode = useCallback(() => setCompactMode(c => !c), []);
  const homeOnline = !!currentHome?.gateway.online && connectionStatus === "connected";
  const updateHome = (update: (home: Home) => Home) => setHomes(previous => previous.map(home => home.id === currentHomeId ? update(home) : home));
  const canControl = () => {
    if (!homeOnline) toast.error("Home hub unavailable. Controls will return when it reconnects.");
    return homeOnline;
  };
  const updateDeviceAttribute = (deviceId: string, name: string, value: unknown) => {
    if (!canControl()) return false;
    const device = currentHome?.rooms.flatMap(r => r.devices).find(d => d.id === deviceId);
    const attribute = device?.attributes.find(a => a.name === name);
    const writable = ["isOn", "brightness", "targetTemperature", "lockState", "isOpen", "position", "charging", "chargeLimit"];
    if (!device?.online || !attribute || !writable.includes(name)) return false;
    if (typeof value !== typeof attribute.value || (name === "lockState" && value !== "locked" && value !== "unlocked")) return false;
    if (typeof value === "number" && (!Number.isFinite(value) || value < Number(attribute.minValue ?? -Infinity) || value > Number(attribute.maxValue ?? Infinity))) return false;
    updateHome(home => ({ ...home, moods: home.moods?.map(m => ({ ...m, active: false })), rooms: home.rooms.map(room => ({ ...room,
      devices: room.devices.map(d => d.id !== deviceId ? d : { ...d, attributes: d.attributes.map(a => a.name === name ? { ...a, value, updatedAt: new Date().toISOString() } : name === "charging" && a.name === "currentPower" ? { ...a, value: value ? 7.4 : 0 } : a) }),
    })) }));
    return true;
  };
  const activateMood = (id: string) => {
    if (!canControl()) return;
    const mood = currentHome?.moods?.find(m => m.id === id);
    if (!mood) return;
    const offlineTarget = mood.devices?.some(target => !currentHome.rooms.flatMap(r => r.devices).find(d => d.id === target.deviceId)?.online);
    if (offlineTarget) { toast.error("A device in this scene is offline. The scene was not applied."); return; }
    updateHome(home => ({ ...home, moods: home.moods?.map(m => ({ ...m, active: m.id === id })), rooms: home.rooms.map(room => ({ ...room,
      devices: room.devices.map(device => ({ ...device, attributes: device.attributes.map(a => {
        const change = mood.devices?.find(d => d.deviceId === device.id)?.attributes.find(attr => attr.name === a.name);
        return change && !device.ignoreInMoods ? { ...a, value: change.value } : a;
      }) })),
    })) }));
    toast.success(`${mood.name} is set`);
  };
  const setAlarmMode = (mode: AlarmMode) => {
    if (!canControl()) return;
    updateHome(home => ({ ...home, activeProfile: { mode, previousMode: home.activeProfile?.mode ?? null, modeChangedAt: new Date().toISOString(), modeChangedBy: currentUser.name } }));
    toast.success(mode === "disarmed" ? "Demo alarm disarmed" : "Demo alarm armed");
  };
  const setRuleEnabled = (id: string, enabled: boolean) => {
    if (!canControl()) return;
    updateHome(home => ({ ...home, rules: home.rules.map(rule => rule.id === id ? { ...rule, enabled } : rule) }));
  };

  return (
    <AppContext.Provider value={{
      homes, currentHome, selectHome,
      currentUser, setUserRole,
      connectionStatus, setConnectionStatus,
      compactMode, toggleCompactMode,
      homeOnline, updateDeviceAttribute, activateMood, setAlarmMode, setRuleEnabled,
    }}>
      {children}
    </AppContext.Provider>
  );
}
