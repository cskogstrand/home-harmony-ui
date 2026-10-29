import { useEffect, useId, useState } from "react";
import { Eye, Pause, Play } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import { useApp } from "@/contexts/AppContext";
import { useI18n } from "@/hooks/use-i18n";
import { available } from "@/lib/ha-model";
import { notificationEntity, progressSourceValue } from "@/lib/notifications";
import type { Entity } from "@/types/api";
import { notificationRuleSchema, type NotificationRule } from "../../shared/notifications";
import { NotificationRow } from "./NotificationCenter";
import { PanelTitle } from "./PanelTitle";
import { Button } from "./ui/button";
import { Switch } from "./ui/switch";

export function NotificationPreview({ rule, presentation }: { rule?: NotificationRule; presentation: "banner" | "section" | "activity" }) {
  const { message: t } = useI18n();
  const { currentHome } = useApp();
  const [demo, setDemo] = useState(true);
  const [percent, setPercent] = useState(40);
  const [playing, setPlaying] = useState(false);
  const reducedMotion = useReducedMotion();
  const id = useId();
  const example = notificationRuleSchema.parse({
    id: "preview", title: t("Example task"), message: "", kind: "ongoing", icon: "washing",
    trigger: { type: "state", entity: "preview|sensor.remaining", operator: "gt", value: "0" },
    detailEntities: ["preview|sensor.remaining", "preview|sensor.total"],
    progress: { current: { type: "entity", entity: "preview|sensor.remaining" }, start: { type: "value", value: 90 }, end: { type: "value", value: 0 } },
  });
  const previewRule = rule ? { ...rule, title: rule.title || t("Your notification") } : example;
  const useDemo = !rule || demo;
  const canPlay = useDemo && !!previewRule.progress && !reducedMotion;
  useEffect(() => {
    if (!playing || !canPlay) return;
    const timer = setInterval(() => { if (!document.hidden) setPercent(value => value >= 100 ? 0 : value + 5); }, 1000);
    return () => clearInterval(timer);
  }, [playing, canPlay]);
  let entities = currentHome.entities;
  if (useDemo) {
    entities = entities.map(entity => ({ ...entity, attributes: { ...entity.attributes } }));
    const setReading = (reference: string, value: number | string, name: string, attribute = "") => {
      let entity = notificationEntity(entities, reference);
      if (!entity) {
        entity = { entityId: reference.split("|").pop(), preferenceId: reference, domain: "sensor", state: "0", name, attributes: {}, areaId: "unassigned" } as Entity;
        entities.push(entity);
      }
      if (attribute) { if (!available(entity)) entity.state = "0"; entity.attributes[attribute] = value; }
      else entity.state = String(value);
    };
    if ("entity" in previewRule.trigger) setReading(previewRule.trigger.entity, previewRule.trigger.type === "state" ? previewRule.trigger.value : "on", t("Example source"), previewRule.trigger.type === "state" ? previewRule.trigger.attribute : "");
    previewRule.detailEntities.forEach((reference, index) => {
      const entity = notificationEntity(entities, reference);
      const value = entity?.attributes.device_class === "timestamp" ? new Date(Date.now() + 1800000).toISOString() : index === 0 ? Math.round(90 * (1 - percent / 100)) : 90;
      setReading(reference, value, t(index === 0 ? "Time remaining" : "Total duration"));
      if (!rule) {
        notificationEntity(entities, reference).attributes.unit_of_measurement = "min";
        notificationEntity(entities, reference).name = t(index === 0 ? "Time remaining" : "Total duration");
      }
    });
    if (previewRule.progress) {
      const { current, start, end } = previewRule.progress;
      const to = progressSourceValue(end, currentHome.entities) ?? 100;
      const from = progressSourceValue(start, currentHome.entities) ?? (to === 0 ? 100 : 0);
      for (const [source, value] of [[start, from], [end, to], [current, Math.round((from + (to - from) * percent / 100) * 100) / 100]] as const) {
        if (source.type === "entity") setReading(source.entity, value, t("Example reading"), source.attribute);
      }
    }
  }
  return <section className="notification-preview" aria-label={t("Notification preview")}>
    <PanelTitle as="h3" icon={Eye}>{t("Preview")}</PanelTitle>
    <p className="page-note">{t(useDemo ? "Sample data only. Nothing is sent to Home Assistant." : "Current readings. Preview actions are disabled.")}</p>
    {rule && <div className="notification-toggle"><span>{t("Use sample data")}</span><Switch aria-label={t("Use sample data")} checked={demo} onCheckedChange={checked => { setDemo(checked); setPlaying(false); }} /></div>}
    <ul className={presentation === "activity" ? "notification-activity-grid" : presentation === "banner" ? "notification-preview-banner" : "notification-preview-section"}>
      <NotificationRow item={{ id: "preview", rule: previewRule, startedAt: 0, popup: false }} activity={presentation === "activity"} condensed={presentation === "banner"} entities={entities} preview />
    </ul>
    {useDemo && previewRule.progress && <div className="notification-demo-controls">
      <label htmlFor={id}>{t("Demo progress")} <strong>{percent}%</strong></label>
      <div className="flex items-center gap-3"><input id={id} aria-label={t("Demo progress")} type="range" min={0} max={100} value={percent} onChange={event => { setPercent(Number(event.target.value)); setPlaying(false); }} />
        <Button type="button" variant="outline" size="icon" disabled={!!reducedMotion} aria-label={t(playing ? "Pause demo" : "Play demo")} onClick={() => setPlaying(value => !value)}>{playing ? <Pause size={18} aria-hidden="true" /> : <Play size={18} aria-hidden="true" />}</Button>
      </div>
    </div>}
  </section>;
}
