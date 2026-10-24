import { type CSSProperties, type ReactNode } from "react";
import { Lightbulb, Minus, Plus, type LucideIcon } from "lucide-react";
import { useI18n } from "@/hooks/use-i18n";
import { Action, Readout } from "./CardControls";

// Presentation only: callers own state, capabilities and command confirmation.
export function LightCard({ value, caption, color, strength, power, brightness, children }: {
  value: string; caption: string; color?: string; strength: number; power?: ReactNode; brightness?: ReactNode; children?: ReactNode;
}) {
  return <><div className="dg-light-well" style={{ "--lamp-color": color ?? "#ffc978", "--lamp-strength": strength } as CSSProperties}>
    <Lightbulb size={54} strokeWidth={1.1} aria-hidden="true" /><div><strong>{value}</strong><span>{caption}</span></div>{power}
  </div>{brightness}{children}</>;
}

export function ClimateCard({ value, unit, caption, min, max, step, set, children, name }: {
  value?: number; unit: string; caption: string; min?: number; max?: number; step?: number; set?: (value: number) => void; children?: ReactNode; name?: string;
}) {
  const { t, number } = useI18n();
  const adjustable = set && min !== undefined && max !== undefined && max > min && step !== undefined && step > 0;
  const next = (direction: number) => Math.min(max!, Math.max(min!, Math.round((value! + direction * step!) * 1000) / 1000));
  const dial = value !== undefined && max > min ? Math.min(1, Math.max(0, (value - min) / (max - min))) * 270 : 0;
  return <><div className="dg-thermostat" style={{ "--dial": `${dial}deg` } as CSSProperties}><div><span>{t("Target temperature")}</span><strong>{value === undefined ? "—" : number(value)}<small>{unit}</small></strong><span>{caption}</span></div></div>
    {adjustable && <div className="dg-stepper"><Action label={name ? t("Decrease temperature for {name}", { name }) : "Decrease temperature"} disabled={value === undefined || value <= min} onClick={() => set(next(-1))}><Minus /></Action><span>{t("Target")}</span><Action label={name ? t("Increase temperature for {name}", { name }) : "Increase temperature"} disabled={value === undefined || value >= max} onClick={() => set(next(1))}><Plus /></Action></div>}
    {children}
  </>;
}

export function CoverCard({ position, tilt = 0, children }: { position?: number; tilt?: number; children: ReactNode }) {
  return <>{position !== undefined && <div className="dg-window" aria-hidden="true"><div className="dg-window-light" /><div className="dg-slats" style={{ height: `${100 - Math.min(100, Math.max(0, position))}%`, "--tilt": `${tilt / 12}px` } as CSSProperties}>{Array.from({ length: 10 }, (_, i) => <i key={i} />)}</div></div>}{children}</>;
}

export function PowerCard({ on, power, value, caption, unit, children }: {
  on: boolean; power: ReactNode; value: string | number; caption: string; unit?: string; children?: ReactNode;
}) {
  return <><div className={`dg-power-disc ${on ? "is-on" : ""}`}>{power}</div><Readout value={value} unit={unit} caption={caption} />{children}</>;
}

export function SecurityCard({ icon: Icon, value, caption, secure = false, alert = false, children }: {
  icon: LucideIcon; value: string; caption: string; secure?: boolean; alert?: boolean; children?: ReactNode;
}) {
  return <><div className={`dg-security-emblem${secure ? " is-secure" : ""}${alert ? " is-alert" : ""}`}><Icon size={60} strokeWidth={1.2} aria-hidden="true" /></div><Readout value={value} caption={caption} />{children}</>;
}

export function MediaCard({ title, subtitle, caption, children }: { title: string; subtitle?: string; caption: string; children?: ReactNode }) {
  return <><div className="dg-record"><div className="dg-vinyl" aria-hidden="true"><i /></div><div><strong>{title}</strong>{subtitle && <span>{subtitle}</span>}<small>{caption}</small></div></div>{children}</>;
}
