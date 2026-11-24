import { useId, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { useI18n } from "@/hooks/use-i18n";

interface Panel {
  id: string;
  label: string;
  icon: LucideIcon;
  detail?: string;
  content: ReactNode;
}

export function SettingsPanels({ panels, stacked = false }: { panels: Panel[]; stacked?: boolean }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { pathname, search, hash } = useLocation();
  const params = new URLSearchParams(search);
  const id = useId();
  if (panels.length === 0) return null;
  if (stacked) return panels.map(panel => <div className="min-w-0" key={panel.id}>{panel.content}</div>);
  const selected = panels.find(panel => panel.id === params.get("panel")) ?? panels[0];
  const showMenu = panels.length > 1;
  const destination = (value: string) => {
    const search = new URLSearchParams(params);
    search.set("panel", value);
    return { pathname, search: search.toString(), hash };
  };
  return <div className={showMenu ? "settings-panels" : undefined}>
    {showMenu && <nav className="settings-panel-menu" aria-label={t("Settings sections")}>
      {panels.map(({ id: value, label, detail, icon: Icon }, index) => <Link key={value}
        to={destination(value)} preventScrollReset
        aria-current={selected.id === value ? "page" : undefined} aria-label={label}
        aria-describedby={detail ? `${id}-detail-${index}` : undefined}>
        <Icon size={18} aria-hidden="true" />
        <span>{label}{detail && <small id={`${id}-detail-${index}`}>{detail}</small>}</span>
      </Link>)}
    </nav>}
    {showMenu && <label className="settings-panel-select">{t("Settings section")}
      <select value={selected.id} onChange={event => navigate(destination(event.target.value), { preventScrollReset: true })}>
        {panels.map(panel => <option key={panel.id} value={panel.id}>{panel.label}{panel.detail ? ` · ${panel.detail}` : ""}</option>)}
      </select>
    </label>}
    <div className="min-w-0">
      {panels.map(panel => <div key={panel.id} hidden={panel.id !== selected.id}>{panel.content}</div>)}
    </div>
  </div>;
}
