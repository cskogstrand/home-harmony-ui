import { createContext } from "react";
import type { createAppStore } from "./AppContext";

// Separate from AppContext so hooks can reach the store where tests replace AppContext.
export const AppStoreContext = createContext<ReturnType<typeof createAppStore> | null>(null);
