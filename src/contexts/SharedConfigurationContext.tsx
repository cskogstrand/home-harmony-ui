import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { useApp } from "./AppContext";
import { SharedConfiguration } from "@/lib/shared-configuration";

const Context = createContext<ReturnType<typeof useSharedStore> | null>(null);
function useSharedStore() {
  const { configurationRequest, homeOnline } = useApp();
  const enabled = import.meta.env.MODE === "server";
  const [store] = useState(() => new SharedConfiguration(configurationRequest));
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  useEffect(() => {
    if (!enabled || !homeOnline) return;
    store.start();
    return store.stop;
  }, [enabled, homeOnline, store]);
  useEffect(() => {
    if (!state.dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [state.dirty]);
  return { enabled, online: homeOnline, state, store };
}
export function SharedConfigurationProvider({ children }: { children: ReactNode }) {
  return <Context.Provider value={useSharedStore()}>{children}</Context.Provider>;
}
export function useSharedConfiguration() { return useContext(Context); }
