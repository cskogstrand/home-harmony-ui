import { Link } from "react-router-dom";
import { Camera, Check, Settings, Video } from "lucide-react";
import { toast } from "sonner";
import { useSharedConfiguration } from "@/contexts/SharedConfigurationContext";
import { useI18n } from "@/hooks/use-i18n";
import { PageHeading } from "@/components/FamilyPlanner";
import { Button } from "@/components/ui/button";
import { EntityMedia } from "@/components/devices/EntityMedia";
import { SharedSettingsStatus } from "@/components/common/SharedSettingsStatus";
import { SettingsPopover } from "@/components/common/SettingsPopover";
import "@/components/camera-settings.css";

const columnClasses = ["lg:grid-cols-1", "lg:grid-cols-2", "lg:grid-cols-3", "lg:grid-cols-4"];

export default function Cameras() {
  const { message: t } = useI18n();
  const shared = useSharedConfiguration();
  const settings = shared.state.config.settings.cameras;
  const setColumns = (columns: number) => {
    try { shared.store.updateSettings(current => ({ ...current, cameras: { ...current.cameras, columns } })); }
    catch (error) { toast.error(t(error instanceof Error ? error.message : "Configuration could not be saved.")); }
  };
  return <div className="planner-page">
    <PageHeading title={t("Cameras")} description={t("Your cameras, ready to watch or use in notifications.")}>
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild><Link to="/settings/cameras?add">{t("Add camera")}</Link></Button>
        <SettingsPopover label={t("Camera settings")} className="camera-layout-popover">
          <SharedSettingsStatus />
          <Link className="text-link min-h-11" to="/settings/cameras">{t("Manage cameras")}</Link>
          <Link className="text-link min-h-11" to="/settings/camera-connections">{t("Manage connections")}</Link>
          <fieldset disabled={!shared.state.loaded || !!shared.state.error}>
            <legend className="font-medium">{t("Cameras per row")}</legend>
            <div className="grid grid-cols-2 gap-3 mt-3">{[1, 2, 3, 4].map(columns => {
              const label = t(columns === 1 ? "1 camera per row" : "{count} cameras per row", { count: columns });
              return <Button key={columns} type="button" variant="outline" className="camera-layout-option" aria-label={label} title={label} aria-pressed={settings.columns === columns} onClick={() => setColumns(columns)}>
                <span className="camera-layout-example" aria-hidden="true">
                  <span className="camera-layout-board">
                    <span className="camera-layout-heading"><Camera /><i /><Settings /></span>
                    <span className="camera-layout-grid" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
                      {Array.from({ length: columns }, (_, index) => <span key={index} className="camera-layout-card">
                        <span className="camera-layout-card-heading"><i /><Settings /></span>
                        <span className="camera-layout-modes"><i /><i /><i /></span>
                        <span className="camera-layout-video"><Video /></span>
                      </span>)}
                    </span>
                  </span>
                </span>
                <span className="camera-layout-label">{label}<Check aria-hidden="true" className={settings.columns === columns ? "" : "invisible"} /></span>
              </Button>;
            })}</div>
          </fieldset>
        </SettingsPopover>
      </div>
    </PageHeading>
    {!settings.items.length && <section className="glow-panel space-y-3"><Camera size={28} aria-hidden="true" /><h2 className="text-xl font-semibold">{t("No cameras added yet")}</h2><p className="page-note">{t("Add a camera and choose its connection. Home Assistant cameras are available to select, but are not added automatically.")}</p><Button variant="outline" asChild><Link to="/settings/camera-connections">{t("Manage connections")}</Link></Button></section>}
    <div className={`grid grid-cols-1 gap-6 ${columnClasses[settings.columns - 1]}`}>{settings.items.map(camera => <section key={camera.id} className="glow-panel min-w-0 space-y-4" aria-label={camera.name}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0"><h2 className="text-xl font-semibold break-words">{camera.name}</h2></div>
        <Button variant="ghost" size="icon" className="shrink-0" asChild><Link to={`/settings/cameras?camera=${encodeURIComponent(camera.id)}`} aria-label={t("Configure {name}", { name: camera.name })} title={t("Configure camera")}><Settings aria-hidden="true" /></Link></Button>
      </div>
      <EntityMedia camera={camera} showImageChoices />
    </section>)}</div>
  </div>;
}
