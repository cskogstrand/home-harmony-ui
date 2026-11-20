import type { ZodIssue } from "zod";
import { NotificationValidationErrors } from "./NotificationValidationErrors";
import { configuredCamera } from "../../shared/cameras";
import { useSearchParams } from "react-router-dom";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Bell, Camera, ChartNoAxesColumnIncreasing, Gauge, ListChecks, MessageSquare, Palette, PanelsTopLeft, Eye, Plus, SlidersHorizontal, Timer, Zap, X } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { newPlannerId, useFamily } from "@/contexts/FamilyContext";
import { useSharedConfiguration } from "@/contexts/SharedConfigurationContext";
import { useI18n } from "@/hooks/use-i18n";
import { isNotificationTimeSource, notificationEntity, notificationReadings, notificationStyleLabels, notificationIssueSection } from "@/lib/notifications";
import { MAX_NOTIFICATION_TRIGGERS, notificationTriggers, notificationRuleSchema, type NotificationRule, type NotificationTrigger, type NotificationStateTrigger } from "../../shared/notifications";
import { PanelHeading } from "./FamilyPlanner";
import { Button } from "./ui/button";
import { Accordion } from "./ui/accordion";
import { NotificationEditorSection } from "./NotificationEditorSection";
import { Switch } from "./ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { ConfirmDialog } from "./common/ConfirmDialog";
import { EntityPicker } from "./EntityPicker";
import { PanelTitle } from "./PanelTitle";
import { NotificationProgressSettings } from "./NotificationProgress";
import { NotificationPreview } from "./NotificationPreview";
import { NotificationGridZoomPicker, NotificationWidgetSettings, NotificationWidgetWidthPicker } from "./NotificationWidgetSettings";
import { NotificationStylePicker } from "./NotificationStylePicker";
import { NotificationCameraSettings } from "./NotificationCameraSettings";
import { NotificationEntitySettings } from "./NotificationEntitySettings";
import { NotificationIconPicker } from "./NotificationIcon";
import "./notifications.css";

const kinds = { ongoing: "Ongoing tasks", current: "Current alerts", camera: "Camera popup" } as const;
const icons = { ongoing: ListChecks, current: Bell, camera: Camera };
const newTrigger = (type: NotificationTrigger["type"]): NotificationTrigger => {
  if (type === "state") return { type, entity: "", attribute: "", operator: "eq", value: "on" };
  if (type === "entity-event") return { type, entity: "", eventType: "" };
  if (type === "calendar") return { type, entity: "", leadMinutes: 0 };
  return { type, eventType: "", filters: {} };
};

const triggerField = (index: number) => index === 0 ? "trigger" : `additionalTriggers.${index - 1}`;
function initialTriggerGroups(triggers: NotificationTrigger[]) {
  return triggers.map((trigger, index) => trigger.type === "state" && trigger.entity && trigger.operator === "eq"
    ? triggers.findIndex(other => other.type === "state" && other.operator === "eq" && other.entity === trigger.entity && other.attribute === trigger.attribute)
    : index);
}

export function NotificationSettings() {
  const { message: t } = useI18n();
  const { notifications, setNotifications, appearance } = useFamily();
  const boardSpacing = `board-spacing${appearance.compactMode ? " compact-mode" : ""}`;
  const [params, setParams] = useSearchParams();
  const requestedCamera = params.get("camera");
  const { currentHome, homeOnline } = useApp();
  const shared = useSharedConfiguration();
  const disabled = !shared?.state.loaded || !!shared.state.error;
  const [draft, setDraft] = useState<NotificationRule>();
  const [mobileView, setMobileView] = useState<"setup" | "preview">("setup");
  const [openSections, setOpenSections] = useState<string[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const [original, setOriginal] = useState("");
  const [groupIds, setGroupIds] = useState([0]);
  const [filters, setFilters] = useState<string[]>(["{}"]);
  const [error, setError] = useState("");
  const [issues, setIssues] = useState<ZodIssue[]>([]);
  const [remove, setRemove] = useState<NotificationRule>();
  const editor = useRef<HTMLFormElement>(null);
  const titleInput = useRef<HTMLInputElement>(null);
  const editUsage = (section: "trigger" | "hideTrigger" | "progress" | "readings" | "camera") => {
    setOpenSections(sections => [...new Set([...sections, section])]);
    editor.current?.querySelector<HTMLButtonElement>(`[data-section="${section}"] > h3 > button`)?.focus();
  };
  const entities = currentHome.entities;
  const cameras = shared?.state.config.settings.cameras;
  const selectable = entities.filter(entity => !(entity.domain === "input_text" && entity.attributes.mode === "password"));
  const begin = (rule: NotificationRule, existing = false) => {
    setMobileView("setup");
    setOpenSections([...(existing ? [] : ["trigger"]), ...(rule.title.trim() ? [] : ["content"]), ...(!existing && rule.kind === "camera" ? ["camera"] : [])]);
    setDraft(rule); setOriginal(existing ? JSON.stringify(rule) : ""); setError(""); setIssues([]);
    setGroupIds(initialTriggerGroups(notificationTriggers(rule)));
    setFilters(notificationTriggers(rule).map(trigger => trigger.type === "ha-event" ? JSON.stringify(trigger.filters, null, 2) : "{}"));
  };
  useEffect(() => {
    if (!requestedCamera || !shared?.state.loaded || draft) return;
    const camera = configuredCamera(cameras, requestedCamera);
    if (!camera) return;
    setDraft({ id: newPlannerId(), title: camera.name.slice(0, 100), message: "", kind: "camera", enabled: true, trigger: newTrigger("state"), detailEntities: [], cameraEntity: camera.id, durationSeconds: 60, cooldownSeconds: 10 });
    setMobileView("setup"); setOriginal(""); setError(""); setIssues([]); setFilters(["{}"]); setGroupIds([0]); setOpenSections(["camera", "trigger"]);
    const next = new URLSearchParams(params); next.delete("camera"); setParams(next, { replace: true });
  }, [requestedCamera, shared?.state.loaded, cameras, draft, params, setParams]);
  const selectEntity = (label: string, value: string, update: (id: string) => void, domain?: string, name?: string) => {
    const choices = selectable.filter(entity => !domain || entity.domain === domain);
    return <EntityPicker name={name} label={t(label)} entities={choices} value={value} onChange={update} disabled={disabled} />;
  };
  const stateFields = (field: string, trigger: NotificationStateTrigger, update: (value: NotificationStateTrigger) => void, hint: string, valueFields?: ReactNode, multiple = false) => {
    const source = notificationEntity(entities, trigger.entity);
    return <>
      {selectEntity("Source entity", trigger.entity, entity => update({ ...trigger, entity }), undefined, `${field}.entity`)}
      <p className="page-note">{t(hint)}{source && <> {t("Reported state: {state}", { state: source.attributes.mode === "password" ? "••••••" : source.state })}</>}</p>
      <label>{t("Attribute (optional)")}<input name={`${field}.attribute`} disabled={disabled} maxLength={100} value={trigger.attribute} placeholder={t("Leave empty to use the state")} onChange={event => update({ ...trigger, attribute: event.target.value })} /></label>
      <div className="grid gap-3 sm:grid-cols-2"><label>{t("Condition")}<select name={`${field}.operator`} disabled={disabled || multiple} value={trigger.operator} onChange={event => update({ ...trigger, operator: event.target.value as NotificationStateTrigger["operator"] })}>
        <option value="eq">{t("Equals")}</option><option value="neq">{t("Does not equal")}</option><option value="gt">{t("Above")}</option><option value="lt">{t("Below")}</option>
      </select></label>{valueFields ?? <label>{t("Value")}<input name={`${field}.value`} disabled={disabled} required maxLength={256} value={trigger.value} onChange={event => update({ ...trigger, value: event.target.value })} /></label>}</div>
    </>;
  };
  const save = () => {
    setError(""); setIssues([]);
    const current = notifications.rules.find(rule => rule.id === draft.id);
    if (original && JSON.stringify(current) !== original) { setError("This rule changed on another screen. Cancel and reopen it before saving."); return; }
    const errors: ZodIssue[] = [];
    if ((draft.kind === "camera" || draft.kind === "ongoing" && draft.cameraEntity) && !configuredCamera(cameras, draft.cameraEntity)) errors.push({ code: "custom", path: ["cameraEntity"], message: "Choose a camera you have added in Camera settings." });
    const image = notificationEntity(entities, draft.imageEntity ?? "");
    if (image && image.domain !== "image") errors.push({ code: "custom", path: ["imageEntity"], message: "Choose an image entity from Home Assistant." });
    const media = draft.widget?.media;
    if (media && "cameraId" in media && media.cameraId) {
      const camera = configuredCamera(cameras, media.cameraId);
      if (!camera || media.type === "person" && camera.personSnapshot.type === "none") errors.push({ code: "custom", path: ["widget", "media", "cameraId"], message: "Choose an available camera for this widget." });
    }
    const widgetImage = media?.type === "image" && notificationEntity(entities, media.entity);
    if (widgetImage && widgetImage.domain !== "image") errors.push({ code: "custom", path: ["widget", "media", "entity"], message: "Choose an image entity from Home Assistant." });
    const triggers = notificationTriggers(draft).map((trigger, index) => {
      if (trigger.type !== "ha-event") return trigger;
      try { return { ...trigger, filters: JSON.parse(filters[index]) }; }
      catch {
        errors.push({ code: "custom", path: [...(index === 0 ? ["trigger"] : ["additionalTriggers", index - 1]), "filters"], message: "Event filters must be a JSON object, for example {\"action\":\"single\"}." });
        return trigger;
      }
    });
    const readings = notificationReadings(draft);
    const result = notificationRuleSchema.safeParse({ ...draft, trigger: triggers[0], additionalTriggers: triggers.length > 1 ? triggers.slice(1) : undefined, ...(draft.entityDisplay && { entityDisplay: draft.entityDisplay.filter(item => readings.some(reading => reading.entity === item.entity && reading.attribute === item.attribute)) }) });
    if (!result.success) {
      for (const issue of result.error.issues) {
        if (issue.path[0] === "additionalTriggers" && issue.path[2] !== "value") {
          const index = Number(issue.path[1]) + 1;
          const first = groupIds.indexOf(groupIds[index]);
          if (first >= 0 && first !== index) continue; // Shared fields already have the first value’s validation error.
        }
        errors.push(issue);
      }
    }
    if (errors.length) {
      setMobileView("setup");
      setIssues(errors.filter((issue, index) => errors.findIndex(other => JSON.stringify(other.path) === JSON.stringify(issue.path)) === index));
      setOpenSections(sections => [...new Set([...sections, ...errors.map(notificationIssueSection)])]);
      return;
    }
    if (!result.success) return;
    const rules = current ? notifications.rules.map(rule => rule.id === draft.id ? result.data : rule) : [...notifications.rules, result.data];
    if (setNotifications({ rules })) setDraft(undefined);
    else setError("The rule could not be saved. Your draft is still here. Check settings storage and retry.");
  };
  const setTriggers = (triggers: NotificationTrigger[]) => setDraft({
    ...draft, trigger: triggers[0], additionalTriggers: triggers.length > 1 ? triggers.slice(1) : undefined,
    hideTrigger: triggers.some(trigger => trigger.type === "state") ? draft.hideTrigger : undefined,
  });
  const triggers = draft ? notificationTriggers(draft) : [];
  const groups = [...new Set(groupIds)];
  const full = triggers.length >= MAX_NOTIFICATION_TRIGGERS;
  const addTrigger = (trigger: NotificationTrigger, group: number) => {
    setTriggers([...triggers, trigger]);
    setFilters([...filters, "{}"]);
    setGroupIds([...groupIds, group]);
  };
  const removeTriggers = (indices: number[], remaining = triggers) => {
    setTriggers(remaining.filter((_, i) => !indices.includes(i)));
    setFilters(filters.filter((_, i) => !indices.includes(i)));
    setGroupIds(groupIds.filter((_, i) => !indices.includes(i)));
  };
  const stateTrigger = triggers.find(trigger => trigger.type === "state");
  const hide = draft?.hideTrigger;
  const trigger = draft?.trigger;
  const source = trigger && "entity" in trigger && notificationEntity(entities, trigger.entity);
  const stateSummary = (condition: NotificationStateTrigger) => {
    const entity = notificationEntity(entities, condition.entity);
    return [entity?.name, condition.attribute, { eq: "=", neq: "≠", gt: ">", lt: "<" }[condition.operator], entity?.attributes.mode === "password" ? "••••••" : condition.value].filter(Boolean).join(" ");
  };
  const triggerSummary = groups.length > 1 ? t("{count} triggers", { count: groups.length }) : triggers.length > 1 ? t("{count} values", { count: triggers.length }) : trigger?.type === "ha-event" ? trigger.eventType :
    source && trigger?.type === "state" ? stateSummary(trigger) : source && source.name;
  const selectedMedia = draft && [draft.kind !== "current" && configuredCamera(cameras, draft.cameraEntity)?.name, notificationEntity(entities, draft.imageEntity ?? "")?.name].filter(Boolean).join(" · ");
  return <section className="settings-stack" id="notifications">
    <PanelHeading icon={Bell} title={t("Notifications")} to="/notifications" label={t("View notifications")} />
    <p className="page-note">{t("Keep track of running tasks, current events and camera alerts while Afterglow is open. Rules are shared across screens; dismissals apply to this screen.")}</p>
    <label className="my-4 flex items-center justify-between gap-4"><span>{t("Enable notifications")}</span><Switch aria-label={t("Enable notifications")} checked={notifications.enabled} disabled={disabled} onCheckedChange={enabled => setNotifications({ enabled })} /></label>
    <NotificationGridZoomPicker value={notifications.gridZoom} disabled={disabled} onChange={gridZoom => setNotifications({ gridZoom })} />
    <NotificationWidgetWidthPicker value={notifications.defaultWidgetWidth} disabled={disabled} onChange={defaultWidgetWidth => setNotifications({ defaultWidgetWidth })} />
    <Dialog open={previewOpen} onOpenChange={open => { setPreviewOpen(open); setPreviewError(false); }}>
    <div className="notification-settings-toolbar">
      <DialogTrigger asChild><Button variant="outline"><Eye size={18} aria-hidden="true" />{t("Preview notification")}</Button></DialogTrigger>
    </div>
    <DialogContent className={`notification-preview-dialog ${boardSpacing}`}>
      <DialogHeader><DialogTitle asChild><PanelTitle icon={Eye}>{t("Preview notification")}</PanelTitle></DialogTitle><DialogDescription>{t("Preview all saved notifications, including inactive ones. Display choices are saved automatically.")}</DialogDescription></DialogHeader>
      {previewError && <p role="alert" className="text-destructive">{t("The display choice could not be saved. Check settings storage and try again.")}</p>}
      <div className="notification-preview-collection">
        {!notifications.rules.length && <NotificationPreview presentation={notifications.presentation} />}
        {(Object.keys(kinds) as NotificationRule["kind"][]).map(kind => {
          const rules = notifications.rules.filter(rule => rule.kind === kind);
          return rules.length > 0 && <section key={kind} aria-label={t(kinds[kind])}>
            <PanelTitle as="h3" icon={icons[kind]} className="mb-4 text-muted-foreground">{t(kinds[kind])}</PanelTitle>
            <div className="notification-preview-gallery">{rules.map(rule => <NotificationPreview key={rule.id} rule={rule} presentation={notifications.presentation} disabled={disabled}
              onPresentationChange={presentation => setPreviewError(!setNotifications({ rules: notifications.rules.map(item => item.id === rule.id ? { ...item, presentation } : item) }))} />)}</div>
          </section>;
        })}
      </div>
    </DialogContent></Dialog>
    {!homeOnline && <p role="status" className="page-note">{t("Notifications are paused until Home Assistant reconnects.")}</p>}
    {(Object.keys(kinds) as NotificationRule["kind"][]).map(kind => {
      const rules = notifications.rules.filter(rule => rule.kind === kind);
      const Icon = icons[kind];
      return <section key={kind} className="notification-rule-group settings-card" aria-label={t(kinds[kind])}>
      <div className="notification-rule-group-heading"><PanelTitle as="h3" icon={Icon}>{t(kinds[kind])}</PanelTitle>
        <Button variant="outline" disabled={disabled || notifications.rules.length >= 100} aria-label={t("Add {kind}", { kind: t(kinds[kind]) })} onClick={() => begin({ id: newPlannerId(), title: "", message: "", kind, enabled: true, trigger: newTrigger("state"), detailEntities: [], cameraEntity: "", durationSeconds: 60, cooldownSeconds: 10 })}><Plus size={18} aria-hidden="true" />{t("Add notification")}</Button>
      </div>
      {!rules.length && <p className="page-note">{t("No notifications in this group yet.")}</p>}
      <ul className="space-y-3">{rules.map(rule => {
      const source = "entity" in rule.trigger ? notificationEntity(entities, rule.trigger.entity) : undefined;
      const savedTriggers = notificationTriggers(rule);
      const groupCount = new Set(initialTriggerGroups(savedTriggers)).size;
      const Icon = icons[rule.kind];
      const missing = !!rule.hideTrigger && !notificationEntity(entities, rule.hideTrigger.entity) || !!rule.imageEntity && !notificationEntity(entities, rule.imageEntity) || notificationTriggers(rule).some(trigger => "entity" in trigger && !notificationEntity(entities, trigger.entity)) || ((rule.kind === "camera" || rule.kind === "ongoing" && rule.cameraEntity) && !configuredCamera(cameras, rule.cameraEntity));
      return <li key={rule.id} className="flex flex-wrap items-center gap-3 py-3">
        <Icon size={20} aria-hidden="true" /><div className="min-w-0 flex-1 basis-[calc(100%-40px)] break-words sm:basis-0"><strong>{rule.title}</strong><p className="text-sm text-muted-foreground">{t((rule.pages ?? notifications.pages) === "today" ? "Today only" : "All main pages")} · {notificationReadings(rule).find(reading => reading.roles.includes("Source entity"))?.name || source?.name || (rule.trigger.type === "ha-event" ? rule.trigger.eventType : t("Entity unavailable"))}{savedTriggers.length > 1 && <> · {groupCount === 1 ? t("{count} values", { count: savedTriggers.length }) : t("{count} triggers", { count: groupCount })}</>}</p>{missing && <p className="text-sm text-warning">{t("A selected entity is unavailable. Edit this rule to choose a replacement.")}</p>}</div>
        <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
        <Switch aria-label={t("Enable {name}", { name: rule.title })} checked={rule.enabled} disabled={disabled} onCheckedChange={enabled => setNotifications({ rules: notifications.rules.map(item => item.id === rule.id ? { ...item, enabled } : item) })} />
        <Button variant="ghost" disabled={disabled} onClick={() => begin(rule, true)} aria-label={t("Edit {name}", { name: rule.title })}>{t("Edit")}</Button>
        <Button variant="ghost" disabled={disabled} onClick={() => setRemove(rule)} aria-label={t("Delete {name}", { name: rule.title })}>{t("Delete")}</Button>
        </div>
      </li>;
    })}</ul></section>;
    })}
    <Dialog open={!!draft} onOpenChange={open => { if (!open) setDraft(undefined); }}><DialogContent className={`notification-editor ${boardSpacing}`} data-kind={draft?.kind} onOpenAutoFocus={event => {
      event.preventDefault(); editor.current?.querySelector<HTMLButtonElement>('[data-section="trigger"] > h3 > button')?.focus();
    }}>
      <DialogHeader><DialogTitle asChild><PanelTitle icon={Bell}>{t(original ? "Edit notification" : "Add notification")}</PanelTitle></DialogTitle><DialogDescription className="truncate">{[draft?.title.trim(), t(draft ? kinds[draft.kind] : "Notifications")].filter(Boolean).join(" · ")}</DialogDescription></DialogHeader>
      {draft && <form ref={editor} noValidate className="planner-form notification-editor-form" onSubmit={event => { event.preventDefault(); save(); }}>
        <div className="notification-editor-views" role="group" aria-label={t("Editor view")}>
          <Button type="button" variant="ghost" aria-pressed={mobileView === "setup"} onClick={() => setMobileView("setup")}><SlidersHorizontal aria-hidden="true" />{t("Setup")}</Button>
          <Button type="button" variant="ghost" aria-pressed={mobileView === "preview"} onClick={() => setMobileView("preview")}><Eye aria-hidden="true" />{t("Preview")}</Button>
        </div>
        <div className="notification-editor-layout" data-view={mobileView}>
        <Accordion type="multiple" value={openSections} onValueChange={setOpenSections} className="notification-editor-fields">
        <h3 className="notification-settings-group">{t("Activation")}</h3>
        <NotificationEditorSection value="trigger" title={t("When to show it")} icon={Zap} summary={triggerSummary || t("Choose a source")} open={openSections.includes("trigger")}>
        {groups.length > 1 && <p className="page-note">{t("Any matching trigger can show this notification.")}</p>}
        {groups.map((group, groupIndex) => {
          const indices = groupIds.flatMap((id, index) => id === group ? [index] : []);
          const index = indices[0], trigger = triggers[index], field = triggerField(index);
          const multiple = indices.length > 1;
          const update = (value: NotificationTrigger) => setTriggers(triggers.map((item, i) => {
            if (i === index) return value;
            if (groupIds[i] === group && item.type === "state" && value.type === "state") return { ...value, value: item.value };
            return item;
          }));
          const valueFields = trigger.type === "state" && trigger.operator === "eq" && <div className="grid min-w-0 gap-2">
            {indices.map((i, position) => {
              const item = triggers[i];
              if (item.type !== "state") return null;
              return <div key={i} className="flex items-end gap-2">
                <label className="min-w-0 flex-1">{multiple ? t("Value {number}", { number: position + 1 }) : t("Value")}
                  <input name={`${triggerField(i)}.value`} required maxLength={256} value={item.value} onChange={event => setTriggers(triggers.map((other, j) => j === i ? { ...item, value: event.target.value } : other))} />
                </label>
                {multiple && <Button type="button" variant="ghost" size="icon" aria-label={t("Remove value {number}", { number: position + 1 })} onClick={() => {
                  // Keep the primary source in place when other triggers sit between its values.
                  const next = [...triggers];
                  for (let j = position; j < indices.length - 1; j++) next[indices[j]] = triggers[indices[j + 1]];
                  removeTriggers([indices[indices.length - 1]], next);
                  requestAnimationFrame(() => editor.current?.querySelector<HTMLButtonElement>(`[data-add-value="${group}"]`)?.focus());
                }}><X size={18} aria-hidden="true" /></Button>}
              </div>;
            })}
            <Button type="button" variant="outline" className="justify-self-start" data-add-value={group} disabled={full} onClick={() => {
              addTrigger({ ...trigger, value: "" }, group);
              requestAnimationFrame(() => editor.current?.querySelector<HTMLInputElement>(`[name="${triggerField(triggers.length)}.value"]`)?.focus());
            }}><Plus size={18} aria-hidden="true" />{t("Add value")}</Button>
          </div>;
          return <fieldset key={group} className="notification-trigger" disabled={disabled} data-trigger-index={index} data-trigger-number={groupIndex + 1}>
            <legend className="sr-only">{t("Trigger {number}", { number: groupIndex + 1 })}</legend>
            {groups.length > 1 && <div className="flex items-center justify-between gap-3">
              <strong>{t("Trigger {number}", { number: groupIndex + 1 })}</strong>
              <Button type="button" variant="ghost" size="icon" aria-label={t("Remove trigger {number}", { number: groupIndex + 1 })} onClick={() => {
                removeTriggers(indices);
                requestAnimationFrame(() => editor.current?.querySelector<HTMLButtonElement>("[data-add-trigger]")?.focus());
              }}><X size={18} aria-hidden="true" /></Button>
            </div>}
            <label>{t("Trigger")}<select name={`${field}.type`} disabled={multiple} value={trigger.type} onChange={event => { update(newTrigger(event.target.value as NotificationTrigger["type"])); setFilters(values => values.map((value, i) => i === index ? "{}" : value)); }}>
              <option value="state">{t("Entity state")}</option>
              {draft.kind !== "ongoing" && <><option value="entity-event">{t("Event entity")}</option><option value="ha-event">{t("Home Assistant event")}</option></>}
              {draft.kind === "current" && <option value="calendar">{t("Calendar event")}</option>}
            </select></label>
            {trigger.type === "state" ? stateFields(field, trigger, update, draft.kind === "camera" ? "The popup opens when this condition becomes true." : hide ? "Shows the notification when this condition becomes true." : "Visible while this condition is true.", valueFields || undefined, multiple)
              : "entity" in trigger && selectEntity("Source entity", trigger.entity, entity => update({ ...trigger, entity }), trigger.type === "calendar" ? "calendar" : "event", `${field}.entity`)}
            {multiple && <p className="page-note">{t("Any listed value matches. Keep one value to change the trigger type or condition.")}</p>}
            {(trigger.type === "entity-event" || trigger.type === "ha-event") && <label>{t(trigger.type === "entity-event" ? "Event type (optional)" : "Event type")}<input name={`${field}.eventType`} required={trigger.type === "ha-event"} maxLength={100} value={trigger.eventType} onChange={event => update({ ...trigger, eventType: event.target.value } as NotificationTrigger)} /></label>}
            {trigger.type === "entity-event" && <p className="page-note">{t("Triggers on a new event timestamp. Leave the event type empty to match every event from this entity.")}</p>}
            {trigger.type === "ha-event" && <label>{t("Event data filters (JSON)")}<textarea name={`${field}.filters`} rows={3} value={filters[index]} maxLength={8000} onChange={event => setFilters(values => values.map((value, i) => i === index ? event.target.value : value))} /><span className="page-note">{t("Match exact top-level fields, such as action or device_id. Empty filters match every event of this type.")}</span></label>}
            {trigger.type === "calendar" && <label>{t("Show minutes before start")}<input name={`${field}.leadMinutes`} type="number" min={0} max={1440} required value={trigger.leadMinutes} onChange={event => update({ ...trigger, leadMinutes: event.target.valueAsNumber } as NotificationTrigger)} /></label>}
          </fieldset>;
        })}
        <Button type="button" variant="outline" data-add-trigger disabled={disabled || full} onClick={() => {
          const index = triggers.length;
          addTrigger(newTrigger("state"), Math.max(...groupIds) + 1);
          requestAnimationFrame(() => editor.current?.querySelector<HTMLSelectElement>(`[data-trigger-index="${index}"] select`)?.focus());
        }}><Plus size={18} aria-hidden="true" />{t("Add trigger")}</Button>
        {full && <p className="page-note">{t("Each value counts as one of the {count} allowed triggers.", { count: MAX_NOTIFICATION_TRIGGERS })}</p>}
        </NotificationEditorSection>
        {draft.kind !== "camera" && stateTrigger && <NotificationEditorSection value="hideTrigger" title={t("When to hide it")} icon={Timer} summary={hide ? [stateSummary(hide), Number.isFinite(hide.delayMinutes) && t("Hide after {minutes} min", { minutes: hide.delayMinutes })].filter(Boolean).join(" · ") : t("When no show condition matches")} open={openSections.includes("hideTrigger")}>
          <label className="notification-toggle"><span>{t("Use a separate hide condition")}</span><Switch aria-label={t("Use a separate hide condition")} checked={!!hide} disabled={disabled} onCheckedChange={enabled => setDraft({
            ...draft, hideTrigger: enabled ? { ...stateTrigger, operator: "eq", value: "", delayMinutes: 5 } : undefined,
          })} /></label>
          {hide && <>
            {stateFields("hideTrigger", hide, condition => setDraft({ ...draft, hideTrigger: { ...hide, ...condition } }), "The active notification stays visible until this condition starts the countdown.")}
            <label>{t("Hide after (minutes)")}<input name="hideTrigger.delayMinutes" type="number" min={0} max={1440} required disabled={disabled} value={Number.isFinite(hide.delayMinutes) ? hide.delayMinutes : ""} onChange={event => setDraft({ ...draft, hideTrigger: { ...hide, delayMinutes: event.target.valueAsNumber } })} /></label>
            <p className="page-note">{t("Use 0 to hide immediately. A new show trigger cancels the countdown.")}</p>
          </>}
        </NotificationEditorSection>}
        {(draft.kind === "camera" || notificationTriggers(draft).some(trigger => ["entity-event", "ha-event"].includes(trigger.type))) && <NotificationEditorSection value="timing" title={t("Timing")} icon={Timer} summary={t("Visible for {duration} s · Cooldown {cooldown} s", { duration: draft.durationSeconds, cooldown: draft.cooldownSeconds })} open={openSections.includes("timing")}><div className="grid gap-3 sm:grid-cols-2">
          <label>{t("Show for (seconds)")}<input name="durationSeconds" type="number" min={10} max={3600} required value={draft.durationSeconds} onChange={event => setDraft({ ...draft, durationSeconds: event.target.valueAsNumber })} /></label>
          <label>{t("Cooldown (seconds)")}<input name="cooldownSeconds" type="number" min={0} max={3600} required value={draft.cooldownSeconds} onChange={event => setDraft({ ...draft, cooldownSeconds: event.target.valueAsNumber })} /></label>
        </div></NotificationEditorSection>}
        <h3 className="notification-settings-group">{t("Board widget")}</h3>
        <NotificationEditorSection value="widget" title={t("Edit widget")} icon={PanelsTopLeft} summary={draft.widget?.title?.trim() || t("Title, short text, readings and media")} open={openSections.includes("widget")}>
          <NotificationWidgetSettings rule={draft} entities={selectable} cameras={cameras?.items ?? []} defaultWidth={notifications.defaultWidgetWidth} disabled={disabled} onChange={widget => setDraft({ ...draft, widget })} />
        </NotificationEditorSection>
        <h3 className="notification-settings-group">{t("Widget and popup")}</h3>
        <p className="page-note">{t("The popup uses these settings. The widget uses them until you choose its own content.")}</p>
        <NotificationEditorSection value="content" title={t("Notification content")} icon={MessageSquare} summary={[draft.title.trim() || t("Add a title"), t((draft.pages ?? notifications.pages) === "main" ? "All main pages" : "Today only")].join(" · ")} open={openSections.includes("content")}>
        <label>{t("Title")}<input name="title" ref={titleInput} required maxLength={100} value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} /></label>
        <label>{t("Message (optional)")}<textarea name="message" maxLength={300} rows={2} value={draft.message} onChange={event => setDraft({ ...draft, message: event.target.value })} /></label>
        <label>{t("Show on")}<select name="pages" value={draft.pages ?? notifications.pages} disabled={disabled} onChange={event => setDraft({ ...draft, pages: event.target.value as NotificationRule["pages"] })}>
          <option value="today">{t("Today only")}</option><option value="main">{t("All main pages")}</option>
        </select></label>
        <p className="page-note">{t("Main pages: Today, Calendar, Lists, School and Smart home.")}</p>
        </NotificationEditorSection>
        <NotificationEditorSection value="camera" title={t(draft.kind === "current" ? "Image" : "Camera and image")} icon={Camera} summary={selectedMedia || t(draft.kind === "camera" ? "Choose a camera" : "Optional")} open={openSections.includes("camera")}>
          <NotificationCameraSettings rule={draft} disabled={disabled} active={openSections.includes("camera")} onChange={changes => setDraft({ ...draft, ...changes })} />
        </NotificationEditorSection>
        {draft.kind === "ongoing" && <NotificationEditorSection value="progress" title={t("Progress")} icon={ChartNoAxesColumnIncreasing} summary={[t(draft.progress ? "Progress bar" : "No progress bar"), notificationEntity(entities, draft.timeLeftEntity ?? "")?.name].filter(Boolean).join(" · ")} open={openSections.includes("progress")}>
          <NotificationProgressSettings rule={draft} entities={selectable} disabled={disabled} onChange={progress => setDraft({ ...draft, progress })} />
            <EntityPicker name="timeLeftEntity" label={t("Time left sensor")} clearLabel={t("Automatic")} placeholder={t("Automatic")} entities={selectable.filter(isNotificationTimeSource)} value={draft.timeLeftEntity ?? ""} disabled={disabled} onChange={id => setDraft({ ...draft, timeLeftEntity: id || undefined })} />
        </NotificationEditorSection>}
        <NotificationEditorSection value="appearance" title={t("Icon and animation")} icon={Palette} open={openSections.includes("appearance")}>
          <NotificationIconPicker rule={draft} disabled={disabled} onChange={icon => setDraft({ ...draft, icon })} />
          {draft.kind === "ongoing" && <div className="notification-toggle"><span>{t("Animate activity icon")}</span><Switch aria-label={t("Animate activity icon")} checked={draft.animateIcon !== false} disabled={disabled} onCheckedChange={animateIcon => setDraft({ ...draft, animateIcon })} /></div>}
          <p className="page-note">{t("Icons animate in activity cards while the task is active. Reduced motion keeps them still.")}</p>
        </NotificationEditorSection>
        <h3 className="notification-settings-group">{t("Popup layout")}</h3>
        <p className="page-note">{t("Choose the detail style and where its readings appear when the widget is opened.")}</p>
        <NotificationEditorSection value="presentation" title={t("Display as")} icon={Eye} summary={t(notificationStyleLabels[draft.presentation ?? notifications.presentation])} open={openSections.includes("presentation")}>
          <NotificationStylePicker value={draft.presentation ?? notifications.presentation} disabled={disabled} onChange={presentation => setDraft({ ...draft, presentation })} />
        </NotificationEditorSection>
        <NotificationEditorSection value="readings" title={t("Entities and readings")} icon={Gauge} summary={t("Additional readings: {count}", { count: draft.detailEntities.length })} open={openSections.includes("readings")}>
            <NotificationEntitySettings rule={draft} entities={selectable} disabled={disabled} onChange={changes => setDraft({ ...draft, ...changes })} onEditUsage={editUsage} />
          </NotificationEditorSection>
        </Accordion>
        <NotificationPreview key={draft.id} editing rule={draft} presentation={notifications.presentation} />
        </div>
        {!!issues.length && <NotificationValidationErrors issues={issues} editor={editor} openSection={section => { setMobileView("setup"); setOpenSections(sections => [...new Set([...sections, section])]); }} />}
        {error && <p role="alert" className="text-destructive">{t(error)}</p>}
        <div className="form-actions"><Button type="button" variant="outline" onClick={() => setDraft(undefined)}>{t("Cancel")}</Button><Button type="submit" disabled={disabled}>{t("Save notification")}</Button></div>
      </form>}
    </DialogContent></Dialog>
    <ConfirmDialog open={!!remove} onOpenChange={open => { if (!open) setRemove(undefined); }} title={t("Delete notification?")} description={t("Delete “{name}”? This removes the rule from every screen.", { name: remove?.title ?? "" })} confirmLabel={t("Delete")} destructive disabled={disabled} onConfirm={() => setNotifications({ rules: notifications.rules.filter(rule => rule.id !== remove?.id) })} />
  </section>;
}
