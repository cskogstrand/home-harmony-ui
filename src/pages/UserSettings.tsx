import { useI18n } from "@/hooks/use-i18n";
import { useApp } from "@/contexts/AppContext";
import { useFamily } from "@/contexts/FamilyContext";
import { PageHeading, PanelHeading } from "@/components/FamilyPlanner";
import { Switch } from "@/components/ui/switch";
import { useSharedConfiguration } from "@/contexts/SharedConfigurationContext";
import type { Language } from "@/lib/i18n";
import { ConfigurationBackup } from "@/components/ConfigurationBackup";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const palettes = [
  { value: "pearl", name: "Pearl" },
  { value: "sage", name: "Sage" },
  { value: "sand", name: "Sand" },
  { value: "dusk", name: "Dusk" },
  { value: "mist", name: "Mist" },
  { value: "rose", name: "Rose" },
  { value: "olive", name: "Olive" },
  { value: "clay", name: "Clay" },
  { value: "lavender", name: "Lavender" },
  { value: "seafoam", name: "Seafoam" },
  { value: "honey", name: "Honey" },
  { value: "slate", name: "Slate" },
] as const;

export default function UserSettings() {
  const { t } = useI18n();
  const { currentUser } = useApp();
  const { appearance, setAppearance, language, setLanguage } = useFamily();
  const shared = useSharedConfiguration();
  return <div className="planner-page">
    <PageHeading title={t("Settings")} />
    <section className="glow-panel"><PanelHeading title={t("Home Assistant account")} /><p>{currentUser?.name ?? t("Not signed in")}</p></section>
    <section className="glow-panel space-y-4">
      <PanelHeading title={t("Appearance")} />
      <label className="flex items-center justify-between gap-3">{t("Dark mode")}<Switch checked={appearance.theme === "dark"} onCheckedChange={v => setAppearance({ theme: v ? "dark" : "light" })} aria-label={t("Toggle dark mode")} /></label>
      <fieldset className="palette-fieldset">
        <legend id="color-palette-label">{t("Color palette")}</legend>
        <p id="color-palette-description" className="page-note">{t("Colors for the whole app, in light and dark mode. Shared across connected screens.")}</p>
        <RadioGroup className="palette-options" aria-labelledby="color-palette-label" aria-describedby="color-palette-description"
          value={appearance.colorPalette} onValueChange={colorPalette => setAppearance({ colorPalette: colorPalette as typeof appearance.colorPalette })}
          disabled={!shared?.state.loaded || !!shared.state.error}>
          {palettes.map(palette => <label key={palette.value} className="palette-option">
            <span className="palette-preview" data-color-palette={palette.value} aria-hidden="true"><span /><span /><span /></span>
            <span className="palette-option-label"><RadioGroupItem className="min-h-4 shrink-0" value={palette.value} />{t(palette.name)}</span>
          </label>)}
        </RadioGroup>
      </fieldset>
      <label className="flex items-center justify-between gap-3">{t("Dark timetables")}<Switch checked={appearance.darkTimetables} onCheckedChange={v => setAppearance({ darkTimetables: v })} aria-label={t("Toggle dark timetables")} aria-describedby="dark-timetables-description" /></label>
      <p id="dark-timetables-description" className="page-note">{t("Dark backgrounds for PDF timetables. Linked images keep their colors.")}</p>
      <label className="flex items-center justify-between gap-3">{t("Compact mode")}<Switch checked={appearance.compactMode} onCheckedChange={v => setAppearance({ compactMode: v })} aria-label={t("Toggle compact mode")} /></label>
    </section>
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
