import { createContext, useContext, useSyncExternalStore } from "react";
import { HomeAssistantClient } from "@/lib/home-assistant";
import { mapHome } from "@/lib/ha-model";
import type { Entity, Home } from "@/types/api";
import { AppStoreContext } from "./AppStoreContext";

function appSnapshot(client: HomeAssistantClient, state: ReturnType<HomeAssistantClient["getSnapshot"]>, currentHome: Home) {
  return { currentHome, currentUser: state.user, haUrl: state.url, connectionStatus: state.status,
    entityRegistryAvailable: state.entityRegistryAvailable, connectionError: state.error, metadataWarnings: state.warnings, homeOnline: state.status === "connected",
    services: state.services, commands: state.commands, connect: client.connect, disconnect: client.disconnect,
    command: client.command, browseMedia: client.browseMedia, sonosQueue: client.sonosQueue, watchEvents: client.watchEvents, watchCameraStream: client.watchCameraStream, watchForecast: client.watchForecast, entityHistory: client.entityHistory, energySetup: client.energySetup, calendarEvents: client.calendarEvents, watchCalendarEvents: client.watchCalendarEvents, todoItems: client.todoItems, configurationRequest: client.configurationRequest, storageRequest: client.storageRequest };
}

type AppSnapshot = ReturnType<typeof appSnapshot>;

export function createAppStore() {
  const client = new HomeAssistantClient();
  let previous: ReturnType<typeof client.getSnapshot>;
  let app: AppSnapshot;
  let entityCache: WeakMap<object, Entity>;
  function getSnapshot() {
    const state = client.getSnapshot();
    if (state !== previous) {
      // HA preserves untouched state objects. A registry or language refresh can change their names, devices or areas.
      if (state.registries !== previous?.registries || state.translations !== previous?.translations) entityCache = new WeakMap();
      const currentHome = state.states === previous?.states && state.registries === previous?.registries && state.config === previous?.config && state.translations === previous?.translations
        ? app.currentHome : mapHome(state.states, state.registries, "home", state.config, entityCache, state.translations);
      app = appSnapshot(client, state, currentHome);
      previous = state;
    }
    return app;
  }
  return { getSnapshot, subscribe: client.subscribe, start: client.start, dispose: client.dispose, setLanguage: client.setLanguage };
}

export { AppStoreContext };
// Vehicle controls can override command routing for their subtree.
export const AppContext = createContext<AppSnapshot | null>(null);
const noSubscription = () => () => {};

// Select an existing object or a scalar so React can skip unchanged snapshots.
export function useApp(): AppSnapshot;
export function useApp<T>(select: (app: AppSnapshot) => T): T;
export function useApp(select: (app: AppSnapshot) => unknown = app => app) {
  const override = useContext(AppContext);
  const store = useContext(AppStoreContext);
  return useSyncExternalStore(override ? noSubscription : store?.subscribe ?? noSubscription, () => {
    const app = override ?? store?.getSnapshot();
    if (!app) throw new Error("useApp must be used within AppProvider");
    return select(app);
  });
}
