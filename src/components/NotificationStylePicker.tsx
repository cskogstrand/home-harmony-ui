import { Bell, Check, WashingMachine } from "lucide-react";
import { useI18n } from "@/hooks/use-i18n";
import { Button } from "./ui/button";
import type { NotificationPresentation } from "../../shared/notifications";

const styles = { banner: "Banner", section: "Section", activity: "Activity cards", "activity-compact": "Compact activity card" } as const;

export function NotificationStylePicker({ value, disabled, onChange }: { value: NotificationPresentation; disabled: boolean; onChange: (value: NotificationPresentation) => void }) {
  const { message: t } = useI18n();
  return <fieldset className="notification-style-picker"><legend className="sr-only">{t("Display as")}</legend>
    <div className="notification-style-options">{(Object.keys(styles) as NotificationPresentation[]).map(style => <Button type="button" key={style} variant="outline" className="notification-style-option" aria-pressed={value === style} disabled={disabled} onClick={() => onChange(style)}>
      <span className={`notification-style-example notification-style-example-${style}`} aria-hidden="true">
        {style === "banner" ? <span className="notification-style-banner"><Bell /><span><i /><i /></span><i /></span> : style === "section" ? <span className="notification-style-section"><span><Bell /><i /></span><span><WashingMachine /><i /><i /></span><span><Bell /><i /><i /></span></span> : <span className="notification-style-activity"><span><i /><WashingMachine /></span><span><b>24<span> min</span></b><b>10:30</b></span><span className="notification-style-progress"><i /></span></span>}
      </span>
      <span className="notification-style-label">{t(styles[style])}<Check aria-hidden="true" className={value === style ? "" : "invisible"} /></span>
    </Button>)}</div>
  </fieldset>;
}
