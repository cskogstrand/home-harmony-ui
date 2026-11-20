import { useEffect, useState, type ReactNode } from "react";
import { AppStoreContext, createAppStore } from "./AppContext";

export function AppProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createAppStore);
  useEffect(() => { store.start(); return store.dispose; }, [store]);
  return <AppStoreContext.Provider value={store}>{children}</AppStoreContext.Provider>;
}
