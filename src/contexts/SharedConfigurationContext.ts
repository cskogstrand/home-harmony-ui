import { createContext, useContext, useEffect, useState, useSyncExternalStore } from "react";
import { useApp } from "./AppContext";
import { SharedConfiguration } from "@/lib/shared-configuration";

export const SharedConfigurationContext = createContext<ReturnType<typeof useSharedStore> | null>(null);
export function useSharedStore() {
  const { configurationRequest } = useApp();
  const [store] = useState(() => new SharedConfiguration(configurationRequest));
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  useEffect(() => {
    store.start();
    return store.stop;
  }, [store]);
  useEffect(() => {
    if (!state.dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [state.dirty]);
  return { state, store };
}
export function useSharedConfiguration() { return useContext(SharedConfigurationContext); }
