import type { ReactNode } from "react";
import { SharedConfigurationContext, useSharedStore } from "./SharedConfigurationContext";

export function SharedConfigurationProvider({ children }: { children: ReactNode }) {
  return <SharedConfigurationContext.Provider value={useSharedStore()}>{children}</SharedConfigurationContext.Provider>;
}
