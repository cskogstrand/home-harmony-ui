import { ShieldAlert } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useI18n } from "@/hooks/use-i18n";
import { canSubscribeEvent } from "@/lib/ha-permissions";

/**
 * A calm note when the dashboard's Home Assistant user is not an administrator and a Home Assistant event trigger uses an
 * event type Home Assistant only shares with administrators. Such a trigger is never subscribed, so it stays inactive.
 * Nothing shows while the user is still unknown.
 */
export function NotificationAdminEventNote({ eventTypes }: { eventTypes: readonly string[] }) {
  const { message: t } = useI18n();
  const userIsAdmin = useApp(app => app.userIsAdmin);
  if (userIsAdmin !== false) return null;
  const restricted = [...new Set(eventTypes.map(type => type.trim()).filter(type => type && !canSubscribeEvent(type, false)))];
  if (!restricted.length) return null;
  return <p className="notification-admin-note"><ShieldAlert aria-hidden="true" />
    <span>{t("Home Assistant only lets administrator users follow {events}. The dashboard's Home Assistant user is not an administrator, so this trigger stays inactive. Event entity and entity state triggers work for every user.", { events: restricted.join(", ") })}</span>
  </p>;
}
