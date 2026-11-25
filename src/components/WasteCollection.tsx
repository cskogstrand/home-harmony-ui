import { PlannerCardBackdrop } from "@/components/CardArtwork";
import { PanelTitle } from "@/components/PanelTitle";
import { useEffect, useState } from "react";
import { Apple, Check, Cylinder, Leaf, Milk, Newspaper, PlugZap, Shirt, Trash2, TriangleAlert, Wine, type LucideIcon } from "lucide-react";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { useApp } from "@/contexts/AppContext";
import { addDays, useFamily } from "@/contexts/FamilyContext";
import { useI18n } from "@/hooks/use-i18n";
import { available, calendarBoundary } from "@/lib/ha-model";
import { isWasteCollected, wasteCollectionDate } from "@/lib/waste-collection";
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

export function WasteTypeIcons({ title, size = 20 }: { title: string | string[]; size?: number }) {
  // Several titles share one deduplicated icon row; each unmatched title contributes the general bin.
  const icons = [...new Set([title].flat().flatMap(item => {
    const matched = wasteIconRules.filter(([pattern]) => pattern.test(item)).map(([, icon]) => icon);
    return matched.length ? matched : [Trash2];
  }))];
  return <span className="waste-collection-icons" aria-hidden="true">{icons.map((Icon, index) => <Icon key={index} size={size} />)}</span>;
}

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
  const pickups = (events ?? []).map(event => {
    const date = wasteCollectionDate(event, currentHome.timeZone);
    return { title: event.summary || t("Waste collection"), date, daysAway: differenceInCalendarDays(parseISO(date), parseISO(today)) };
  }).filter(({ daysAway }) => daysAway >= 0 && daysAway <= wasteCollectionDays)
    .sort((a, b) => a.date.localeCompare(b.date));
  // Pickups on the same date share one row with every fraction's icon.
  const collections: { date: string; daysAway: number; titles: string[] }[] = [];
  for (const { title, date, daysAway } of pickups) {
    const row = collections[collections.length - 1];
    if (row?.date === date) { if (!row.titles.includes(title)) row.titles.push(title); }
    else collections.push({ date, daysAway, titles: [title] });
  }
  const status = !wasteCalendarEntity ? t("Choose a waste collection calendar in Customize Today.")
    : !homeOnline ? t("Calendars unavailable while offline.")
    : !ready ? t("Waste collection calendar unavailable. Check the calendar or choose another in Customize Today.")
    : events === undefined ? t("Loading your calendar…")
    : events === null ? t("Could not load waste collections. Check the calendar integration and try again.") : "";
  const loading = ready && events === undefined;
  if (!status && !collections.length) return null;
  return <section className="glow-panel waste-collection" aria-label={t("Waste collection")} aria-busy={loading}>
    <PlannerCardBackdrop kind="wasteCollection" />
    <div className="panel-heading">
      <PanelTitle artwork="wasteCollection" icon={Trash2}>{t("Waste collection")}</PanelTitle>
    </div>
    {status ? <div className="space-y-2"><p role={events === null ? "alert" : "status"} className="text-muted-foreground">{status}</p>
      {events === null && <Button variant="outline" onClick={() => setRefresh(value => value + 1)}>{t("Retry")}</Button>}
    </div> : <ul className="waste-collection-list">
      {collections.slice(0, 3).map(({ date, daysAway, titles }) => {
        const pickedUp = isWasteCollected(date, today, time);
        const label = pickedUp ? t("Picked up today") : daysAway === 0 ? t("Today") : daysAway === 1 ? t("Tomorrow") : t("In {count} days", { count: daysAway });
        return <li key={date} className="waste-collection-item" data-state={pickedUp ? "collected" : daysAway === 0 ? "today" : daysAway === 1 ? "tomorrow" : "upcoming"}>
          <time dateTime={date} className="waste-collection-date" aria-label={dateLabel(date, { day: "numeric", month: "long", year: "numeric" })}>
            <span aria-hidden="true">{dateLabel(date, { month: "short" })}</span>
            <strong aria-hidden="true">{dateLabel(date, { day: "numeric" })}</strong>
          </time>
          <div className="waste-collection-copy">
            <h3><WasteTypeIcons title={titles} /><span>{titles.join(", ")}</span></h3>
            <p className="waste-collection-countdown">{pickedUp && <Check size={17} aria-hidden="true" />}{label}</p>
          </div>
        </li>;
      })}
    </ul>}
  </section>;
}
