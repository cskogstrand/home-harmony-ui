import { Globe, Image, Monitor, Palette } from "lucide-react";
import { useI18n } from "@/hooks/use-i18n";
import { useFamily } from "@/contexts/FamilyContext";
import { PanelHeading } from "@/components/FamilyPlanner";
import { Switch } from "@/components/ui/switch";
import { useSharedConfiguration } from "@/contexts/SharedConfigurationContext";
import type { Language, MessageKey } from "@/lib/i18n";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ModalGlassSettings } from "@/components/ModalGlassSettings";
import { ArtworkImage } from "@/components/ArtworkImage";
import { artworkSchema, type Artwork } from "../../shared/configuration";

const artworkNames: Record<Artwork, MessageKey> = {
  none: "No artwork", fjord: "Fjord Morning", garden: "Winter Garden",
  sunroom: "Sunroom", paper: "Paper Coast", aurora: "Northern Lights",
};

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
    {section === "appearance" && <section className="settings-card settings-preferences">
      <PanelHeading icon={Monitor} title={t("Display")} />
      <label className="settings-control-row">{t("Dark mode")}<Switch disabled={disabled} checked={appearance.theme === "dark"} onCheckedChange={v => setAppearance({ theme: v ? "dark" : "light" })} aria-label={t("Toggle dark mode")} /></label>
    </section>}
    {section === "appearance" && <section className="settings-card">
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
    {section === "appearance" && <>
      <section className="settings-card">
        <fieldset className="palette-fieldset">
          <legend id="artwork-label"><span className="panel-title"><Image className="panel-title-icon" strokeWidth={1.8} aria-hidden="true" /><span>{t("Artwork")}</span></span></legend>
          <p id="artwork-description" className="page-note">{t("Artwork follows your color palette in light and dark mode.")}</p>
          <RadioGroup className="palette-options artwork-options" aria-labelledby="artwork-label" aria-describedby="artwork-description"
            value={appearance.artwork} onValueChange={artwork => setAppearance({ artwork: artworkSchema.parse(artwork) })} disabled={disabled}>
            {artworkSchema.options.map(artwork => <label key={artwork} className="palette-option">
              {artwork === "none" ? <span className="artwork-preview artwork-ambient" aria-hidden="true" /> : <ArtworkImage artwork={artwork} className="artwork-preview" />}
              <span className="palette-option-label"><RadioGroupItem className="min-h-4 shrink-0" value={artwork} />{t(artworkNames[artwork])}</span>
            </label>)}
          </RadioGroup>
        </fieldset>
      </section>
      <section className="settings-card settings-preferences"><PanelHeading icon={Monitor} title={t("Display options")} />
      <label className="settings-control-row"><span>{t("Dark timetables")}<span id="dark-timetables-description" className="page-note block">{t("Dark backgrounds for PDF timetables. Linked images keep their colors.")}</span></span><Switch disabled={disabled} checked={appearance.darkTimetables} onCheckedChange={v => setAppearance({ darkTimetables: v })} aria-label={t("Toggle dark timetables")} aria-describedby="dark-timetables-description" /></label>
      <label className="settings-control-row">{t("Compact mode")}<Switch disabled={disabled} checked={appearance.compactMode} onCheckedChange={v => setAppearance({ compactMode: v })} aria-label={t("Toggle compact mode")} /></label>
      </section>
      <details className="settings-advanced"><summary>{t("Advanced appearance")}</summary><ModalGlassSettings disabled={disabled} /></details>
    </>}
    {section === "language" && <section className="settings-card space-y-4" aria-label={t("Language")}>
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
