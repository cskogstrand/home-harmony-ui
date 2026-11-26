import { createContext, useContext } from "react";
import type { HomeNotification } from "@/lib/notifications";
import type { MessageKey } from "@/lib/i18n";

const defaults = {
  notifications: [] as HomeNotification[], errors: [] as string[],
  dismiss: (_id: string) => {}, camera: (_id: string, _open: boolean) => {}, retry: () => {},
};
/** `adminRules`: rules with a Home Assistant event trigger that only an administrator user may follow; they stay inactive. */
export const NotificationContext = createContext<typeof defaults & { statusMessage?: MessageKey; waitingRules?: string[]; adminRules?: string[] }>(defaults);
export const useNotifications = () => useContext(NotificationContext);

export const NotificationDebugContext = createContext({
  previewStartedAt: undefined as number | undefined, setPreviewStartedAt: (_time: number | undefined) => {},
});
