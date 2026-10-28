import { PanelTitle } from "@/components/PanelTitle";
import { SettingsPopover } from "@/components/common/SettingsPopover";
import { useI18n } from "@/hooks/use-i18n";
import { Link, Navigate, useLocation, useParams } from "react-router-dom";
import { DoorOpen, ArrowUpRight } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { PageHeading } from "@/components/FamilyPlanner";
import { EntityCard } from "@/components/devices/EntityCard";
export default function Areas() {
  const { t } = useI18n();
  const { currentHome, haUrl } = useApp();
  const { areaId } = useParams();
  const { pathname } = useLocation();
  if (pathname.startsWith("/rooms/")) return <Navigate to={`/areas/${encodeURIComponent(areaId)}`} replace />;
  const area = currentHome.areas.find(a => a.id === areaId);
  return <div className="planner-page"><PageHeading title={areaId ? (area?.id === "unassigned" ? t("Unassigned") : area?.name) ?? t("Area not found") : t("Areas")}>{haUrl && <SettingsPopover label={t("Area settings")}><a className="text-link min-h-11" href={`${haUrl}/config/areas/dashboard`} target="_blank" rel="noreferrer">{t("Manage areas in Home Assistant")}</a></SettingsPopover>}</PageHeading>
    {areaId && <Link className="text-link" to="/areas">{t("Back to areas")}</Link>}
    <div className="home-device-grid">{areaId ? area?.entities.map(entity => <EntityCard key={entity.entityId} entity={entity} />) : currentHome.areas.map(area => <Link key={area.id} to={`/areas/${encodeURIComponent(area.id)}`} className="glow-panel space-y-3"><PanelTitle icon={DoorOpen}>{area.id === "unassigned" ? t("Unassigned") : area.name}</PanelTitle><p>{t(area.entities.length === 1 ? "{count} control" : "{count} controls", { count: area.entities.length })}</p><ArrowUpRight /></Link>)}</div>
    {!currentHome.areas.length && <p className="glow-panel empty-note">{t("No areas available.")}</p>}
  </div>;
}
