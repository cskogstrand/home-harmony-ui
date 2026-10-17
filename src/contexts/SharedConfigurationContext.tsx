import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { useApp } from "./AppContext";
import { SharedConfiguration } from "@/lib/shared-configuration";

const Context = createContext<ReturnType<typeof useSharedStore> | null>(null);
function useSharedStore() {
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
export function SharedConfigurationProvider({ children }: { children: ReactNode }) {
  return <Context.Provider value={useSharedStore()}>{children}</Context.Provider>;
}
export function useSharedConfiguration() { return useContext(Context); }
