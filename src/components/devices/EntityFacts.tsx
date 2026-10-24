import type { Entity } from "@/types/api";
import { useApp } from "@/contexts/AppContext";
import { useI18n } from "@/hooks/use-i18n";
import { available, humanizeState } from "@/lib/ha-model";

const facts: Record<string, readonly string[]> = {
  light: ["color_mode", "color_temp_kelvin", "effect"], climate: ["current_humidity", "hvac_action", "preset_mode"],
  cover: ["current_position", "current_tilt_position"], media_player: ["media_album_name", "app_name", "source", "sound_mode"],
  vacuum: ["fan_speed", "cleaned_area", "cleaning_time", "total_cleaned_area", "total_cleaning_time", "status"],
  lawn_mower: ["activity", "area", "total_mowing_time"], water_heater: ["current_temperature", "operation_mode", "away_mode"],
  fan: ["preset_mode", "direction", "oscillating"], humidifier: ["mode", "action"],
  weather: ["apparent_temperature", "dew_point", "pressure", "wind_gust_speed", "wind_bearing", "visibility", "cloud_coverage", "uv_index"],
  air_quality: ["particulate_matter_2_5", "particulate_matter_10", "carbon_dioxide", "carbon_monoxide", "nitrogen_dioxide", "ozone", "sulphur_dioxide", "volatile_organic_compounds"],
  event: ["event_type", "event_types"], device_tracker: ["source_type", "gps_accuracy"], geo_location: ["source", "unit_of_measurement"],
  automation: ["last_triggered", "mode", "current"], script: ["last_triggered", "mode", "current", "max"],
  timer: ["duration", "finishes_at"], counter: ["initial", "step", "minimum", "maximum"],
  number: ["min", "max", "step"], input_number: ["min", "max", "step"],
  text: ["min", "max", "mode"], input_text: ["min", "max", "mode"],
  remote: ["current_activity"], camera: ["motion_detection", "frontend_stream_type"],
  update: ["installed_version", "latest_version", "skipped_version", "in_progress", "release_summary"],
  assist_satellite: ["available_wake_words", "active_wake_words"], conversation: ["supported_languages"],
};
const units: Record<string, string> = { battery_level: "%", current_humidity: "%", cloud_coverage: "%", current_position: "%", current_tilt_position: "%", color_temp_kelvin: "K", gps_accuracy: "m" };

export function EntityFacts({ entity }: { entity: Entity }) {
  const { homeOnline, currentHome } = useApp();
  const { message: t, locale, number } = useI18n();
  if (!homeOnline || !available(entity)) return null;
  const a = entity.attributes;
  const keys = [...new Set([...(facts[entity.domain] ?? []), ...(!["vacuum", "lawn_mower"].includes(entity.domain) ? ["battery_level"] : [])])];
  const rows = keys.flatMap(key => {
    const value = a[key];
    const text = typeof value === "boolean" ? t(value ? "Yes" : "No") : typeof value === "number" && Number.isFinite(value) ? number(value) : typeof value === "string" ? value : Array.isArray(value) && value.every(v => typeof v === "string") ? value.join(", ") : "";
    if (!text) return [];
    let unit = units[key] ?? "";
    if (["current_temperature", "apparent_temperature", "dew_point"].includes(key)) unit = String(a.temperature_unit ?? currentHome.temperatureUnit ?? "");
    if (key === "pressure") unit = String(a.pressure_unit ?? "");
    if (key === "visibility") unit = String(a.visibility_unit ?? "");
    if (key === "wind_gust_speed") unit = String(a.wind_speed_unit ?? "");
    const date = ["last_triggered", "finishes_at"].includes(key) && typeof value === "string" && Number.isFinite(Date.parse(value));
    return [{ label: t(humanizeState(key)), value: date ? new Intl.DateTimeFormat(locale, { timeZone: currentHome.timeZone, dateStyle: "medium", timeStyle: "short" }).format(new Date(text)) : `${t(text)}${unit ? ` ${unit}` : ""}` }];
  });
  if (entity.lastUpdated && Number.isFinite(Date.parse(entity.lastUpdated))) rows.push({ label: t("Last updated"), value: new Intl.DateTimeFormat(locale, { timeZone: currentHome.timeZone, dateStyle: "medium", timeStyle: "short" }).format(new Date(entity.lastUpdated)) });
  if (!rows.length) return null;
  return <details className="smart-reading-details"><summary>{t("Details")}</summary><dl className="smart-card-facts">{rows.map(row => <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl></details>;
}
