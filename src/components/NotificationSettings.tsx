import { useRef, useState } from "react";
import { Bell, Camera, ChartNoAxesColumnIncreasing, Gauge, ListChecks, MessageSquare, Palette, Eye, Plus, Timer, Zap } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { newPlannerId, useFamily } from "@/contexts/FamilyContext";
import { useSharedConfiguration } from "@/contexts/SharedConfigurationContext";
import { useI18n } from "@/hooks/use-i18n";
import { notificationEntity, notificationReadings } from "@/lib/notifications";
import { notificationRuleSchema, type NotificationRule, type NotificationTrigger } from "../../shared/notifications";
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
import { NotificationStylePicker } from "./NotificationStylePicker";
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

export function NotificationSettings() {
  const { message: t } = useI18n();
  const { notifications, setNotifications } = useFamily();
  const { currentHome, homeOnline } = useApp();
  const shared = useSharedConfiguration();
  const disabled = !shared?.state.loaded || !!shared.state.error;
  const [draft, setDraft] = useState<NotificationRule>();
  const [openSections, setOpenSections] = useState(["content", "trigger"]);
  const [previewId, setPreviewId] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [original, setOriginal] = useState("");
  const [filters, setFilters] = useState("{}");
  const [error, setError] = useState("");
  const [remove, setRemove] = useState<NotificationRule>();
  const editor = useRef<HTMLFormElement>(null);
  const editUsage = (section: "trigger" | "progress" | "readings") => {
    setOpenSections(sections => [...new Set([...sections, section])]);
    editor.current?.querySelector<HTMLButtonElement>(`[data-section="${section}"] > h3 > button`)?.focus();
  };
  const entities = currentHome.entities;
  const selectable = entities.filter(entity => !(entity.domain === "input_text" && entity.attributes.mode === "password"));
  const begin = (rule: NotificationRule, existing = false) => {
    setOpenSections(["content", "trigger"]);
    setDraft(rule); setPreviewId(rule.id); setOriginal(existing ? JSON.stringify(rule) : ""); setError("");
    setFilters(rule.trigger.type === "ha-event" ? JSON.stringify(rule.trigger.filters, null, 2) : "{}");
  };
  const selectEntity = (label: string, value: string, update: (id: string) => void, domain?: string) => {
    const choices = selectable.filter(entity => !domain || entity.domain === domain);
    return <EntityPicker label={t(label)} entities={choices} value={value} onChange={update} disabled={disabled} />;
  };
  const save = () => {
    const current = notifications.rules.find(rule => rule.id === draft.id);
    if (original && JSON.stringify(current) !== original) { setError("This rule changed on another screen. Cancel and reopen it before saving."); return; }
    let trigger = draft.trigger;
    if (trigger.type === "ha-event") {
      try { trigger = { ...trigger, filters: JSON.parse(filters) }; }
      catch { setOpenSections(sections => [...new Set([...sections, "trigger"])]); setError("Event filters must be a JSON object, for example {\"action\":\"single\"}."); return; }
    }
    const readings = notificationReadings(draft);
    const result = notificationRuleSchema.safeParse({ ...draft, trigger, ...(draft.entityDisplay && { entityDisplay: draft.entityDisplay.filter(item => readings.some(reading => reading.entity === item.entity && reading.attribute === item.attribute)) }) });
    if (!result.success) {
      const sectionForField = { title: "content", message: "content", trigger: "trigger", cameraEntity: "readings", detailEntities: "readings", progress: "progress", entityDisplay: "readings", icon: "appearance", animateIcon: "appearance", durationSeconds: "timing", cooldownSeconds: "timing" };
      setOpenSections(sections => [...new Set([...sections, ...result.error.issues.map(issue => sectionForField[issue.path[0]] ?? "content")])]);
      setError(result.error.issues.some(issue => issue.path[0] === "progress") ? "Check progress: choose numeric sources and different start and end values." : "Check the title, trigger, camera and numeric values. Event filters must contain at most 10 text, number or boolean fields."); return; }
    const rules = current ? notifications.rules.map(rule => rule.id === draft.id ? result.data : rule) : [...notifications.rules, result.data];
    if (setNotifications({ rules })) setDraft(undefined);
    else setError("The rule could not be saved. Your draft is still here. Check settings storage and retry.");
  };
  const source = draft && "entity" in draft.trigger ? notificationEntity(entities, draft.trigger.entity) : undefined;
  return <section className="glow-panel" id="notifications">
    <PanelHeading icon={Bell} title={t("Notifications")} to="/notifications" label={t("View notifications")} />
    <p className="page-note">{t("Keep track of running tasks, current events and camera alerts while Home Harmony is open. Rules are shared across screens; dismissals apply to this screen.")}</p>
    <label className="my-4 flex items-center justify-between gap-4"><span>{t("Enable notifications")}</span><Switch aria-label={t("Enable notifications")} checked={notifications.enabled} disabled={disabled} onCheckedChange={enabled => setNotifications({ enabled })} /></label>
    <NotificationStylePicker value={notifications.presentation} disabled={disabled} onChange={presentation => setNotifications({ presentation })} />
    <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
    <div className="notification-settings-toolbar">
      <div className="planner-form"><label>{t("Show on")}<select value={notifications.pages} disabled={disabled} onChange={event => setNotifications({ pages: event.target.value as typeof notifications.pages })}>
        <option value="today">{t("Today only")}</option><option value="main">{t("All main pages")}</option>
      </select></label></div>
      <DialogTrigger asChild><Button variant="outline"><Eye size={18} aria-hidden="true" />{t("Preview notification")}</Button></DialogTrigger>
    </div>
    <p className="page-note">{t("Main pages: Today, Calendar, Lists, School and Smart home.")}</p>
    <DialogContent className="notification-preview-dialog">
      <DialogHeader><DialogTitle>{t("Preview notification")}</DialogTitle><DialogDescription>{t("Choose a saved notification or try the example with sample data.")}</DialogDescription></DialogHeader>
      <div className="planner-form"><label>{t("Preview notification")}<select value={notifications.rules.some(rule => rule.id === previewId) ? previewId : ""} onChange={event => setPreviewId(event.target.value)}>
        <option value="">{t("Example task")}</option>{notifications.rules.map(rule => <option key={rule.id} value={rule.id}>{rule.title}</option>)}
      </select></label></div>
      <NotificationPreview key={previewId} rule={notifications.rules.find(rule => rule.id === previewId)} presentation={notifications.presentation} />
    </DialogContent></Dialog>
    {!homeOnline && <p role="status" className="page-note">{t("Notifications are paused until Home Assistant reconnects.")}</p>}
    {(Object.keys(kinds) as NotificationRule["kind"][]).map(kind => {
      const rules = notifications.rules.filter(rule => rule.kind === kind);
      const Icon = icons[kind];
      return <section key={kind} className="notification-rule-group" aria-label={t(kinds[kind])}>
      <div className="notification-rule-group-heading"><PanelTitle as="h3" icon={Icon}>{t(kinds[kind])}</PanelTitle>
        <Button variant="outline" disabled={disabled || notifications.rules.length >= 100} aria-label={t("Add {kind}", { kind: t(kinds[kind]) })} onClick={() => begin({ id: newPlannerId(), title: "", message: "", kind, enabled: true, trigger: newTrigger("state"), detailEntities: [], cameraEntity: "", durationSeconds: 60, cooldownSeconds: 10 })}><Plus size={18} aria-hidden="true" />{t("Add notification")}</Button>
      </div>
      {!rules.length && <p className="page-note">{t("No notifications in this group yet.")}</p>}
      <ul className="divide-y">{rules.map(rule => {
      const source = "entity" in rule.trigger ? notificationEntity(entities, rule.trigger.entity) : undefined;
      const Icon = icons[rule.kind];
      const missing = ("entity" in rule.trigger && !source) || (rule.kind === "camera" && notificationEntity(entities, rule.cameraEntity)?.domain !== "camera");
      return <li key={rule.id} className="flex flex-wrap items-center gap-3 py-3">
        <Icon size={20} aria-hidden="true" /><div className="min-w-0 flex-1 basis-[calc(100%-40px)] break-words sm:basis-0"><strong>{rule.title}</strong><p className="text-sm text-muted-foreground">{t(kinds[rule.kind])} · {notificationReadings(rule).find(reading => reading.roles.includes("Source entity"))?.name || source?.name || (rule.trigger.type === "ha-event" ? rule.trigger.eventType : t("Entity unavailable"))}</p>{missing && <p className="text-sm text-warning">{t("A selected entity is unavailable. Edit this rule to choose a replacement.")}</p>}</div>
        <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
        <Switch aria-label={t("Enable {name}", { name: rule.title })} checked={rule.enabled} disabled={disabled} onCheckedChange={enabled => setNotifications({ rules: notifications.rules.map(item => item.id === rule.id ? { ...item, enabled } : item) })} />
        <Button variant="ghost" disabled={disabled} onClick={() => begin(rule, true)} aria-label={t("Edit {name}", { name: rule.title })}>{t("Edit")}</Button>
        <Button variant="ghost" disabled={disabled} onClick={() => setRemove(rule)} aria-label={t("Delete {name}", { name: rule.title })}>{t("Delete")}</Button>
        </div>
      </li>;
    })}</ul></section>;
    })}
    <Dialog open={!!draft} onOpenChange={open => { if (!open) setDraft(undefined); }}><DialogContent className="notification-editor">
      <DialogHeader><DialogTitle>{t(original ? "Edit notification" : "Add notification")}</DialogTitle><DialogDescription>{t(draft ? kinds[draft.kind] : "Notifications")}</DialogDescription></DialogHeader>
      {draft && <form ref={editor} className="planner-form notification-editor-form" onSubmit={event => { event.preventDefault(); save(); }}>
        <div className="notification-editor-layout">
        <Accordion type="multiple" value={openSections} onValueChange={setOpenSections} className="notification-editor-fields">
        <NotificationEditorSection value="content" title={t("Notification content")} icon={MessageSquare} open={openSections.includes("content")}>
        <label>{t("Title")}<input required maxLength={100} value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} /></label>
        <label>{t("Message (optional)")}<textarea maxLength={300} rows={2} value={draft.message} onChange={event => setDraft({ ...draft, message: event.target.value })} /></label>
        </NotificationEditorSection>
        <NotificationEditorSection value="trigger" title={t("When to show it")} icon={Zap} open={openSections.includes("trigger")}>
        <label>{t("Trigger")}<select value={draft.trigger.type} onChange={event => { setDraft({ ...draft, trigger: newTrigger(event.target.value as NotificationTrigger["type"]) }); setFilters("{}"); }}>
          <option value="state">{t("Entity state")}</option>
          {draft.kind !== "ongoing" && <><option value="entity-event">{t("Event entity")}</option><option value="ha-event">{t("Home Assistant event")}</option></>}
          {draft.kind === "current" && <option value="calendar">{t("Calendar event")}</option>}
        </select></label>
        {"entity" in draft.trigger && selectEntity("Source entity", draft.trigger.entity, entity => setDraft({ ...draft, trigger: { ...draft.trigger, entity } as NotificationTrigger }), draft.trigger.type === "calendar" ? "calendar" : draft.trigger.type === "entity-event" ? "event" : undefined)}
        {draft.trigger.type === "state" && <>
          <p className="page-note">{t("Shown while the condition matches. Camera popups open only when it becomes true.")}{source && <> {t("Reported state: {state}", { state: source.attributes.mode === "password" ? "••••••" : source.state })}</>}</p>
          <label>{t("Attribute (optional)")}<input maxLength={100} value={draft.trigger.attribute} placeholder={t("Leave empty to use the state")} onChange={event => setDraft({ ...draft, trigger: { ...draft.trigger, attribute: event.target.value } as NotificationTrigger })} /></label>
          <div className="grid gap-3 sm:grid-cols-2"><label>{t("Condition")}<select value={draft.trigger.operator} onChange={event => setDraft({ ...draft, trigger: { ...draft.trigger, operator: event.target.value } as NotificationTrigger })}>
            <option value="eq">{t("Equals")}</option><option value="neq">{t("Does not equal")}</option><option value="gt">{t("Above")}</option><option value="lt">{t("Below")}</option>
          </select></label><label>{t("Value")}<input required maxLength={256} value={draft.trigger.value} onChange={event => setDraft({ ...draft, trigger: { ...draft.trigger, value: event.target.value } as NotificationTrigger })} /></label></div>
        </>}
        {(draft.trigger.type === "entity-event" || draft.trigger.type === "ha-event") && <label>{t(draft.trigger.type === "entity-event" ? "Event type (optional)" : "Event type")}<input required={draft.trigger.type === "ha-event"} maxLength={100} value={draft.trigger.eventType} onChange={event => setDraft({ ...draft, trigger: { ...draft.trigger, eventType: event.target.value } as NotificationTrigger })} /></label>}
        {draft.trigger.type === "entity-event" && <p className="page-note">{t("Triggers on a new event timestamp. Leave the event type empty to match every event from this entity.")}</p>}
        {draft.trigger.type === "ha-event" && <label>{t("Event data filters (JSON)")}<textarea rows={3} value={filters} maxLength={8000} onChange={event => setFilters(event.target.value)} /><span className="page-note">{t("Match exact top-level fields, such as action or device_id. Empty filters match every event of this type.")}</span></label>}
        {draft.trigger.type === "calendar" && <label>{t("Show minutes before start")}<input type="number" min={0} max={1440} required value={draft.trigger.leadMinutes} onChange={event => setDraft({ ...draft, trigger: { ...draft.trigger, leadMinutes: event.target.valueAsNumber } as NotificationTrigger })} /></label>}
        </NotificationEditorSection>
        <NotificationEditorSection value="readings" title={t("Entities and readings")} icon={Gauge} open={openSections.includes("readings")}>
            <NotificationEntitySettings rule={draft} entities={selectable} disabled={disabled} onChange={changes => setDraft({ ...draft, ...changes })} onEditUsage={editUsage} />
          </NotificationEditorSection>
        {draft.kind === "ongoing" && <NotificationEditorSection value="progress" title={t("Progress")} icon={ChartNoAxesColumnIncreasing} open={openSections.includes("progress")}>
          <NotificationProgressSettings rule={draft} entities={selectable} disabled={disabled} onChange={progress => setDraft({ ...draft, progress })} />
        </NotificationEditorSection>}
        <NotificationEditorSection value="appearance" title={t("Icon and animation")} icon={Palette} open={openSections.includes("appearance")}>
          <NotificationIconPicker rule={draft} disabled={disabled} onChange={icon => setDraft({ ...draft, icon })} />
          {draft.kind === "ongoing" && <div className="notification-toggle"><span>{t("Animate activity icon")}</span><Switch aria-label={t("Animate activity icon")} checked={draft.animateIcon !== false} disabled={disabled} onCheckedChange={animateIcon => setDraft({ ...draft, animateIcon })} /></div>}
          <p className="page-note">{t("Icons animate in activity cards while the task is active. Reduced motion keeps them still.")}</p>
        </NotificationEditorSection>
        {(draft.kind === "camera" || ["entity-event", "ha-event"].includes(draft.trigger.type)) && <NotificationEditorSection value="timing" title={t("Timing")} icon={Timer} open={openSections.includes("timing")}><div className="grid gap-3 sm:grid-cols-2">
          <label>{t("Show for (seconds)")}<input type="number" min={10} max={3600} required value={draft.durationSeconds} onChange={event => setDraft({ ...draft, durationSeconds: event.target.valueAsNumber })} /></label>
          <label>{t("Cooldown (seconds)")}<input type="number" min={0} max={3600} required value={draft.cooldownSeconds} onChange={event => setDraft({ ...draft, cooldownSeconds: event.target.valueAsNumber })} /></label>
        </div></NotificationEditorSection>}
        </Accordion>
        <NotificationPreview key={draft.id} rule={draft} presentation={notifications.presentation} />
        </div>
        {error && <p role="alert" className="text-destructive">{t(error)}</p>}
        <div className="form-actions"><Button type="button" variant="outline" onClick={() => setDraft(undefined)}>{t("Cancel")}</Button><Button type="submit" disabled={disabled}>{t("Save notification")}</Button></div>
      </form>}
    </DialogContent></Dialog>
    <ConfirmDialog open={!!remove} onOpenChange={open => { if (!open) setRemove(undefined); }} title={t("Delete notification?")} description={t("Delete “{name}”? This removes the rule from every screen.", { name: remove?.title ?? "" })} confirmLabel={t("Delete")} destructive disabled={disabled} onConfirm={() => setNotifications({ rules: notifications.rules.filter(rule => rule.id !== remove?.id) })} />
  </section>;
}
