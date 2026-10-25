import { createContext, useContext } from "react";
import type { HomeNotification } from "@/lib/notifications";

export const NotificationContext = createContext({
  notifications: [] as HomeNotification[], errors: [] as string[],
  dismiss: (_id: string) => {}, camera: (_id: string, _open: boolean) => {}, retry: () => {},
});
export const useNotifications = () => useContext(NotificationContext);
