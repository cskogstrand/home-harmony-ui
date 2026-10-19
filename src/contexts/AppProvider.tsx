import type { ReactNode } from "react";
import { AppContext, useHomeAssistant } from "./AppContext";

export function AppProvider({ children }: { children: ReactNode }) {
  return <AppContext.Provider value={useHomeAssistant()}>{children}</AppContext.Provider>;
}
