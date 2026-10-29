import { Bell, Camera, CookingPot, ListChecks, PlugZap, Timer, Utensils, WashingMachine, Wind } from "lucide-react";
import { useI18n } from "@/hooks/use-i18n";
import { Button } from "./ui/button";
import type { NotificationRule } from "../../shared/notifications";

const notificationIconOptions = {
  default: { icon: ListChecks, label: "Automatic icon" },
  washing: { icon: WashingMachine, label: "Laundry" },
  dishes: { icon: Utensils, label: "Dishwashing" },
  cleaning: { icon: Wind, label: "Cleaning" },
  cooking: { icon: CookingPot, label: "Cooking" },
  charging: { icon: PlugZap, label: "Charging" },
  timer: { icon: Timer, label: "Timer" },
} as const;

export function NotificationIcon({ rule, animate = false }: { rule: NotificationRule; animate?: boolean }) {
  const kind = rule.icon ?? "default";
  const Icon = kind === "default" ? rule.kind === "camera" ? Camera : rule.kind === "current" ? Bell : ListChecks : notificationIconOptions[kind].icon;
  return <span className="notification-icon" data-icon={kind} data-animate={animate && rule.animateIcon !== false} aria-hidden="true"><Icon strokeWidth={1.8} /></span>;
}

export function NotificationIconPicker({ rule, disabled, onChange }: { rule: NotificationRule; disabled: boolean; onChange: (icon: NotificationRule["icon"]) => void }) {
  const { message: t } = useI18n();
  return <div className="notification-icon-options" role="group" aria-label={t("Notification icon")}>{Object.entries(notificationIconOptions).map(([icon, option]) => <Button type="button" key={icon} variant="outline" aria-pressed={(rule.icon ?? "default") === icon} disabled={disabled} onClick={() => onChange(icon as NotificationRule["icon"])}>
    <NotificationIcon rule={{ ...rule, icon: icon as NotificationRule["icon"] }} /><span>{t(option.label)}</span>
  </Button>)}</div>;
}
