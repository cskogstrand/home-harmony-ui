import { Globe, Monitor, Palette } from "lucide-react";
import { useI18n } from "@/hooks/use-i18n";
import { useFamily } from "@/contexts/FamilyContext";
import { PanelHeading } from "@/components/FamilyPlanner";
import { Switch } from "@/components/ui/switch";
import { useSharedConfiguration } from "@/contexts/SharedConfigurationContext";
import type { Language } from "@/lib/i18n";
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

export default function UserSettings({ section = "appearance" }: { section?: "appearance" | "language" }) {
  const { t } = useI18n();
  const { appearance, setAppearance, language, setLanguage } = useFamily();
  const shared = useSharedConfiguration();
  const disabled = !shared?.state.loaded || !!shared.state.error;
  return <>
    {section === "appearance" && <section className="glow-panel settings-preferences">
      <PanelHeading icon={Monitor} title={t("Display")} />
      <label className="settings-control-row">{t("Dark mode")}<Switch disabled={disabled} checked={appearance.theme === "dark"} onCheckedChange={v => setAppearance({ theme: v ? "dark" : "light" })} aria-label={t("Toggle dark mode")} /></label>
      <label className="settings-control-row"><span>{t("Dark timetables")}<span id="dark-timetables-description" className="page-note block">{t("Dark backgrounds for PDF timetables. Linked images keep their colors.")}</span></span><Switch disabled={disabled} checked={appearance.darkTimetables} onCheckedChange={v => setAppearance({ darkTimetables: v })} aria-label={t("Toggle dark timetables")} aria-describedby="dark-timetables-description" /></label>
      <label className="settings-control-row">{t("Compact mode")}<Switch disabled={disabled} checked={appearance.compactMode} onCheckedChange={v => setAppearance({ compactMode: v })} aria-label={t("Toggle compact mode")} /></label>
    </section>}
    {section === "appearance" && <section className="glow-panel">
      <fieldset className="palette-fieldset">
        <legend id="color-palette-label"><span className="panel-title"><Palette className="panel-title-icon" strokeWidth={1.8} aria-hidden="true" /><span>{t("Color palette")}</span></span></legend>
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
    </section>}
    {section === "language" && <section className="glow-panel space-y-4" aria-label={t("Language")}>
      <label className="flex flex-wrap items-center justify-between gap-3"><span className="panel-title"><Globe className="panel-title-icon" strokeWidth={1.8} aria-hidden="true" /><span>{t("Language")}</span></span>
        <select className="min-h-11 max-w-full rounded-lg border bg-background px-3" aria-describedby="language-description" value={language}
          disabled={!shared?.state.loaded || !!shared.state.error} onChange={event => setLanguage(event.target.value as Language)}>
          <option value="en" lang="en">English</option><option value="nb" lang="nb">Norsk bokmål</option>
        </select>
      </label>
      <p id="language-description" className="page-note">{t("Applies to every screen connected to this server.")}</p>
    </section>}
  </>;
}
