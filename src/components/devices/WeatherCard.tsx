import { useEffect, useState } from "react";
import { Droplets, Wind } from "lucide-react";
import type { Entity } from "@/types/api";
import { useApp } from "@/contexts/AppContext";
import { useI18n } from "@/hooks/use-i18n";
import { available, entityStateLabel, feature, numberValue } from "@/lib/ha-model";
import type { Forecast } from "@/lib/home-assistant";
import { Button } from "@/components/ui/button";
import { Readout } from "./CardControls";
import { WeatherIcon } from "./WeatherIcon";

export function WeatherCard({ entity, currentTemperature }: { entity: Entity; currentTemperature?: { value: number | undefined; unit: string } }) {
  const { homeOnline, currentHome, watchForecast } = useApp();
  const { message: t, language, locale, number } = useI18n();
  const [period, setPeriod] = useState<"hourly" | "daily" | "twice_daily">("hourly");
  const [forecast, setForecast] = useState<Forecast | null>(), [retry, setRetry] = useState(0);
  const types = (["hourly", "daily", "twice_daily"] as const).filter(type => feature(entity, { daily: 1, hourly: 2, twice_daily: 4 }[type]));
  const type = types.includes(period) ? period : types[0];
  const reported = homeOnline && available(entity);
  useEffect(() => {
    setForecast(undefined);
    if (!reported || !type) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => setForecast(null), 15000);
    watchForecast(entity.entityId, type, controller.signal, data => { clearTimeout(timeout); if (!controller.signal.aborted) setForecast(data); });
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [entity.entityId, reported, type, retry, watchForecast]);
  const a = entity.attributes;
  const temperature = currentTemperature ? currentTemperature.value : numberValue(a.temperature), wind = numberValue(a.wind_speed), humidity = numberValue(a.humidity);
  const unit = typeof a.temperature_unit === "string" ? a.temperature_unit : currentHome.temperatureUnit ?? "";
  const showTemperature = homeOnline && temperature !== undefined && (reported || !!currentTemperature);
  return <div className="dg-card-body smart-weather">
    <div className="dg-weather"><WeatherIcon condition={entity.state} size={48} /><Readout value={showTemperature ? temperature : reported ? "—" : t(homeOnline ? "Unavailable" : "Offline")} unit={showTemperature ? currentTemperature?.unit ?? unit : ""} caption={reported ? entityStateLabel(entity, language) : ""} /></div>
    {reported && <><div className="dg-facts">{wind !== undefined && <span><Wind size={16} aria-hidden="true" />{number(wind)} {String(a.wind_speed_unit ?? "")}<span className="sr-only">{t("Wind speed")}</span></span>}{humidity !== undefined && <span><Droplets size={16} aria-hidden="true" />{number(humidity)}%<span className="sr-only">{t("Humidity")}</span></span>}</div>
      {!!types.length && <div className="smart-forecast">
        <label className="dg-choice"><span>{t("Forecast")}</span><select value={type} onChange={event => setPeriod(event.target.value as typeof period)}>{types.map(type => <option value={type} key={type}>{t(type === "hourly" ? "Hourly" : type === "daily" ? "Daily" : "Twice daily")}</option>)}</select></label>
        {forecast?.length ? <div className="dg-forecast">{forecast.slice(0, 4).map((item, index) => <div key={`${item.datetime}-${index}`}>
          <time dateTime={item.datetime}>{new Intl.DateTimeFormat(locale, { timeZone: currentHome.timeZone, ...(type === "hourly" ? { hour: "2-digit", minute: "2-digit" } as const : { weekday: "short", ...(type === "twice_daily" ? { hour: "2-digit" } as const : {}) }) }).format(new Date(item.datetime))}</time>
          <span>{entityStateLabel({ ...entity, state: item.condition ?? "unknown" }, language)}</span><strong>{item.temperature == null ? "—" : number(item.temperature)}{item.temperature == null ? "" : unit}</strong>
          {item.templow != null && <small>{t("Low")} {number(item.templow)}{unit}</small>}{item.precipitation_probability != null && <small>{number(item.precipitation_probability)}% {t("Rain")}</small>}
        </div>)}</div> : <p role="status">{t(forecast === undefined ? "Loading forecast…" : "Forecast unavailable")}</p>}
        {forecast === null && <Button variant="outline" onClick={() => setRetry(value => value + 1)}>{t("Retry")}</Button>}
      </div>}
    </>}
  </div>;
}
