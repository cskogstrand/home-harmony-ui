import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Coins } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useFamily } from "@/contexts/FamilyContext";
import { useI18n } from "@/hooks/use-i18n";
import { available } from "@/lib/ha-model";
import { cheapestWindow, currentSlot, localDate, mergeSlots, nextDate, slotsOnDate, type PriceSlot } from "@/lib/electricity-price";
import { PanelHeading } from "./FamilyPlanner";

type Series = { today?: PriceSlot[] | null; tomorrow?: PriceSlot[]; failed?: boolean };
const hour = 3600000;

/** Today's (and tomorrow's, once published) prices from the sensor the owner chose in Settings. Display only. */
export function ElectricityPrice() {
  const { t, locale, reading } = useI18n();
  const { currentHome, homeOnline, priceSeries } = useApp();
  const { electricityPriceEntity = "", now: familyNow } = useFamily();
  const now = (familyNow ?? new Date()).getTime();
  const timeZone = currentHome.timeZone;
  const today = localDate(now, timeZone), tomorrow = nextDate(today);
  // Tomorrow's prices are published once a day; asking again each hour picks them up without polling hard.
  const hourKey = Math.floor(now / hour);
  const entity = currentHome.entities.find(item => item.preferenceId === electricityPriceEntity);
  const entityId = entity?.entityId;
  const [series, setSeries] = useState<Series>({});
  useEffect(() => {
    setSeries({});
    if (!entityId || !homeOnline) return;
    const controller = new AbortController();
    const done = () => controller.signal.aborted;
    void Promise.allSettled([priceSeries(entityId, today, controller.signal), priceSeries(entityId, tomorrow, controller.signal)]).then(([first, second]) => {
      if (done()) return;
      if (first.status === "rejected") { setSeries({ failed: true }); return; }
      setSeries({ today: first.value, tomorrow: second.status === "fulfilled" && second.value ? second.value : undefined });
    });
    return () => controller.abort();
  }, [entityId, homeOnline, today, tomorrow, hourKey, priceSeries]);

  const settingsLink = <Link className="text-link" to="/settings/electricity-price">{t("Choose a price sensor")}<ChevronRight size={17} aria-hidden="true" /></Link>;
  if (!electricityPriceEntity) return <section className="glow-panel electricity-price" aria-label={t("Electricity price")}>
    <PanelHeading icon={Coins} title={t("Electricity price")} />
    <p className="page-note mt-2">{t("Choose your electricity price sensor in Settings to see today’s prices and the cheapest time.")}</p>
    {settingsLink}
  </section>;
  if (!entity) return <section className="glow-panel electricity-price" aria-label={t("Electricity price")}>
    <PanelHeading icon={Coins} title={t("Electricity price")} />
    <p className="page-note mt-2">{t("The chosen price sensor is no longer in Home Assistant.")}</p>
    {settingsLink}
  </section>;

  const unit = String(entity.attributes.unit_of_measurement ?? "");
  const precision = entity.displayPrecision ?? 2;
  const price = (value: number) => reading(value, { unit, precision });
  const time = (value: number) => new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone }).format(new Date(value));
  const slots = mergeSlots(series.today ?? [], series.tomorrow ?? []);
  const current = currentSlot(slots, now);
  const reported = homeOnline && available(entity) && entity.state.trim() !== "" && Number.isFinite(Number(entity.state));
  const currentPrice = current?.price ?? (reported ? Number(entity.state) : undefined);
  const best = cheapestWindow(slots, now);
  const days = [{ date: today, label: t("Today") }, ...series.tomorrow ? [{ date: tomorrow, label: t("Tomorrow") }] : []]
    .map(day => ({ ...day, slots: slotsOnDate(slots, day.date, timeZone) })).filter(day => day.slots.length);
  const highest = Math.max(0, ...days.flatMap(day => day.slots.map(slot => slot.price)));
  const inWindow = (slot: PriceSlot) => !!best && slot.start >= best.start && slot.end <= best.end;
  return <section className="glow-panel electricity-price" aria-label={t("Electricity price")}>
    <PanelHeading icon={Coins} title={t("Electricity price")} />
    {!homeOnline ? <p className="empty-note">{t("Home Assistant is offline.")}</p> : <>
      <p className="electricity-price-now">
        <span>{t("Now")}</span>
        <strong className="sensor-reading">{currentPrice === undefined ? t("No reading") : price(currentPrice)}</strong>
      </p>
      {best && <p className="electricity-price-best">{best.start <= now
        ? t("Cheapest right now, until {end}", { end: time(best.end) })
        : t("Cheapest from {start} to {end}", { start: time(best.start), end: time(best.end) })} <small>{t("Average {price}", { price: price(best.average) })}</small></p>}
      {series.failed && <p className="page-note mt-2">{t("Today’s prices could not be read from Home Assistant.")}</p>}
      {series.today === null && <p className="page-note mt-2">{t("This sensor does not provide prices for the rest of the day. A Nord Pool price sensor does.")}</p>}
      {days.map(day => <figure key={day.date} className="price-day">
        <figcaption>{day.label}</figcaption>
        <div className="price-strip" aria-hidden="true">{day.slots.map(slot => <span key={slot.start} className="price-bar" data-now={slot === current || undefined} data-cheapest={inWindow(slot) || undefined}>
          <span style={{ blockSize: `${highest > 0 ? Math.max(2, Math.max(0, slot.price) / highest * 100) : 2}%` }} />
        </span>)}</div>
        <div className="price-axis" aria-hidden="true">{day.slots.flatMap((slot, index) => {
          // Mark 00, 06, 12 and 18 where they fall, so a daylight-saving day keeps its true spacing.
          const label = time(slot.start);
          return /^(00|06|12|18)[:.]00$/.test(label) ? [<span key={slot.start} style={{ insetInlineStart: `${index / day.slots.length * 100}%` }}>{label.slice(0, 2)}</span>] : [];
        })}</div>
        <details className="energy-more"><summary>{t("Show prices as a table")}</summary>
          <table className="price-table"><thead><tr><th scope="col">{t("Time")}</th><th scope="col">{t("Price")}</th></tr></thead>
            <tbody>{day.slots.map(slot => <tr key={slot.start} aria-current={slot === current ? "time" : undefined}>
              <th scope="row">{time(slot.start)}–{time(slot.end)}{slot === current && <span className="sr-only"> ({t("Now")})</span>}</th><td>{price(slot.price)}</td>
            </tr>)}</tbody></table>
        </details>
      </figure>)}
      {series.today && !series.tomorrow && <p className="page-note mt-2">{t("Tomorrow’s prices are usually published in the early afternoon.")}</p>}
    </>}
  </section>;
}
