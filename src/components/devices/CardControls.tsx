import { useContext, useEffect, useState, type ReactNode } from "react";
import { ChevronDown, SlidersHorizontal, X, type LucideIcon } from "lucide-react";
import { useI18n } from "@/hooks/use-i18n";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CardDisabled, CardPresentation } from "./card-presentation";

export function Action({ children, onClick, label, pressed, disabled, primary = false, compactIcon: Icon }: { children: ReactNode; onClick: () => void; label?: string; pressed?: boolean; disabled?: boolean; primary?: boolean; compactIcon?: LucideIcon }) {
  const blocked = useContext(CardDisabled);
  const compact = useContext(CardPresentation).variant !== "Original";
  const { message: t } = useI18n();
  const button = <Button type="button" className={`dg-action${compact && Icon ? " dg-icon-action" : ""}`} data-primary={primary || undefined} variant={primary ? "default" : "outline"} disabled={blocked || disabled} aria-label={label && t(label)} aria-pressed={pressed} onClick={onClick}>{compact && Icon ? <Icon size={20} aria-hidden="true" /> : children}</Button>;
  return compact && label ? <Tooltip><TooltipTrigger asChild>{button}</TooltipTrigger><TooltipContent>{t(label)}</TooltipContent></Tooltip> : button;
}

export function Range({ label, value, set, min = 0, max = 100, step = 1, unit = "%", icon: Icon, commitOnly = false, disabled: blocked = false, ariaLabel }: { label: string; value?: number; set: (value: number) => void; min?: number; max?: number; step?: number; unit?: string; icon?: LucideIcon; commitOnly?: boolean; disabled?: boolean; ariaLabel?: string }) {
  const { message: t, number } = useI18n();
  const disabled = useContext(CardDisabled) || blocked;
  const compact = useContext(CardPresentation).variant !== "Original";
  const [draft, setDraft] = useState(value);
  const [dragging, setDragging] = useState(false);
  useEffect(() => setDraft(value), [value, disabled]);
  const current = commitOnly && dragging && !disabled ? draft : value;
  const shown = current === undefined ? "—" : `${number(current)}${unit}`;
  const slider = <Slider min={min} max={max} step={step} value={[Math.min(max, Math.max(min, current ?? min))]} disabled={disabled}
    onPointerDown={() => { if (!disabled) setDragging(true); }} onPointerCancel={() => setDragging(false)} onLostPointerCapture={() => setDragging(false)} onBlur={() => setDragging(false)}
    onValueChange={([next]) => commitOnly ? setDraft(next) : set(next)} onValueCommit={commitOnly ? ([next]) => { setDragging(false); set(next); } : undefined}
    aria-label={ariaLabel ?? t(label)} aria-valuetext={current === undefined ? t("Not reported") : shown} />;
  if (compact && Icon) return <div className="dg-range dg-inline-range"><span title={t(label)}><Icon size={20} aria-hidden="true" /><span className="sr-only">{t(label)}</span></span>{slider}<output aria-hidden="true">{shown}</output></div>;
  return <div className="dg-range"><div><span>{t(label)}</span><output aria-hidden="true">{shown}</output></div>{slider}</div>;
}

export function Segments({ label, options, value, set, icons }: { label: string; options: string[]; value: string; set: (value: string) => void; icons?: Record<string, LucideIcon> }) {
  const { message: t } = useI18n();
  return <div className="dg-segments" role="group" aria-label={t(label)}>{options.map(option => <Action key={option} label={icons?.[option] ? option : undefined} compactIcon={icons?.[option]} pressed={value === option} onClick={() => set(option)}>{t(option)}</Action>)}</div>;
}

export function Choice({ label, options, value, set, literalOptions = false, ariaLabel, optionLabel }: { label: string; options: string[]; value: string; set: (value: string) => void; literalOptions?: boolean; ariaLabel?: string; optionLabel?: (option: string) => string }) {
  const { message: t } = useI18n();
  const disabled = useContext(CardDisabled);
  return <label className="dg-choice"><span>{t(label)}</span><select aria-label={ariaLabel} disabled={disabled} value={value} onChange={e => set(e.target.value)}>{!options.includes(value) && <option value={value} disabled>{value || t("Not reported")}</option>}{options.map(option => <option key={option} value={option}>{optionLabel ? optionLabel(option) : literalOptions ? option : t(option)}</option>)}</select></label>;
}

export function Toggle({ label, on, set }: { label: string; on: boolean; set: (on: boolean) => void }) {
  const { message: t } = useI18n();
  const disabled = useContext(CardDisabled);
  return <label className="dg-toggle"><span>{t(label)}</span><Switch aria-label={t(label)} checked={on} disabled={disabled} onCheckedChange={set} /></label>;
}

export function More({ children, label = "More controls" }: { children: ReactNode; label?: string }) {
  const { message: t } = useI18n();
  const { variant, visible, title, tint } = useContext(CardPresentation);
  const compact = variant !== "Original";
  const [open, setOpen] = useState(false);
  useEffect(() => { if (!visible) setOpen(false); }, [visible]);
  if (variant === "Super compact") return <Popover open={open && visible} onOpenChange={setOpen}>
    <PopoverTrigger asChild><Button type="button" variant="ghost" className="dg-adjust-trigger" aria-label={t(label)} title={t(label)}><SlidersHorizontal size={18} aria-hidden="true" /></Button></PopoverTrigger>
    <PopoverContent align="end" className={`device-gallery dg-card dg-compact dg-control-popover dg-${tint ?? "blue"}`} aria-label={t("{name} controls", { name: title })}>
      <div className="dg-popover-heading"><strong>{title}</strong><Button type="button" variant="ghost" size="icon" aria-label={t("Close controls")} onClick={() => setOpen(false)}><X size={18} /></Button></div>
      <div className="dg-popover-controls">{children}</div>
    </PopoverContent>
  </Popover>;
  return <details className="dg-more"><summary>{compact && <SlidersHorizontal size={16} aria-hidden="true" />}{t(compact && label === "More controls" ? "Adjust" : label)}<ChevronDown size={16} aria-hidden="true" /></summary><div>{children}</div></details>;
}

export function Readout({ value, unit, caption }: { value: string | number; unit?: string; caption: string }) {
  const { message: t, number } = useI18n();
  return <div className="dg-readout"><strong>{typeof value === "number" ? number(value) : t(value)}<small>{unit}</small></strong><span>{t(caption)}</span></div>;
}

