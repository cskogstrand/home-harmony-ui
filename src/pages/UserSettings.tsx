import { useI18n } from "@/hooks/use-i18n";
import { useApp } from "@/contexts/AppContext";
import { useFamily } from "@/contexts/FamilyContext";
import { PageHeading, PanelHeading } from "@/components/FamilyPlanner";
import { Switch } from "@/components/ui/switch";
import { useSharedConfiguration } from "@/contexts/SharedConfigurationContext";
import type { Language } from "@/lib/i18n";
import { ConfigurationBackup } from "@/components/ConfigurationBackup";
export default function UserSettings() {
  const { t } = useI18n();
  const { currentUser } = useApp();
  const { appearance, setAppearance, language, setLanguage } = useFamily();
  const shared = useSharedConfiguration();
  return <div className="planner-page">
    <PageHeading title={t("Settings")} />
    <section className="glow-panel"><PanelHeading title={t("Home Assistant account")} /><p>{currentUser?.name ?? t("Not signed in")}</p></section>
    <section className="glow-panel space-y-4"><PanelHeading title={t("Appearance")} /><label className="flex justify-between">{t("Dark mode")}<Switch checked={appearance.theme === "dark"} onCheckedChange={v => setAppearance({ theme: v ? "dark" : "light" })} aria-label={t("Toggle dark mode")} /></label><label className="flex justify-between">{t("Dark timetables")}<Switch checked={appearance.darkTimetables} onCheckedChange={v => setAppearance({ darkTimetables: v })} aria-label={t("Toggle dark timetables")} aria-describedby="dark-timetables-description" /></label><p id="dark-timetables-description" className="page-note">{t("Dark backgrounds for PDF timetables. Linked images keep their colors.")}</p><label className="flex justify-between">{t("Compact mode")}<Switch checked={appearance.compactMode} onCheckedChange={v => setAppearance({ compactMode: v })} aria-label={t("Toggle compact mode")} /></label></section>
    <section className="glow-panel space-y-4"><PanelHeading title={t("Language")} />
      <label className="flex flex-wrap items-center justify-between gap-3">{t("Language")}
        <select className="h-10 rounded-lg border bg-background px-3" aria-describedby="language-description" value={language}
          disabled={!shared?.state.loaded || !!shared.state.error} onChange={event => setLanguage(event.target.value as Language)}>
          <option value="en" lang="en">English</option><option value="nb" lang="nb">Norsk bokmål</option>
        </select>
      </label>
      <p id="language-description" className="page-note">{t("Applies to every screen connected to this server.")}</p>
    </section>
    <ConfigurationBackup />
  </div>;
}
