import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { HomeAssistantClient } from "@/lib/home-assistant";
import { mapHome } from "@/lib/ha-model";

export function useHomeAssistant() {
  const [client] = useState(() => new HomeAssistantClient());
  const state = useSyncExternalStore(client.subscribe, client.getSnapshot);
  useEffect(() => { client.start(); return client.dispose; }, [client]);
  const currentHome = useMemo(() => mapHome(state.states, state.registries, "home", state.config), [state.states, state.registries, state.config]);
  return { currentHome, currentUser: state.user, haUrl: state.url, connectionStatus: state.status,
    connectionError: state.error, metadataWarnings: state.warnings, homeOnline: state.status === "connected",
    services: state.services, commands: state.commands, connect: client.connect, disconnect: client.disconnect,
    command: client.command, watchCameraStream: client.watchCameraStream, watchForecast: client.watchForecast, entityHistory: client.entityHistory, calendarEvents: client.calendarEvents, watchCalendarEvents: client.watchCalendarEvents, todoItems: client.todoItems, configurationRequest: client.configurationRequest, storageRequest: client.storageRequest };
}
export const AppContext = createContext<ReturnType<typeof useHomeAssistant> | null>(null);
export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
}
