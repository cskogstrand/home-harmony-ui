import { useEffect, useState } from "react";
import type { Entity } from "@/types/api";
import { useApp } from "@/contexts/AppContext";
import { useI18n } from "@/hooks/use-i18n";
import { Button } from "@/components/ui/button";

export function EntityHistory({ entity }: { entity: Entity }) {
  const { entityHistory, homeOnline, currentHome } = useApp();
  const { message: t, number, locale } = useI18n();
  const [open, setOpen] = useState(false), [days, setDays] = useState<1 | 7>(1), [retry, setRetry] = useState(0);
  const [history, setHistory] = useState<Awaited<ReturnType<typeof entityHistory>> | null>();
  useEffect(() => {
    if (!open || !homeOnline) return;
    setHistory(undefined);
    const controller = new AbortController();
    void entityHistory(entity.entityId, days, controller.signal).then(data => { if (!controller.signal.aborted) setHistory(data); }).catch(() => { if (!controller.signal.aborted) setHistory(null); });
    return () => controller.abort();
  }, [open, homeOnline, entity.entityId, days, retry, entityHistory]);
  const points = (history ?? []).map(point => ({ time: point.lu * 1000, value: point.s.trim() && Number.isFinite(Number(point.s)) ? Number(point.s) : null }));
  const values = points.flatMap(point => point.value === null ? [] : [point.value]);
  const min = values.reduce((lowest, value) => Math.min(lowest, value), Infinity), max = values.reduce((highest, value) => Math.max(highest, value), -Infinity);
  const start = points[0]?.time, end = points[points.length - 1]?.time;
  let gap = true;
  const path = points.map(point => {
    if (point.value === null) { gap = true; return ""; }
    const command = gap ? "M" : "L"; gap = false;
    return `${command}${end > start ? (point.time - start) / (end - start) * 300 : 150},${max > min ? 90 - (point.value - min) / (max - min) * 80 : 50}`;
  }).join(" ");
  const time = (value: number) => new Intl.DateTimeFormat(locale, { timeZone: currentHome.timeZone, month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(value);
  return <details className="smart-reading-details" onToggle={event => setOpen(event.currentTarget.open)}><summary>{t("History")}</summary>{open && <>
    <label className="dg-choice"><span>{t("History period")}</span><select value={days} onChange={event => setDays(Number(event.target.value) as 1 | 7)}><option value={1}>{t("24 h")}</option><option value={7}>{t("7 d")}</option></select></label>
    {!homeOnline || !history || !values.length ? <p role="status">{t(!homeOnline ? "Offline" : history === undefined ? "Loading history…" : history === null ? "History unavailable" : "No numeric history available.")}</p> : <>
      <svg className="smart-history" viewBox="0 0 300 100" role="img" aria-label={t("Recorded history for {name}", { name: entity.name })}><title>{`${time(start)} – ${time(end)} · ${number(min)}–${number(max)} ${String(entity.attributes.unit_of_measurement ?? "")}`}</title><path d={path} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" /></svg>
      <div className="smart-history-range"><span>{time(start)}</span><span>{time(end)}</span></div><p>{t("Low")} {number(min)} · {t("High")} {number(max)} {String(entity.attributes.unit_of_measurement ?? "")}</p>
    </>}{history === null && homeOnline && <Button variant="outline" onClick={() => setRetry(value => value + 1)}>{t("Retry")}</Button>}
  </>}</details>;
}
