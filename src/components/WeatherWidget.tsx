import { useId } from "react";
import { Link } from "react-router-dom";
import { CloudOff, X } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useFamily } from "@/contexts/FamilyContext";
import { useI18n } from "@/hooks/use-i18n";
import { available, entityStateLabel, isTemperatureEntity, numberValue } from "@/lib/ha-model";
import { Button } from "@/components/ui/button";
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { WeatherCard } from "@/components/devices/WeatherCard";
import { WeatherIcon } from "@/components/devices/WeatherIcon";
import "@/components/devices/device-cards.css";

export function WeatherWidget({ placement }: { placement: "header" | "today" }) {
  const { currentHome, homeOnline } = useApp();
  const { weatherEntity, weatherTemperatureEntity, weatherPlacement } = useFamily();
  const { t, language, number } = useI18n();
  const titleId = useId();
  if (!weatherEntity || !weatherPlacement[placement]) return null;
  const entity = currentHome.entities.find(entity => entity.preferenceId === weatherEntity && entity.domain === "weather");
  const reported = homeOnline && entity && available(entity);
  const condition = reported ? entityStateLabel(entity, language) : t(homeOnline ? "Unavailable" : "Offline");
  const temperatureEntity = currentHome.entities.find(entity => entity.preferenceId === weatherTemperatureEntity && isTemperatureEntity(entity));
  const temperature = !homeOnline ? undefined : weatherTemperatureEntity
    ? temperatureEntity && available(temperatureEntity) && temperatureEntity.state.trim() ? numberValue(Number(temperatureEntity.state)) : undefined
    : reported ? numberValue(entity.attributes.temperature) : undefined;
  const reportedUnit = weatherTemperatureEntity ? temperatureEntity?.attributes.unit_of_measurement : entity?.attributes.temperature_unit;
  const unit = typeof reportedUnit === "string" ? reportedUnit : currentHome.temperatureUnit ?? "";
  const reading = temperature === undefined ? "—" : `${number(temperature)}${unit}`;
  return <Popover>
    <PopoverTrigger asChild><Button variant="ghost" className={`weather-widget ${placement === "header" ? "header-weather glass-surface" : "today-weather"}`} data-weather-condition={reported ? entity.state : "unavailable"} aria-label={t("Weather: {condition}. Open forecast", { condition: `${condition} · ${reading}` })} title={condition}>
      <span className="weather-symbol">{reported ? <WeatherIcon condition={entity.state} /> : <CloudOff aria-hidden="true" />}</span>
      <span className="weather-copy"><strong>{reported || temperature !== undefined ? reading : condition}</strong><span>{reported || temperature !== undefined ? condition : t("Weather")}</span></span>
    </Button></PopoverTrigger>
    <PopoverContent align="end" collisionPadding={12} className="weather-popover device-card-designs" aria-labelledby={titleId}>
      <div className="flex items-center justify-between gap-3">
        <h2 id={titleId} className="min-w-0 break-words text-base font-semibold">{entity?.name ?? t("Weather")}</h2>
        <PopoverClose asChild><Button variant="ghost" size="icon" className="shrink-0" aria-label={t("Close")}><X aria-hidden="true" /></Button></PopoverClose>
      </div>
      {entity ? <WeatherCard key={entity.preferenceId} entity={entity} currentTemperature={{ value: temperature, unit }} /> : <p role="status">{t("Weather entity unavailable. Choose another source in settings.")}</p>}
      {homeOnline && weatherTemperatureEntity && temperature === undefined && <p role="status">{t("Temperature entity unavailable. Choose another source in settings.")}</p>}
      <PopoverClose asChild><Link to="/settings/weather" className="text-link">{t("Weather settings")}</Link></PopoverClose>
    </PopoverContent>
  </Popover>;
}
