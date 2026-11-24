import { useEffect, useState } from "react";
import type { Entity } from "@/types/api";
import { usePageActive } from "@/contexts/PageActivityContext";
import { useApp } from "@/contexts/AppContext";
import { useI18n } from "@/hooks/use-i18n";
import { Button } from "@/components/ui/button";
import { ChartNoAxesCombined } from "lucide-react";

export function EntityHistory({ entity, icon = false, trend = false }: { entity: Entity; icon?: boolean; trend?: boolean }) {
  const entityHistory = useApp(app => app.entityHistory);
  const homeOnline = useApp(app => app.homeOnline);
  const timeZone = useApp(app => app.currentHome.timeZone);
  const { message: t, number, locale } = useI18n();
  const [open, setOpen] = useState(false), [days, setDays] = useState<1 | 7>(1), [retry, setRetry] = useState(0);
  const active = usePageActive();
  const [history, setHistory] = useState<Awaited<ReturnType<typeof entityHistory>> | null>();
  useEffect(() => {
    if (!active || !(open || trend) || !homeOnline) return;
    setHistory(undefined);
    const controller = new AbortController();
    void entityHistory(entity.entityId, days, controller.signal).then(data => { if (!controller.signal.aborted) setHistory(data); }).catch(() => { if (!controller.signal.aborted) setHistory(null); });
    const timer = trend && window.setTimeout(() => setRetry(value => value + 1), 300000);
    return () => { controller.abort(); if (timer) clearTimeout(timer); };
  }, [active, trend, open, homeOnline, entity.entityId, days, retry, entityHistory]);
  const points = (history ?? []).map(point => ({ time: point.lu * 1000, value: point.s.trim() && Number.isFinite(Number(point.s)) ? Number(point.s) : null }));
  const values = points.flatMap(point => point.value === null ? [] : [point.value]);
  const min = values.reduce((lowest, value) => Math.min(lowest, value), Infinity), max = values.reduce((highest, value) => Math.max(highest, value), -Infinity);
  const start = points[0]?.time, end = points[points.length - 1]?.time;
  const x = (time: number) => end > start ? (time - start) / (end - start) * 300 : 150;
  const y = (value: number) => max > min ? 90 - (value - min) / (max - min) * 80 : 50;
  const isolated = points.filter((point, i) => point.value !== null && points[i - 1]?.value == null && points[i + 1]?.value == null);
  let gap = true;
  const path = points.map(point => {
    if (point.value === null) { gap = true; return ""; }
    const command = gap ? "M" : "L"; gap = false;
    return `${command}${x(point.time)},${y(point.value)}`;
  }).join(" ");
  const time = (value: number) => new Intl.DateTimeFormat(locale, { timeZone: timeZone, month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(value);
  const label = t("History for {name}", { name: entity.name });
  const chart = <>
    {!homeOnline || !history || !values.length ? <p role="status">{t(!homeOnline ? "Offline" : history === undefined ? "Loading history…" : history === null ? "History unavailable" : "No numeric history available.")}</p> : <>
      <svg className="smart-history" viewBox="0 0 300 100" preserveAspectRatio="none" role="img" aria-label={t("Recorded history for {name}", { name: entity.name })}><title>{`${time(start)} – ${time(end)} · ${number(min)}–${number(max)} ${String(entity.attributes.unit_of_measurement ?? "")}`}</title><path d={path} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />{isolated.map((point, index) => <path key={index} d={`M${x(point.time)},${y(point.value)}h0`} stroke="currentColor" strokeWidth="5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />)}</svg>
      <div className="smart-history-range"><span>{time(start)}</span><span>{time(end)}</span></div><p>{t("Low")} {number(min)} · {t("High")} {number(max)} {String(entity.attributes.unit_of_measurement ?? "")}</p>
    </>}{history === null && homeOnline && <Button variant="outline" onClick={() => setRetry(value => value + 1)}>{t("Retry")}</Button>}
  </>;
  if (trend) return <div className="meter-trend">{chart}</div>;
  return <details className={`smart-reading-details${icon ? " entity-history-icon" : ""}`} onToggle={event => setOpen(event.currentTarget.open)}><summary aria-label={icon ? label : undefined} title={icon ? label : undefined}>{icon ? <ChartNoAxesCombined size={17} aria-hidden="true" /> : t("History")}</summary>{open && <>
    <label className="dg-choice"><span>{t("History period")}</span><select value={days} onChange={event => setDays(Number(event.target.value) as 1 | 7)}><option value={1}>{t("24 h")}</option><option value={7}>{t("7 d")}</option></select></label>
    {chart}
  </>}</details>;
}
