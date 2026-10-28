import { PanelTitle } from "@/components/PanelTitle";
import { useEffect, useState } from "react";
import { Apple, Check, Cylinder, Leaf, Milk, Newspaper, PlugZap, RefreshCw, Shirt, Trash2, TriangleAlert, Wine, type LucideIcon } from "lucide-react";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { useApp } from "@/contexts/AppContext";
import { addDays, useFamily } from "@/contexts/FamilyContext";
import { useI18n } from "@/hooks/use-i18n";
import { available, calendarBoundary, calendarTimeInput } from "@/lib/ha-model";
import type { CalendarEvent } from "@/types/api";
import { Button } from "@/components/ui/button";
import "./waste-collection.css";

const wasteIconRules: [RegExp, LucideIcon][] = [
  [/\b(mat(?:[\s-]*(?:avfall|rester))?|bio(?:[\s-]*avfall)?|v[åa]t[\s-]*organisk|food(?:[\s-]*waste)?|organic(?:[\s-]*waste)?)\b/iu, Apple],
  [/\b(rest(?:[\s-]*avfall)?|brennbart|residual(?:[\s-]*waste)?|(?:general|mixed)[\s-]*waste)\b/iu, Trash2],
  [/\b(papir(?:[\s-]*(?:avfall|emballasje))?|papp(?:[\s-]*avfall)?|(?:drikke[\s-]*)?kartong|paper|cardboard|cartons?)\b/iu, Newspaper],
  [/\b(plast(?:ikk|ic)?(?:[\s-]*(?:emballasje|avfall|packaging))?)\b/iu, Milk],
  [/\b(glass?(?:[\s-]*(?:emballasje|avfall|packaging))?)\b/iu, Wine],
  [/\b(metall?(?:[\s-]*(?:emballasje|avfall|packaging))?|hermetikk|cans?|tins?)\b/iu, Cylinder],
  [/\b(hage(?:[\s-]*avfall)?|garden(?:[\s-]*waste)?|yard[\s-]*waste)\b/iu, Leaf],
  [/\b(farlig(?:[\s-]*avfall)?|spesial[\s-]*avfall|hazardous(?:[\s-]*waste)?)\b/iu, TriangleAlert],
  [/\b(ee[\s-]*avfall|elektronikk|elektrisk(?:[\s-]*avfall)?|electronics?|e[\s-]*waste)\b/iu, PlugZap],
  [/\b(tekstil(?:er)?|klær|toey|tøy|textiles?|clothes|clothing)\b/iu, Shirt],
];

export function WasteCollection() {
  const { t, dateLabel } = useI18n();
  const { today, time, wasteCalendarEntity, wasteCollectionDays } = useFamily();
  const { currentHome, homeOnline, haUrl, watchCalendarEvents } = useApp();
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState<{ key: string; events: CalendarEvent[] | null }>();
  const calendar = currentHome.entities.find(entity => entity.domain === "calendar" && entity.preferenceId === wasteCalendarEntity);
  const entityId = calendar?.entityId;
  const ready = homeOnline && !!calendar && available(calendar);
  const from = calendarBoundary(today, currentHome.timeZone);
  const end = addDays(today, wasteCollectionDays + 1);
  const to = calendarBoundary(end, currentHome.timeZone);
  const key = JSON.stringify([haUrl, entityId, from, to, refresh]);
  useEffect(() => {
    setResult(undefined);
    if (!ready) return;
    const controller = new AbortController();
    watchCalendarEvents(entityId, from, to, controller.signal, events => {
      if (!controller.signal.aborted) setResult({ key, events });
    });
    return () => controller.abort();
  }, [ready, entityId, from, to, key, watchCalendarEvents]);
  const events = ready && result?.key === key ? result.events : undefined;
  const collections = (events ?? []).map(event => {
    const start = calendarTimeInput(event.start, currentHome.timeZone);
    return { event, start, daysAway: differenceInCalendarDays(parseISO(start.slice(0, 10)), parseISO(today)) };
  }).filter(({ daysAway }) => daysAway >= 0 && daysAway <= wasteCollectionDays)
    .sort((a, b) => a.start.localeCompare(b.start)).slice(0, 3);
  const status = !wasteCalendarEntity ? t("Choose a waste collection calendar in Customize Today.")
    : !homeOnline ? t("Calendars unavailable while offline.")
    : !ready ? t("Waste collection calendar unavailable. Check the calendar or choose another in Customize Today.")
    : events === undefined ? t("Loading your calendar…")
    : events === null ? t("Could not load waste collections. Check the calendar integration and try again.") : "";
  const loading = ready && events === undefined;
  if (!status && !collections.length) return null;
  return <section className="glow-panel col-span-full waste-collection" aria-label={t("Waste collection")} aria-busy={loading}>
    <div className="panel-heading">
      <PanelTitle icon={Trash2}>{t("Waste collection")}</PanelTitle>
      {wasteCalendarEntity && <Button variant="ghost" size="icon" aria-label={t("Refresh waste collections")} title={t("Refresh waste collections")} disabled={!ready || loading} onClick={() => setRefresh(value => value + 1)}><RefreshCw size={18} aria-hidden="true" /></Button>}
    </div>
    {status ? <p role={events === null ? "alert" : "status"} className="text-muted-foreground">{status}</p> : <ul className="waste-collection-list">
      {collections.map(({ event, start, daysAway }, index) => {
        const icons = wasteIconRules.filter(([pattern]) => pattern.test(event.summary)).map(([, icon]) => icon);
        if (!icons.length) icons.push(Trash2);
        const date = start.slice(0, 10);
        const pickedUp = daysAway === 0 && time >= "09:00";
        const label = pickedUp ? t("Picked up today") : daysAway === 0 ? t("Today") : daysAway === 1 ? t("Tomorrow") : t("In {count} days", { count: daysAway });
        return <li key={`${start}:${event.uid ?? index}`} className="waste-collection-item" data-state={pickedUp ? "collected" : daysAway === 0 ? "today" : daysAway === 1 ? "tomorrow" : "upcoming"}>
          <time dateTime={date} className="waste-collection-date" aria-label={dateLabel(date, { day: "numeric", month: "long", year: "numeric" })}>
            <span aria-hidden="true">{dateLabel(date, { month: "short" })}</span>
            <strong aria-hidden="true">{dateLabel(date, { day: "numeric" })}</strong>
          </time>
          <div className="waste-collection-copy">
            <h3><span className="waste-collection-icons" aria-hidden="true">{icons.map((Icon, iconIndex) => <Icon key={iconIndex} size={20} />)}</span><span>{event.summary || t("Waste collection")}</span></h3>
            <p className="waste-collection-countdown">{pickedUp && <Check size={17} aria-hidden="true" />}{label}</p>
            {start.includes("T") && !pickedUp && <span className="waste-collection-time">{start.slice(11, 16)}</span>}
          </div>
        </li>;
      })}
    </ul>}
  </section>;
}
