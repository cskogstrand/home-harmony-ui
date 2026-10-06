import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { HomeAssistantClient } from "@/lib/home-assistant";
import { mapHome } from "@/lib/ha-model";

function useHomeAssistant() {
  const [client] = useState(() => new HomeAssistantClient());
  const state = useSyncExternalStore(client.subscribe, client.getSnapshot);
  const [compactMode, setCompactMode] = useState(false);
  useEffect(() => { client.start(); return client.dispose; }, [client]);
  const currentHome = useMemo(() => mapHome(state.states, state.registries, state.url, state.config), [state.states, state.registries, state.url, state.config]);
  return { currentHome, currentUser: state.user, haUrl: state.url, connectionStatus: state.status,
    connectionError: state.error, metadataWarnings: state.warnings, homeOnline: state.status === "connected",
    services: state.services, commands: state.commands, connect: client.connect, disconnect: client.disconnect,
    logout: client.logout, command: client.command, calendarEvents: client.calendarEvents,
    compactMode, toggleCompactMode: () => setCompactMode(value => !value) };
}
const AppContext = createContext<ReturnType<typeof useHomeAssistant> | null>(null);
export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
}
export function AppProvider({ children }: { children: ReactNode }) {
  return <AppContext.Provider value={useHomeAssistant()}>{children}</AppContext.Provider>;
}
