import { useRef, useState, type CSSProperties } from "react";
import { CalendarDays, Layers, ListChecks, SlidersHorizontal } from "lucide-react";
import { useFamily } from "@/contexts/FamilyContext";
import { useI18n } from "@/hooks/use-i18n";
import { defaultModalGlass } from "../../shared/configuration";
import { modalGlassProperties } from "@/lib/modal-glass";
import { PanelHeading } from "./FamilyPlanner";
import { Button } from "./ui/button";
import { Slider } from "./ui/slider";

const controls = [
  { key: "modalTransparency", label: "Transparency", min: 0, max: 85, unit: "%" },
  { key: "modalBlur", label: "Frost", min: 8, max: 48, unit: "px" },
  { key: "modalSaturation", label: "Color saturation", min: 100, max: 200, unit: "%" },
  { key: "modalDimming", label: "Background dimming", min: 0, max: 60, unit: "%" },
] as const;

export function ModalGlassSettings({ disabled }: { disabled: boolean }) {
  const { t } = useI18n();
  const { appearance, setAppearance } = useFamily();
  const [draft, setDraft] = useState<Partial<typeof defaultModalGlass>>({});
  const dragging = useRef(false);
  const endDrag = () => { dragging.current = false; setDraft({}); };
  const values = { ...appearance, ...draft };
  return <section className="glow-panel modal-glass-settings">
    <PanelHeading icon={Layers} title={t("Modal glass")} />
    <p className="page-note">{t("Adjust dialog transparency and frost. Release a slider to save across connected screens.")}</p>
    <div className="modal-glass-preview" style={modalGlassProperties(values) as CSSProperties} aria-hidden="true">
      <div className="modal-glass-preview-scene">
        <span><CalendarDays />{t("Calendar")}</span><span><ListChecks />{t("To-do lists")}</span><span><SlidersHorizontal />{t("Smart home")}</span>
      </div>
      <div className="modal-glass-preview-dimmer modal-backdrop" />
      <div className="modal-glass-preview-surface glass-surface glass-modal">
        <strong>{t("Modal preview")}</strong><p>{t("Changes appear here immediately.")}</p>
      </div>
    </div>
    <div className="modal-glass-controls">
      {controls.map(({ key, label, min, max, unit }) => <div className="modal-glass-control" key={key}>
        <div><span id={`${key}-label`}>{t(label)}</span><output aria-hidden="true">{values[key]}{unit === "px" ? " px" : "%"}</output></div>
        <Slider className="min-h-12" aria-labelledby={`${key}-label`} aria-valuetext={`${values[key]}${unit === "px" ? " px" : "%"}`} min={min} max={max} step={1} disabled={disabled}
          value={[values[key]]} onPointerDownCapture={() => { dragging.current = true; }} onPointerUp={endDrag} onPointerCancel={endDrag}
          onValueChange={([value]) => { if (dragging.current) setDraft({ [key]: value }); }} onValueCommit={([value]) => setAppearance({ [key]: value })} />
      </div>)}
    </div>
    <p className="page-note">{t("Reduced transparency and higher contrast settings keep dialogs opaque.")}</p>
    <Button variant="outline" disabled={disabled} onClick={() => { setAppearance(defaultModalGlass); setDraft({}); }}>{t("Reset glass appearance")}</Button>
  </section>;
}
