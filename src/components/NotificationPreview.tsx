import { useEffect, useId, useRef, useState } from "react";
import { Expand, PanelsTopLeft, PanelTop, Pause, Play, Eye } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import { useApp } from "@/contexts/AppContext";
import { useNotifications } from "@/contexts/NotificationContext";
import { useI18n } from "@/hooks/use-i18n";
import { available } from "@/lib/ha-model";
import { notificationEntity, progressSourceValue, type HomeNotification } from "@/lib/notifications";
import type { Entity } from "@/types/api";
import { notificationTriggers, notificationRuleSchema, type NotificationRule, type NotificationPresentation } from "../../shared/notifications";
import { NotificationCameraContent, NotificationDetailContent, NotificationSurface, NotificationTile } from "./NotificationCenter";
import { PanelTitle } from "./PanelTitle";
import { Dialog } from "./ui/dialog";
import { Button } from "./ui/button";
import { Switch } from "./ui/switch";
import { Accordion } from "./ui/accordion";
import { NotificationEditorSection } from "./NotificationEditorSection";
import { NotificationStylePicker } from "./NotificationStylePicker";

export function NotificationPreview({ rule, presentation: defaultPresentation, disabled = false, editing = false, onPresentationChange }: { rule?: NotificationRule; presentation: NotificationPresentation; disabled?: boolean; editing?: boolean; onPresentationChange?: (presentation: NotificationPresentation) => void }) {
  const { message: t } = useI18n();
  const { currentHome } = useApp();
  const { notifications } = useNotifications();
  const [demo, setDemo] = useState(!editing);
  const [percent, setPercent] = useState(40);
  const [playing, setPlaying] = useState(false);
  const [popupOpen, setPopupOpen] = useState(false);
  const opener = useRef<HTMLButtonElement | null>(null);
  const openPopup = (button: HTMLButtonElement) => { opener.current = button; setPopupOpen(true); };
  const [sampleAt] = useState(Date.now);
  const [styleOpen, setStyleOpen] = useState(false);
  const reducedMotion = useReducedMotion();
  const id = useId();
  const example = notificationRuleSchema.parse({
    id: "preview", title: t("Example task"), message: "", kind: "ongoing", icon: "washing",
    trigger: { type: "state", entity: "preview|sensor.remaining", operator: "gt", value: "0" },
    detailEntities: ["preview|sensor.remaining", "preview|sensor.total"],
    progress: { current: { type: "entity", entity: "preview|sensor.remaining" }, start: { type: "value", value: 90 }, end: { type: "value", value: 0 } },
  });
  const previewRule = rule ? { ...rule, title: rule.title.trim() || t("Your notification") } : example;
  const presentation = previewRule.presentation ?? defaultPresentation;
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
    for (const reference of previewRule.widget?.readings ?? []) setReading(reference, 42, t("Example reading"));
    for (const trigger of notificationTriggers(previewRule)) if ("entity" in trigger) setReading(trigger.entity, trigger.type === "state" ? trigger.value : "on", t("Example source"), trigger.type === "state" ? trigger.attribute : "");
    previewRule.detailEntities.forEach((reference, index) => {
      const entity = notificationEntity(entities, reference);
      const value = entity?.attributes.device_class === "timestamp" ? new Date(Date.now() + 1800000).toISOString() : index === 0 ? Math.round(90 * (1 - percent / 100)) : 90;
      setReading(reference, value, t(index === 0 ? "Time remaining" : "Total duration"));
      if (!rule) {
        notificationEntity(entities, reference).attributes.unit_of_measurement = "min";
        notificationEntity(entities, reference).name = t(index === 0 ? "Time remaining" : "Total duration");
      }
    });
    if (previewRule.timeLeftEntity) {
      const remaining = Math.round(90 * (1 - percent / 100));
      const reference = previewRule.timeLeftEntity;
      const entity = notificationEntity(entities, reference);
      if (entity?.attributes.device_class === "timestamp") {
        setReading(reference, new Date(Date.now() + remaining * 60_000).toISOString(), t("Time remaining"));
      } else if (!previewRule.progress || ![previewRule.progress.current, previewRule.progress.start, previewRule.progress.end].some(source => source.type === "entity" && source.entity === reference && !source.attribute)) {
        setReading(reference, remaining, t("Time remaining"));
        notificationEntity(entities, reference).attributes.unit_of_measurement = "min";
      }
    }
    if (previewRule.progress) {
      const { current, start, end } = previewRule.progress;
      const to = progressSourceValue(end, currentHome.entities) ?? 100;
      const from = progressSourceValue(start, currentHome.entities) ?? (to === 0 ? 100 : 0);
      for (const [source, value] of [[start, from], [end, to], [current, Math.round((from + (to - from) * percent / 100) * 100) / 100]] as const) {
        if (source.type === "entity") setReading(source.entity, value, t("Example reading"), source.attribute);
      }
    }
  }
  const triggers = notificationTriggers(previewRule);
  const now = Date.now();
  const live = !useDemo && notifications.find(item => item.rule.id === previewRule.id && (!item.calendarEntity ||
    triggers.some(trigger => trigger.type === "calendar" && trigger.entity === item.calendarEntity && item.eventStart <= now + trigger.leadMinutes * 60_000)));
  const draft: HomeNotification = { id: previewRule.id, startedAt: sampleAt, ...live, rule: previewRule, popup: false };
  const calendar = triggers.find(trigger => trigger.type === "calendar");
  if (editing && useDemo && calendar) {
    draft.eventTitle = t("Example calendar event");
    draft.eventStart = sampleAt + calendar.leadMinutes * 60_000;
  } else if (editing && useDemo && triggers.some(trigger => trigger.type === "ha-event" || trigger.type === "entity-event")) {
    draft.expiresAt = sampleAt + previewRule.durationSeconds * 1000;
  }
  const mode = useDemo ? "sample" : "current";
  const Popup = draft.rule.kind === "camera" ? NotificationCameraContent : NotificationDetailContent;
  const previewTitle = t("Preview {name}", { name: draft.eventTitle || previewRule.title });
  return <section className="notification-preview" aria-label={onPresentationChange ? t("Preview {name}", { name: previewRule.title }) : t("Notification preview")}>
    {editing ? <>
      <PanelTitle as="h3" icon={PanelsTopLeft}>{t("Board widget")}</PanelTitle>
      <div className="notification-widget-stage"><ul className="notification-board-layout">
        <NotificationTile item={draft} presentation={presentation} preview={mode} entities={entities} onOpen={openPopup} />
      </ul></div>
      <div className="notification-popup-preview-heading">
        <PanelTitle as="h3" icon={PanelTop}>{t("Popup window")}</PanelTitle>
        <Button type="button" variant="ghost" aria-haspopup="dialog" onClick={event => openPopup(event.currentTarget)}><Expand aria-hidden="true" />{t("Open full size")}</Button>
      </div>
      {!popupOpen && <Popup inline item={draft} presentation={presentation} preview={mode} entities={entities} />}
      <Dialog open={popupOpen} onOpenChange={setPopupOpen}><Popup item={draft} presentation={presentation} preview={mode} entities={entities} onReturn={() => opener.current?.focus()} /></Dialog>
    </> : !onPresentationChange && <><PanelTitle as="h3" icon={Eye}>{t("Preview")}</PanelTitle>
      <p className="page-note">{t(useDemo ? "Sample data only. Nothing is sent to Home Assistant." : "Current readings. Preview actions are disabled.")}</p></>}
    {rule && <div className="notification-toggle"><span>{t("Use sample data")}</span><Switch aria-label={t("Use sample data")} checked={demo} onCheckedChange={checked => { setDemo(checked); setPlaying(false); }} /></div>}
    {!editing && <fieldset disabled className="notification-preview-surface" aria-label={previewTitle} onClickCapture={event => { event.preventDefault(); event.stopPropagation(); }}>
      <NotificationSurface items={[draft]} compact presentation={defaultPresentation} preview={mode} entities={entities} />
    </fieldset>}
    {useDemo && previewRule.progress && <div className="notification-demo-controls">
      <label htmlFor={id}>{t("Demo progress")} <strong>{percent}%</strong></label>
      <div className="flex items-center gap-3"><input id={id} aria-label={t("Demo progress")} type="range" min={0} max={100} value={percent} onChange={event => { setPercent(Number(event.target.value)); setPlaying(false); }} />
        <Button type="button" variant="outline" size="icon" disabled={!!reducedMotion} aria-label={t(playing ? "Pause demo" : "Play demo")} onClick={() => setPlaying(value => !value)}>{playing ? <Pause size={18} aria-hidden="true" /> : <Play size={18} aria-hidden="true" />}</Button>
      </div>
    </div>}
    {onPresentationChange && <Accordion type="single" collapsible value={styleOpen ? "presentation" : ""} onValueChange={value => setStyleOpen(value === "presentation")}>
      <NotificationEditorSection value="presentation" title={t("Display as")} icon={Eye} open={styleOpen}>
        <NotificationStylePicker value={presentation} disabled={disabled} onChange={onPresentationChange} />
      </NotificationEditorSection>
    </Accordion>}
  </section>;
}
