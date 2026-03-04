import React, { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { Home } from "@/types/api";
import { mockHomes, mockCurrentUser, type AppUser, type UserRole } from "@/mock/data";

// ---- Connection status simulation ---------------------------
export type ConnectionStatus = "connected" | "reconnecting" | "offline";

interface AppContextValue {
  // Home
  homes: Home[];
  currentHome: Home | null;
  selectHome: (id: string) => void;

  // User
  currentUser: AppUser;
  setUserRole: (role: UserRole) => void;

  // Connection
  connectionStatus: ConnectionStatus;
  setConnectionStatus: (s: ConnectionStatus) => void;

  // UI state
  compactMode: boolean;
  toggleCompactMode: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [homes] = useState<Home[]>(mockHomes);
  const [currentHomeId, setCurrentHomeId] = useState(mockHomes[0].id);
  const [currentUser, setCurrentUser] = useState<AppUser>(mockCurrentUser);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connected");
  const [compactMode, setCompactMode] = useState(false);

  const currentHome = homes.find(h => h.id === currentHomeId) ?? null;
  const selectHome = useCallback((id: string) => setCurrentHomeId(id), []);
  const setUserRole = useCallback((role: UserRole) => setCurrentUser(u => ({ ...u, role })), []);
  const toggleCompactMode = useCallback(() => setCompactMode(c => !c), []);

  return (
    <AppContext.Provider value={{
      homes, currentHome, selectHome,
      currentUser, setUserRole,
      connectionStatus, setConnectionStatus,
      compactMode, toggleCompactMode,
    }}>
      {children}
    </AppContext.Provider>
  );
}
