import { useContext, type CSSProperties, type ReactNode } from "react";
import { Battery, Droplets, Fan, Lightbulb, Minus, Pause, Play, Plus, SkipBack, SkipForward, Waves, type LucideIcon } from "lucide-react";
import { useI18n } from "@/hooks/use-i18n";
import { Action, More, Readout } from "./CardControls";
import { CardPresentation } from "./card-presentation";

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

export function MediaCard({ title, subtitle, caption, playing, previous, playPause, next, seek, volume, more }: {
  title: string; subtitle?: string; caption: string; playing: boolean; previous?: () => void; playPause?: () => void; next?: () => void;
  seek?: ReactNode; volume?: ReactNode; more?: ReactNode;
}) {
  const superCompact = useContext(CardPresentation).variant === "Super compact";
  return <><div className="dg-record"><div className="dg-vinyl" aria-hidden="true"><i /></div><div><strong>{title}</strong>{subtitle && <span>{subtitle}</span>}<small>{caption}</small></div></div>
    {!superCompact && seek}{(previous || playPause || next) && <div className="dg-transport">
      {previous && <Action label="Previous track" onClick={previous}><SkipBack size={21} /></Action>}
      {playPause && <Action primary label={playing ? "Pause playback" : "Start playback"} onClick={playPause}>{playing ? <Pause size={24} /> : <Play size={24} />}</Action>}
      {next && <Action label="Next track" onClick={next}><SkipForward size={21} /></Action>}
    </div>}{volume}{(more || (superCompact && seek)) && <More>{superCompact && seek}{more}</More>}
  </>;
}

export function FanCard({ on, speed, children }: { on: boolean; speed?: number; children: ReactNode }) {
  return <><div className="dg-fan" data-running={on} style={{ "--fan-duration": `${5 - (speed ?? 0) / 25}s` } as CSSProperties}><Fan size={98} strokeWidth={1} aria-hidden="true" /></div>{children}</>;
}

export function HumidityCard({ value, unit, caption, children }: { value: string | number; unit?: string; caption: string; children: ReactNode }) {
  return <><div className="dg-droplet"><Droplets size={74} strokeWidth={1.1} aria-hidden="true" /></div><Readout value={value} unit={unit} caption={caption} />{children}</>;
}

export function WaterHeaterCard({ value, unit, caption, level, children }: { value: string | number; unit?: string; caption: string; level: number; children: ReactNode }) {
  return <><div className="dg-tank" aria-hidden="true"><div style={{ height: `${Math.min(100, Math.max(0, level))}%` }} /><Waves size={30} /></div><Readout value={value} unit={unit} caption={caption} />{children}</>;
}

export function RobotCard({ status, battery, map, context, actions, more }: { status: string; battery?: number; map?: ReactNode; context?: ReactNode; actions?: ReactNode; more?: ReactNode }) {
  const compact = useContext(CardPresentation).variant !== "Original";
  const { t } = useI18n();
  return <>{!compact && map}<div className="dg-status-row"><strong>{status}</strong>{battery !== undefined && <span>{compact ? <Battery size={18} aria-label={t("Battery")} /> : t("Battery")} {battery}%</span>}</div>{context}{actions}{(more || (compact && map)) && <More>{compact && map}{more}</More>}</>;
}

export function ValveCard({ position, value, caption, children }: { position?: number; value: string; caption: string; children: ReactNode }) {
  return <><div className="dg-valve" style={{ transform: `rotate(${(position ?? 0) * .9}deg)` }}><Plus size={80} strokeWidth={1.3} aria-hidden="true" /></div><Readout value={value} caption={caption} />{children}</>;
}
