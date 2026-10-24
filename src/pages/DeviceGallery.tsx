import { useContext, useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Activity, Columns2, Flame, House, LayoutGrid, LocateFixed, Snowflake, Sun, Volume2, ArrowDown, ArrowLeft, ArrowUp, AudioLines, Blinds, CalendarDays, Camera, Check, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, CloudSun, Droplets, Image, Leaf, Lightbulb, Lock, MapPin, Mic, Minus, Pause, Play, Plus, Power, Radio, RotateCcw, Search, Send, Settings2, ShieldCheck, Siren, Sparkles, Square, Unlock, Upload, CircleDot as Vacuum, Wand2, Wind, Zap } from "lucide-react";
import { useI18n } from "@/hooks/use-i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Action, Range, Segments, Choice, Toggle, More, Readout } from "@/components/devices/CardControls";
import { CardDisabled as DemoDisabled, CardPresentation, cardVariants, type CardVariant as Variant } from "@/components/devices/card-presentation";
import { CardFrame } from "@/components/devices/CardFrame";
import { LightCard, ClimateCard, CoverCard, PowerCard, SecurityCard, MediaCard, FanCard, HumidityCard, WaterHeaterCard, RobotCard, ValveCard } from "@/components/devices/CardLayouts";
import { cardDesigns, type CardDesign } from "@/components/devices/card-designs";

type DemoStatus = "Ready" | "Unavailable" | "Waiting" | "Command failed";
const variants = Object.values(cardVariants);
const views = ["Compare", "Super compact", "Compact", "Original"] as const;
const groups = ["All cards", "Comfort", "Security", "Media", "Appliances", "Insight", "Helpers"] as const;
type Group = typeof groups[number];
type Example = CardDesign & { content: () => ReactNode };

function SafeAction({ label, onConfirm, children }: { label: string; onConfirm: () => void; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const disabled = useContext(DemoDisabled);
  const { message: t } = useI18n();
  return <><Action onClick={() => setOpen(true)} primary>{children}{t(label)}</Action><ConfirmDialog open={open} onOpenChange={setOpen} title={label} description="This changes the fictional demo only. No device command will be sent." disabled={disabled} onConfirm={onConfirm} /></>;
}

function LightDemo() {
  const compact = useContext(CardPresentation).variant !== "Original";
  const { message: t } = useI18n();
  const [on, setOn] = useState(true), [brightness, setBrightness] = useState(72), [kelvin, setKelvin] = useState(2700), [color, setColor] = useState("#ffc978"), [mode, setMode] = useState("White"), [effect, setEffect] = useState("None");
  const disabled = useContext(DemoDisabled);
  const colorControls = <><Segments label="Light color mode" options={["White", "Color"]} value={mode} set={setMode} />
    {mode === "White" ? <Range label="Warmth" value={kelvin} set={setKelvin} min={2200} max={6500} step={100} unit=" K" /> : <div className="dg-colors">{["#ffc978", "#ff9b9b", "#c2abff", "#8cbfff", "#90dccc"].map(c => <button key={c} disabled={disabled} style={{ background: c }} aria-label={`${t("Set color")} ${c}`} aria-pressed={color === c} onClick={() => setColor(c)}>{color === c && <Check size={20} />}</button>)}<label className="dg-custom-color"><span className="sr-only">{t("Custom color")}</span><input type="color" disabled={disabled} value={color} onChange={e => setColor(e.target.value)} /></label></div>}</>;
  return <LightCard value={on ? `${brightness}%` : t("Off")} caption={t(compact ? (on ? "On" : "Off") : mode === "White" ? "A little warmth goes a long way." : "A color for every mood.")} color={mode === "White" ? `hsl(${35 + (kelvin - 2200) / 90} 85% ${70 + (kelvin - 2200) / 180}%)` : color} strength={on ? brightness / 100 : 0}
    power={<Action label="Toggle demo light" pressed={on} onClick={() => setOn(!on)}><Power size={20} /></Action>}
    brightness={<Range label="Brightness" icon={Sun} value={brightness} min={1} set={v => { setBrightness(v); setOn(true); }} />}>
    {!compact && colorControls}<More label={compact ? "Color & effects" : "More controls"}>{compact && colorControls}<Choice label="Light effect" options={["None", "Candle", "Color loop"]} value={effect} set={setEffect} /><p>{t("Dimmable, tunable white and color lights share this card.")}</p></More>
  </LightCard>;
}

function ClimateDemo() {
  const superCompact = useContext(CardPresentation).variant === "Super compact";
  const { message: t } = useI18n();
  const [temp, setTemp] = useState(22), [mode, setMode] = useState("Heat"), [fan, setFan] = useState("Auto"), [preset, setPreset] = useState("Comfort"), [swing, setSwing] = useState(false);
  const modes = <Segments label="Climate mode" icons={{ Off: Power, Heat: Flame, Cool: Snowflake }} options={["Off", "Heat", "Cool", "Auto"]} value={mode} set={setMode} />;
  return <ClimateCard value={temp} unit="°" min={16} max={30} step={.5} caption={t(mode === "Off" ? "System off" : mode === "Cool" ? "Cooling · room 24°" : "Heating · room 20.5°")} set={setTemp}>
    {!superCompact && modes}<More>{superCompact && modes}<Choice label="Fan mode" options={["Auto", "Low", "Medium", "High"]} value={fan} set={setFan} /><Choice label="Preset" options={["Comfort", "Eco", "Away", "Sleep"]} value={preset} set={setPreset} /><Toggle label="Swing" on={swing} set={setSwing} /></More>
  </ClimateCard>;
}

function CoverDemo() {
  const { message: t } = useI18n();
  const [position, setPosition] = useState(65), [tilt, setTilt] = useState(0), [stopped, setStopped] = useState(false), [kind, setKind] = useState("Blinds");
  const set = (value: number) => { setPosition(value); setStopped(false); };
  return <CoverCard position={position} tilt={tilt}>
    <Range label="Open position" value={position} set={set} /><div className="dg-actions"><Action label="Close" compactIcon={ArrowDown} onClick={() => set(0)}><ArrowDown size={17} />{t("Close")}</Action><Action label={stopped ? "Stopped" : "Stop"} compactIcon={Square} pressed={stopped} onClick={() => setStopped(true)}><Square size={14} />{t(stopped ? "Stopped" : "Stop")}</Action><Action label="Open" compactIcon={ArrowUp} onClick={() => set(100)}><ArrowUp size={17} />{t("Open")}</Action></div>
    <More><Range label="Slat tilt" value={tilt} set={setTilt} /><Choice label="Cover type" options={["Blinds", "Curtains", "Garage door", "Awning"]} value={kind} set={setKind} /><p>{t("Garage doors and gates would ask for confirmation before moving.")}</p></More></CoverCard>;
}

function SwitchDemo() {
  const compact = useContext(CardPresentation).variant !== "Original";
  const { message: t } = useI18n();
  const [on, setOn] = useState(true), [restore, setRestore] = useState("Previous state");
  return <PowerCard on={on} power={<Action label="Toggle demo outlet" pressed={on} onClick={() => setOn(!on)}><Power size={46} strokeWidth={1.3} /></Action>} value={on ? 86 : 0} unit=" W" caption={on ? "On · drawing power" : "Off · no power draw"}>{!compact && <Toggle label="Outlet power" on={on} set={setOn} />}<More><div className="dg-facts"><span>{t("Today")}<b>0.42 kWh</b></span><span>{t("Voltage")}<b>230 V</b></span></div><Choice label="After power loss" options={["Previous state", "Always off", "Always on"]} value={restore} set={setRestore} /></More></PowerCard>;
}

function FanDemo() {
  const superCompact = useContext(CardPresentation).variant === "Super compact";
  const { message: t } = useI18n();
  const [speed, setSpeed] = useState(40), [on, setOn] = useState(true), [oscillate, setOscillate] = useState(true), [direction, setDirection] = useState("Forward"), [preset, setPreset] = useState("Normal");
  const oscillation = <Toggle label="Oscillate" on={oscillate} set={setOscillate} />;
  return <FanCard on={on} speed={speed}><Toggle label="Fan power" on={on} set={setOn} /><Range label="Fan speed" icon={Wind} value={speed} min={1} set={v => { setSpeed(v); setOn(true); }} />{!superCompact && oscillation}<More>{superCompact && oscillation}<Choice label="Direction" options={["Forward", "Reverse"]} value={direction} set={setDirection} /><Choice label="Fan preset" options={["Normal", "Natural breeze", "Sleep"]} value={preset} set={setPreset} /><p>{t(oscillate ? "Air sweeps across the room." : "Air flows in one direction.")}</p></More></FanCard>;
}

function HumidityDemo() {
  const [on, setOn] = useState(true), [humidity, setHumidity] = useState(50), [mode, setMode] = useState("Auto");
  return <HumidityCard value={on ? 42 : "Off"} unit={on ? "%" : ""} caption="Current humidity"><Range label="Target humidity" value={humidity} min={30} max={80} set={setHumidity} /><Toggle label="Humidifier power" on={on} set={setOn} /><More><Choice label="Humidity mode" options={["Auto", "Humidify", "Dehumidify", "Sleep"]} value={mode} set={setMode} /></More></HumidityCard>;
}

function WaterHeaterDemo() {
  const superCompact = useContext(CardPresentation).variant === "Super compact";
  const { message: t } = useI18n();
  const [temp, setTemp] = useState(60), [mode, setMode] = useState("Eco"), [away, setAway] = useState(false);
  const modes = <Segments label="Water heater mode" options={["Off", "Eco", "Performance"]} value={mode} set={setMode} />;
  return <WaterHeaterCard value={temp} unit="°" level={(temp - 40) / 40 * 100} caption={superCompact ? t("Hot water target · {mode}", { mode: t(mode) }) : "Hot water target"}><Range label="Water temperature" value={temp} min={40} max={80} unit="°C" set={setTemp} />{!superCompact && modes}<More>{superCompact && modes}<Toggle label="Away mode" on={away} set={setAway} /></More></WaterHeaterCard>;
}

function LockDemo() {
  const { message: t } = useI18n();
  const [locked, setLocked] = useState(true), [auto, setAuto] = useState(true);
  return <SecurityCard icon={locked ? Lock : Unlock} secure={locked} value={locked ? "Locked" : "Unlocked"} caption="Example front door"><SafeAction label={locked ? "Unlock demo door" : "Lock demo door"} onConfirm={() => setLocked(!locked)} /><More><Toggle label="Auto-lock" on={auto} set={setAuto} /><p>{t("Door closed · battery 86%")}</p></More></SecurityCard>;
}

function AlarmDemo() {
  const { message: t } = useI18n();
  const [mode, setMode] = useState("Disarmed"), [next, setNext] = useState("Home");
  return <SecurityCard icon={ShieldCheck} secure value={mode} caption="All demo sensors are clear"><Segments label="Arm mode" options={["Home", "Away", "Night"]} value={next} set={setNext} /><SafeAction label={mode === "Disarmed" ? "Arm demo alarm" : "Disarm demo alarm"} onConfirm={() => setMode(mode === "Disarmed" ? next : "Disarmed")} /><More><p>{t("Entry delay: 30 seconds. A real alarm may require a PIN.")}</p><div className="dg-facts"><span>{t("Doors")}<b>4 / 4</b></span><span>{t("Windows")}<b>6 / 6</b></span></div></More></SecurityCard>;
}

function SirenDemo() {
  const superCompact = useContext(CardPresentation).variant === "Super compact";
  const [on, setOn] = useState(false), [volume, setVolume] = useState(60), [tone, setTone] = useState("Chime");
  const soundControls = <><Choice label="Tone" options={["Chime", "Alarm", "Warning"]} value={tone} set={setTone} /><Range label="Siren volume" icon={Volume2} value={volume} set={setVolume} /></>;
  return <SecurityCard icon={Siren} value={on ? "Sounding" : "Silent"} caption="Silent visual simulation">{superCompact ? <More>{soundControls}</More> : soundControls}<SafeAction label={on ? "Stop demo siren" : "Test demo siren"} onConfirm={() => setOn(!on)} /></SecurityCard>;
}

function ValveDemo() {
  const { message: t } = useI18n();
  const [position, setPosition] = useState(0), [stopped, setStopped] = useState(false);
  return <ValveCard position={position} value={position === 0 ? "Closed" : "Open"} caption={stopped ? "Movement stopped" : "Example water supply"}><Range label="Valve opening" value={position} set={v => { setPosition(v); setStopped(false); }} /><div className="dg-actions"><Action onClick={() => { setPosition(0); setStopped(false); }}>{t("Close")}</Action><Action onClick={() => setStopped(true)}>{t("Stop")}</Action><SafeAction label="Open valve" onConfirm={() => { setPosition(100); setStopped(false); }} /></div></ValveCard>;
}

function MediaDemo() {
  const { message: t } = useI18n();
  const [playing, setPlaying] = useState(true), [track, setTrack] = useState(0), [volume, setVolume] = useState(35), [muted, setMuted] = useState(false), [source, setSource] = useState("Demo library"), [shuffle, setShuffle] = useState(false), [repeat, setRepeat] = useState("Off"), [seek, setSeek] = useState(74);
  const tracks = ["Soft focus", "A slower morning", "Blue hour"];
  return <MediaCard title={t(tracks[track])} subtitle={t("Afterglow sessions")} caption={t("Fictional track · no audio")} playing={playing}
    previous={() => { setTrack((track + 2) % 3); setSeek(0); }} playPause={() => setPlaying(!playing)} next={() => { setTrack((track + 1) % 3); setSeek(0); }}
    seek={<Range label="Playback position" value={seek} max={240} unit=" s" set={setSeek} />}
    volume={<Range label="Volume" icon={Volume2} value={volume} set={setVolume} />}
    more={<><Toggle label="Mute" on={muted} set={setMuted} /><Choice label="Media source" options={["Demo library", "Radio", "HDMI"]} value={source} set={setSource} /><Toggle label="Shuffle" on={shuffle} set={setShuffle} /><Choice label="Repeat" options={["Off", "One", "All"]} value={repeat} set={setRepeat} /></>} />;
}

function RemoteDemo() {
  const { message: t } = useI18n();
  const [last, setLast] = useState("Ready"), [source, setSource] = useState("TV"), [signal, setSignal] = useState("Remote");
  return <><Choice label="Activity" options={["TV", "Music", "Game console"]} value={source} set={setSource} /><div className="dg-dpad">{[{ label: "Up", icon: ArrowUp }, { label: "Left", icon: ChevronLeft }, { label: "Select", icon: Check }, { label: "Right", icon: ChevronRight }, { label: "Down", icon: ArrowDown }].map(({ label, icon: Icon }) => <Action key={label} label={label} onClick={() => setLast(label)}><Icon /></Action>)}</div><p className="dg-feedback" role="status">{t("Last demo command")}: {t(last)}</p><More><Choice label="Signal type" options={["Remote", "Infrared", "Radio frequency"]} value={signal} set={setSignal} /><Action onClick={() => setLast("Signal learned")}>{t("Learn demo signal")}</Action></More></>;
}

function CameraDemo() {
  const { message: t } = useI18n();
  const [privacy, setPrivacy] = useState(false), [motion, setMotion] = useState(true), [snapshot, setSnapshot] = useState(false);
  return <><div className="dg-camera"><Camera size={56} strokeWidth={1} /><span>{t(privacy ? "Privacy mode" : "Fictional camera preview")}</span><small>{t("No camera stream is loaded")}</small>{!privacy && <div className="dg-camera-reticle" />}</div><Toggle label="Privacy mode" on={privacy} set={setPrivacy} /><Toggle label="Motion detection" on={motion} set={setMotion} /><Action disabled={privacy} onClick={() => setSnapshot(!snapshot)}>{t(snapshot ? "Clear demo snapshot" : "Take demo snapshot")}</Action>{snapshot && <p role="status">{t("Demo snapshot captured. No image was saved.")}</p>}</>;
}

function ImageDemo() {
  const { message: t } = useI18n();
  const [floor, setFloor] = useState("Ground floor");
  return <><div className="dg-floorplan" data-floor={floor}><span>{t("Living")}</span><span>{t("Kitchen")}</span><span>{t("Hall")}</span></div><Segments label="Example image" options={["Ground floor", "Upper floor"]} value={floor} set={setFloor} /><p>{t("A fictional floor plan. Image entities display snapshots without playback controls.")}</p></>;
}

function RobotDemo({ mower = false }: { mower?: boolean } = {}) {
  const superCompact = useContext(CardPresentation).variant === "Super compact";
  const { message: t } = useI18n();
  const [status, setStatus] = useState("Docked"), [room, setRoom] = useState(mower ? "Front lawn" : "Every room"), [mode, setMode] = useState("Balanced");
  const map = <div className={`dg-robot-map ${mower ? "dg-lawn" : ""}`}><div className="dg-cleaned" /><div className="dg-robot-path" /><div className="dg-robot" data-active={status === "Cleaning" || status === "Mowing"}>{mower ? <Leaf size={22} /> : <Vacuum size={22} />}</div><span>{t("Illustrative map")}</span></div>;
  const areaControl = <Choice label={mower ? "Mowing area" : "Cleaning area"} options={mower ? ["Front lawn", "Back lawn", "Every area"] : ["Every room", "Living room", "Kitchen"]} value={room} set={setRoom} />;
  return <RobotCard status={t(status)} battery={84} map={map} context={superCompact ? <p className="dg-quick-context">{t(room)}</p> : areaControl}
    actions={<div className="dg-actions"><Action primary label={status === "Cleaning" || status === "Mowing" ? "Pause" : "Start"} compactIcon={status === "Cleaning" || status === "Mowing" ? Pause : Play} onClick={() => setStatus(status === "Cleaning" || status === "Mowing" ? "Paused" : mower ? "Mowing" : "Cleaning")}>{status === "Cleaning" || status === "Mowing" ? <Pause size={16} /> : <Play size={16} />}{t(status === "Cleaning" || status === "Mowing" ? "Pause" : "Start")}</Action><Action label="Return to dock" compactIcon={House} onClick={() => setStatus("Docked")}>{t("Return to dock")}</Action></div>} more={<>{superCompact && areaControl}<Choice label={mower ? "Cutting mode" : "Suction"} options={["Quiet", "Balanced", "Turbo"]} value={mode} set={setMode} /><Action label="Locate device" compactIcon={LocateFixed} onClick={() => setStatus("Located")}>{t("Locate device")}</Action><p>{t(mower ? "Demo lawn · 120 m²" : "Last clean · 32 m² in 28 minutes")}</p></>} />;
}

function SensorDemo({ air = false }: { air?: boolean } = {}) {
  const superCompact = useContext(CardPresentation).variant === "Super compact";
  const { message: t } = useI18n();
  const [metric, setMetric] = useState(air ? "CO₂" : "Temperature"), [period, setPeriod] = useState("24 h");
  const values: Record<string, [number, string]> = { Temperature: [21.4, "°C"], Humidity: [42, "%"], Power: [86, " W"], Energy: [3.2, " kWh"], Battery: [84, "%"], "CO₂": [620, " ppm"], "PM2.5": [4, " µg/m³"], VOC: [72, " ppb"] };
  const [value, unit] = values[metric];
  const reading = <Choice label="Reading" options={air ? ["CO₂", "PM2.5", "VOC"] : ["Temperature", "Humidity", "Power", "Energy", "Battery"]} value={metric} set={setMetric} />;
  const history = <><div className="dg-history" role="img" aria-label={t("Illustrative history, not live measurements")}>{(period === "24 h" ? [32, 40, 37, 52, 48, 64, 60, 52, 68, 80, 72, 66] : [45, 38, 65, 55, 70, 63, 42, 50, 72, 58, 78, 66]).map((height, i) => <i key={i} style={{ height: `${height}%` }} />)}</div><Segments label="History period" options={["24 h", "7 d"]} value={period} set={setPeriod} /></>;
  return <>{!superCompact && reading}<Readout value={value} unit={unit} caption={superCompact ? metric : air ? "Air quality · good" : "Latest demo reading"} />{!superCompact && history}<More label="Reading details">{superCompact && <>{reading}{history}</>}<p>{t("Read-only entity. Units and history depend on the sensor.")}</p></More></>;
}

function BinaryDemo() {
  const { message: t } = useI18n();
  const [kind, setKind] = useState("Door"), [active, setActive] = useState(false);
  const states: Record<string, string[]> = { Door: ["Closed", "Open"], Motion: ["Clear", "Detected"], Leak: ["Dry", "Leak detected"], Smoke: ["Clear", "Smoke detected"], Occupancy: ["Empty", "Occupied"] };
  return <><Choice label="Sensor type" options={Object.keys(states)} value={kind} set={setKind} /><div className={`dg-security-emblem ${active ? "is-alert" : "is-secure"}`}><Activity size={64} strokeWidth={1.1} /></div><Readout value={states[kind][Number(active)]} caption="Read-only binary sensor" /><Action onClick={() => setActive(!active)}>{t("Simulate sensor change")}</Action></>;
}

function WeatherDemo() {
  const superCompact = useContext(CardPresentation).variant === "Super compact";
  const { message: t } = useI18n();
  const [period, setPeriod] = useState("Hourly");
  const forecast = <><Segments label="Forecast" options={["Hourly", "Daily"]} value={period} set={setPeriod} /><div className="dg-forecast">{(period === "Hourly" ? ["12:00", "15:00", "18:00", "21:00"] : ["Mon", "Tue", "Wed", "Thu"]).map((label, i) => <div key={label}><span>{t(label)}</span><CloudSun size={23} /><strong>{18 - i}°</strong></div>)}</div></>;
  return <><div className="dg-weather"><CloudSun size={84} strokeWidth={1.2} /><Readout value={18} unit="°" caption="Partly cloudy" /></div><div className="dg-facts"><span><Wind size={16} /> 3 m/s</span><span><Droplets size={16} /> 48%</span></div>{superCompact ? <More label="Forecast">{forecast}</More> : forecast}<p>{t("Fictional forecast · no location used")}</p></>;
}

function EventDemo() {
  const { message: t } = useI18n();
  const [events, setEvents] = useState(["Single press"]);
  return <><div className="dg-event-list">{events.map((event, i) => <div key={`${event}-${i}`}><span className="dg-event-dot" /><strong>{t(event)}</strong><small>{t(i === 0 ? "Latest" : "Earlier")}</small></div>)}</div><Segments label="Simulate button event" options={["Single press", "Double press", "Long press"]} value={events[0]} set={event => setEvents([event, ...events].slice(0, 3))} /><p>{t("Event entities report an action; they do not stay on or off.")}</p></>;
}

function PresenceDemo() {
  const superCompact = useContext(CardPresentation).variant === "Super compact";
  const { message: t } = useI18n();
  const [location, setLocation] = useState("Home");
  const locationControl = <Segments label="Simulate location" options={["Home", "Away", "Unknown"]} value={location} set={setLocation} />;
  return <><div className="dg-presence"><MapPin size={55} strokeWidth={1.1} /><i /><i /></div><Readout value={location} caption="Fictional tracker · no real location" />{!superCompact && locationControl}<More label="Location details">{superCompact && locationControl}<p>{t("People, trackers, zones and geolocation share location context. Uncertain locations stay explicit.")}</p></More></>;
}

function SceneDemo() {
  const { message: t } = useI18n();
  const [scene, setScene] = useState("Unwind"), [active, setActive] = useState(false);
  return <><div className="dg-scene-orbs" data-scene={scene} aria-hidden="true"><i /><i /><i /></div><Segments label="Demo scene" options={["Unwind", "Focus", "Good night"]} value={scene} set={v => { setScene(v); setActive(false); }} /><p>{t(scene === "Unwind" ? "Warm lights · quiet music · blinds half open" : scene === "Focus" ? "Cool light · brighter desk · music paused" : "Lights off · doors locked · quiet home")}</p><Action primary onClick={() => setActive(true)}><Sparkles size={17} />{t(active ? "Scene applied" : "Apply demo scene")}</Action><More><p>{t("Scene and script actions are momentary. Scripts may also expose fields and a running state.")}</p></More></>;
}

function AutomationDemo() {
  const { message: t } = useI18n();
  const [enabled, setEnabled] = useState(true), [runs, setRuns] = useState(0);
  return <><div className="dg-flow"><span><CloudSun />{t("At sunset")}</span><ChevronDown size={18} /><span><Lightbulb />{t("Bring the lights up")}</span></div><Toggle label="Automation enabled" on={enabled} set={setEnabled} /><Action disabled={!enabled} onClick={() => setRuns(runs + 1)}><Play size={16} />{t("Run demo actions")}</Action><p role="status">{t("Demo runs")}: {runs}</p></>;
}

function ScriptDemo() {
  const { message: t } = useI18n();
  const [running, setRunning] = useState(false), [room, setRoom] = useState("Living room");
  return <><div className="dg-flow"><span><Wand2 />{t("Prepare a room")}</span><ChevronDown size={18} /><span><Lightbulb />{t("Lights, blinds and comfort")}</span></div><Choice label="Room" options={["Living room", "Kitchen"]} value={room} set={setRoom} /><Readout value={running ? "Running" : "Ready"} caption="Example script with a room field" /><Action primary onClick={() => setRunning(!running)}>{running ? <Square size={16} /> : <Play size={16} />}{t(running ? "Stop demo script" : "Run demo script")}</Action></>;
}

function TimerDemo() {
  const superCompact = useContext(CardPresentation).variant === "Super compact";
  const { message: t } = useI18n();
  const disabled = useContext(DemoDisabled);
  const [seconds, setSeconds] = useState(300), [running, setRunning] = useState(false), [duration, setDuration] = useState("5 min");
  useEffect(() => {
    if (!running || !seconds || disabled) return;
    const id = window.setInterval(() => setSeconds(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [running, disabled, seconds]);
  const durationControl = <Segments label="Timer duration" options={["1 min", "5 min", "15 min"]} value={duration} set={v => { setDuration(v); setSeconds(parseInt(v) * 60); setRunning(false); }} />;
  return <><Readout value={`${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`} caption={seconds === 0 ? "Finished" : running ? "Counting down" : "Ready when you are"} />{!superCompact && durationControl}<div className="dg-actions"><Action primary label={running && seconds ? "Pause" : "Start"} compactIcon={running && seconds ? Pause : Play} disabled={seconds === 0} onClick={() => setRunning(!running)}>{running && seconds ? <Pause size={17} /> : <Play size={17} />}{t(running && seconds ? "Pause" : "Start")}</Action><Action label="Reset" compactIcon={RotateCcw} onClick={() => { setRunning(false); setSeconds(parseInt(duration) * 60); }}><RotateCcw size={16} />{t("Reset")}</Action></div><More>{superCompact && durationControl}<Action onClick={() => { setSeconds(0); setRunning(false); }}>{t("Finish timer")}</Action></More></>;
}

function HelperDemo({ kind }: { kind: "number" | "select" | "text" | "counter" | "button" | "datetime" }) {
  const { message: t } = useI18n();
  const disabled = useContext(DemoDisabled);
  const [value, setValue] = useState(3), [selection, setSelection] = useState("Comfort"), [text, setText] = useState(t("Welcome home")), [saved, setSaved] = useState(false), [date, setDate] = useState("2030-06-15"), [time, setTime] = useState("07:30");
  if (kind === "number") return <><Readout value={value} unit="°C" caption="Example temperature offset" /><Range label="Offset" value={value} min={-5} max={5} step={.5} unit="°C" set={setValue} /><p>{t("A numeric setting with a clear unit, step and safe range.")}</p></>;
  if (kind === "select") return <><Readout value={selection} caption="Selected household mode" /><Choice label="Household mode" options={["Comfort", "Eco", "Away", "Sleep"]} value={selection} set={setSelection} /><p>{t("Only the options reported by the entity would appear here.")}</p></>;
  if (kind === "counter") return <><Readout value={value} caption="Example cycle counter" /><div className="dg-stepper"><Action label="Decrease counter" disabled={value <= 0} onClick={() => setValue(value - 1)}><Minus /></Action><Action label="Reset" compactIcon={RotateCcw} onClick={() => setValue(0)}>{t("Reset")}</Action><Action label="Increase counter" onClick={() => setValue(value + 1)}><Plus /></Action></div></>;
  if (kind === "button") return <><div className="dg-power-disc"><Action label="Press demo button" onClick={() => setValue(value + 1)}><Zap size={48} strokeWidth={1.2} /></Action></div><Readout value={value - 3} caption="Demo button presses" /><p>{t("A momentary action, with clear feedback after each press.")}</p></>;
  return <form className="dg-form" onSubmit={e => { e.preventDefault(); setSaved(true); }}>{kind === "text" ? <label>{t("Display message")}<Input disabled={disabled} required maxLength={120} value={text} onChange={e => { setText(e.target.value); setSaved(false); }} /></label> : <><label>{t("Date")}<Input type="date" required disabled={disabled} value={date} onChange={e => { setDate(e.target.value); setSaved(false); }} /></label><label>{t("Time")}<Input type="time" required disabled={disabled} value={time} onChange={e => { setTime(e.target.value); setSaved(false); }} /></label></>}<Button type="submit" disabled={disabled}>{t(saved ? "Saved in demo" : "Save demo value")}</Button><p role="status">{t(saved ? "Stored for this visit only." : "Changes stay here until you save.")}</p></form>;
}

function CalendarDemo() {
  const { message: t } = useI18n();
  const [day, setDay] = useState(0);
  return <><div className="dg-calendar-date"><CalendarDays size={28} /><strong>{t(day === 0 ? "Today" : "Tomorrow")}</strong></div><div className="dg-agenda"><span>{day === 0 ? "16:00" : "10:00"}</span><div><strong>{t(day === 0 ? "Example activity" : "Example appointment")}</strong><p>{t("Fictional calendar")}</p></div></div><Segments label="Calendar day" options={["Today", "Tomorrow"]} value={day === 0 ? "Today" : "Tomorrow"} set={v => setDay(v === "Today" ? 0 : 1)} /><More label="Event details"><p>{t("Duration: 1 hour · no location or attendees")}</p></More></>;
}

function TodoDemo() {
  const { message: t } = useI18n();
  const disabled = useContext(DemoDisabled);
  const [items, setItems] = useState([{ name: "Water the demo plant", done: false }, { name: "Replace the demo filter", done: true }]), [draft, setDraft] = useState("");
  return <><div className="dg-todos">{items.map((item, i) => <label key={i}><input type="checkbox" disabled={disabled} checked={item.done} onChange={() => setItems(items.map((entry, index) => index === i ? { ...entry, done: !entry.done } : entry))} /><span>{t(item.name)}</span></label>)}</div><form className="dg-add-item" onSubmit={e => { e.preventDefault(); if (draft.trim()) { setItems([...items, { name: draft.trim(), done: false }]); setDraft(""); } }}><Input disabled={disabled} aria-label={t("New demo task")} placeholder={t("Add a task…")} value={draft} maxLength={80} onChange={e => setDraft(e.target.value)} /><Button type="submit" disabled={disabled || !draft.trim()} aria-label={t("Add demo task")}><Plus size={18} /></Button></form></>;
}

function UpdateDemo() {
  const { message: t } = useI18n();
  const [installed, setInstalled] = useState(false), [skipped, setSkipped] = useState(false);
  return <><div className="dg-update"><Upload size={42} /><span>1.2 <ChevronRight size={20} /> <strong>1.3</strong></span></div><Readout value={installed ? "Up to date" : skipped ? "Skipped" : "Update available"} caption="Fictional firmware" /><More label="Release notes"><p>{t("Example release: faster startup and improved connectivity.")}</p></More><div className="dg-actions">{!installed && <SafeAction label="Install demo update" onConfirm={() => setInstalled(true)} />}<Action onClick={() => { setSkipped(!skipped); setInstalled(false); }}>{t(skipped ? "Show update" : "Skip version")}</Action></div></>;
}

function VoiceDemo() {
  const { message: t } = useI18n();
  const [muted, setMuted] = useState(false), [phase, setPhase] = useState("Ready"), [engine, setEngine] = useState("Assist satellite");
  return <><div className="dg-voice"><AudioLines size={96} strokeWidth={1.1} /></div><Readout value={muted ? "Muted" : phase} caption="Visual demo · microphone is never accessed" /><Action disabled={muted} primary onClick={() => setPhase(phase === "Listening" ? "Demo response ready" : "Listening")}><Mic size={17} />{t(phase === "Listening" ? "Finish demo request" : "Try demo conversation")}</Action><More><Toggle label="Microphone muted" on={muted} set={setMuted} /><Choice label="Voice entity" options={["Assist satellite", "Conversation", "Speech to text", "Text to speech", "Wake word"]} value={engine} set={v => { setEngine(v); setPhase("Ready"); }} /></More></>;
}

function MessageDemo({ ai = false }: { ai?: boolean } = {}) {
  const { message: t } = useI18n();
  const disabled = useContext(DemoDisabled);
  const [draft, setDraft] = useState(t(ai ? "Summarize the demo home" : "The demo laundry is ready")), [result, setResult] = useState(false);
  return <><form className="dg-form" onSubmit={e => { e.preventDefault(); setResult(true); }}><label>{t(ai ? "Demo prompt" : "Demo notification")}<textarea disabled={disabled} required maxLength={240} value={draft} onChange={e => { setDraft(e.target.value); setResult(false); }} /></label><Button disabled={disabled} type="submit">{ai ? <Wand2 size={17} /> : <Send size={17} />}{t(ai ? "Preview demo result" : "Preview notification")}</Button></form>{result && <p className="dg-message-result" role="status">{ai ? t("Example response: the demo home is comfortable, the doors are locked and the air is clear.") : draft}</p>}<p>{t(ai ? "Canned example only. No AI service is called." : "Preview only. Nothing is sent to anyone.")}</p></>;
}

const demoContents: Record<string, () => ReactNode> = {
  light: LightDemo,
  climate: ClimateDemo,
  cover: CoverDemo,
  media_player: MediaDemo,
  lock: LockDemo,
  vacuum: RobotDemo,
  switch: SwitchDemo,
  fan: FanDemo,
  humidifier: HumidityDemo,
  water_heater: WaterHeaterDemo,
  alarm_control_panel: AlarmDemo,
  siren: SirenDemo,
  valve: ValveDemo,
  camera: CameraDemo,
  remote: RemoteDemo,
  image: ImageDemo,
  lawn_mower: () => <RobotDemo mower />,
  sensor: SensorDemo,
  air_quality: () => <SensorDemo air />,
  binary_sensor: BinaryDemo,
  weather: WeatherDemo,
  event: EventDemo,
  presence: PresenceDemo,
  scene: SceneDemo,
  script: ScriptDemo,
  automation: AutomationDemo,
  timer: TimerDemo,
  counter: () => <HelperDemo kind="counter" />,
  number: () => <HelperDemo kind="number" />,
  select: () => <HelperDemo kind="select" />,
  text: () => <HelperDemo kind="text" />,
  datetime: () => <HelperDemo kind="datetime" />,
  button: () => <HelperDemo kind="button" />,
  calendar: CalendarDemo,
  todo: TodoDemo,
  update: UpdateDemo,
  voice: VoiceDemo,
  ai_task: () => <MessageDemo ai />,
  notify: MessageDemo,
};
const examples: Example[] = cardDesigns.map(design => ({ ...design, content: demoContents[design.id] }));

function DemoCard({ example, variant, visible, status, retry }: { example: Example; variant: Variant; visible: boolean; status: DemoStatus; retry: () => void }) {
  const compact = variant !== "Original";
  const { message: t } = useI18n();
  const Content = example.content;
  const disabled = status !== "Ready";
  return <CardFrame design={example} title={t(compact ? example.subtitle : example.title)} subtitle={!compact ? t(example.subtitle) : undefined} variant={variant} visible={visible} disabled={disabled} demo footer={!compact ? example.domains.join(" · ") : undefined}>
    <div className={`dg-card-body ${disabled ? "dg-disabled" : ""}`} aria-busy={status === "Waiting"}><Content /></div>
    {disabled && <div className="dg-state-message" role={status === "Command failed" ? "alert" : "status"}><strong>{t(status)}</strong><p>{t(status === "Unavailable" ? "Device unavailable. Controls keep their last known values." : status === "Waiting" ? "Waiting for the demo device to respond." : "The demo command failed. Your settings are unchanged.")}</p><Button variant="outline" onClick={retry}>{t(status === "Command failed" ? "Retry demo" : "Restore demo")}</Button></div>}
  </CardFrame>;
}

export default function DeviceGallery() {
  const { message: t } = useI18n();
  const [group, setGroup] = useState<Group>("All cards"), [search, setSearch] = useState(""), [status, setStatus] = useState<DemoStatus>("Ready"), [version, setVersion] = useState(0);
  const [view, setView] = useState<typeof views[number]>("Compare");
  const query = search.trim().toLocaleLowerCase();
  const visible = (example: Example) => (group === "All cards" || example.group === group) && [t(example.title), t(example.subtitle), ...example.domains].join(" ").toLocaleLowerCase().includes(query);
  const count = examples.filter(visible).length;
  return <TooltipProvider delayDuration={300}><div className="device-gallery planner-page">
    <Link className="dg-back" to="/settings#smart-home-visibility"><ArrowLeft size={17} />{t("Smart home settings")}</Link>
    <div className="dg-heading"><div><h1>{t("Device playground")}</h1><p>{t("Device cards, reimagined. Touch, adjust and explore.")}</p></div><Button variant="outline" onClick={() => { setVersion(v => v + 1); setStatus("Ready"); }}><RotateCcw size={17} /><span>{t("Reset demo")}</span></Button></div>
    <div className="dg-demo-note"><Sparkles size={18} aria-hidden="true" /><p>{t("Fictional devices. Real interactions. Nothing controls your home.")}</p></div>
    <div className="dg-comparison-toolbar"><div className="dg-view-picker" role="group" aria-label={t("Gallery view")}>{views.map(value => { const Icon = value === "Compare" ? Columns2 : LayoutGrid; return <button key={value} type="button" aria-pressed={view === value} onClick={() => setView(value)}><Icon size={17} aria-hidden="true" />{t(value)}</button>; })}</div><p>{t("Try all three. Each version keeps its own settings.")}</p></div>
    <div className="dg-toolbar"><label className="dg-search"><Search size={19} aria-hidden="true" /><Input type="search" aria-label={t("Search device card designs")} placeholder={t("Find a device or entity type…")} value={search} onChange={e => setSearch(e.target.value)} /></label><label className="dg-state-picker"><Settings2 size={17} aria-hidden="true" /><span>{t("Demo state")}</span><select value={status} onChange={e => setStatus(e.target.value as DemoStatus)}>{(["Ready", "Unavailable", "Waiting", "Command failed"] as const).map(value => <option key={value} value={value}>{t(value)}</option>)}</select></label></div>
    <div className="dg-filter-row"><div className="dg-filters" role="group" aria-label={t("Device families")}>{groups.map(value => <button key={value} aria-pressed={group === value} onClick={() => setGroup(value)}>{t(value)}</button>)}</div><span role="status">{t(count === 1 ? "{count} design" : "{count} designs", { count })}</span></div>
    <div className="dg-comparisons" data-view={view} key={version}>{examples.map(example => <section className="dg-pair" key={example.id} hidden={!visible(example)} aria-label={t("{name} comparison", { name: t(example.subtitle) })}>{variants.map(variant => <div className="dg-variant" key={variant} hidden={view !== "Compare" && view !== variant}><p className="dg-version-label">{t(variant)}</p><DemoCard example={example} variant={variant} visible={visible(example) && (view === "Compare" || view === variant)} status={status} retry={() => setStatus("Ready")} /></div>)}</section>)}</div>
    {!count && <div className="dg-empty"><Search size={30} /><h2>{t("No matching designs")}</h2><p>{t("Try a device type such as light, timer or camera.")}</p><Button variant="outline" onClick={() => { setSearch(""); setGroup("All cards"); }}>{t("Clear filters")}</Button></div>}
    <div className="dg-endnote"><CircleHelp size={19} /><p>{t("These reusable designs also power Smart home. Live cards only show controls supported by the device.")}</p></div>
  </div></TooltipProvider>;
}
