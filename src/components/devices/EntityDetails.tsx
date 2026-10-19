import { useApp } from "@/contexts/AppContext";
import { useI18n } from "@/hooks/use-i18n";
import type { Entity } from "@/types/api";

export function EntityDetails({ entity }: { entity: Entity }) {
  const { t, locale } = useI18n();
  const { currentHome } = useApp();
  return <details className="device-details"><summary>{t("Technical details")}</summary><dl className="device-readings">
    <div><dt>{t("Entity ID")}</dt><dd>{entity.entityId}</dd></div>
    <div><dt>{t("Last updated")}</dt><dd>{entity.lastUpdated ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: currentHome.timeZone }).format(new Date(entity.lastUpdated)) : t("Not reported")}</dd></div>
    {Object.entries(entity.attributes).map(([key, value]) => <div key={key}><dt>{key.replace(/_/g, " ")}</dt><dd>{value == null ? t("Not reported") : typeof value === "object" ? JSON.stringify(value) : String(value)}</dd></div>)}
  </dl></details>;
}
