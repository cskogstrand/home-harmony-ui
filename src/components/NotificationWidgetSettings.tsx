import { ArrowDown, ArrowUp, Check } from "lucide-react";
import type { ReactNode } from "react";
import { useI18n } from "@/hooks/use-i18n";
import { isNotificationTimeSource, notificationMinutesLeft, progressNumber } from "@/lib/notifications";
import type { Entity } from "@/types/api";
import type { ConfiguredCamera } from "../../shared/cameras";
import { MAX_INLINE_WIDGET_FIELDS, MAX_WIDGET_SLOTS, notificationGridZooms, notificationWidgetSizes, type NotificationRule, type NotificationWidget, type NotificationWidgetSlot } from "../../shared/notifications";
import { EntityPicker } from "./EntityPicker";
import { Button } from "./ui/button";
import { Switch } from "./ui/switch";

const widthChoices = {
  auto: { label: "Automatic", width: 46 },
  small: { label: "1 column", width: 46 },
  medium: { label: "Up to 2 columns", width: 96 },
  large: { label: "Up to 3 columns", width: 146 },
} as const;

type WidgetWidth = typeof notificationWidgetSizes[number];

const zoomChoices = {
  small: { label: "Small", columns: 4, height: 7.5 },
  medium: { label: "Medium", columns: 3, height: 10.5 },
  large: { label: "Large", columns: 2, height: 15 },
} as const;
type GridZoom = typeof notificationGridZooms[number];

function WidgetLayoutOption({ label, selected, onClick, children }: { label: string; selected: boolean; onClick: () => void; children: ReactNode }) {
  return <Button type="button" variant="outline" className="notification-style-option" aria-pressed={selected} onClick={onClick}>
    <svg className="notification-size-example" viewBox="0 0 166 52" fill="none" aria-hidden="true">
      <path d="M8 11h34" stroke="currentColor" strokeWidth="4" strokeLinecap="round" opacity=".4" />
      {children}
    </svg>
    <span className="notification-style-label">{label}<Check aria-hidden="true" className={selected ? "" : "invisible"} /></span>
  </Button>;
}

export function NotificationGridZoomPicker({ value, disabled, onChange }: {
  value: GridZoom; disabled: boolean; onChange: (zoom: GridZoom) => void;
}) {
  const { message: t } = useI18n();
  return <fieldset className="notification-style-picker" disabled={disabled}>
    <legend className="mb-2 font-medium">{t("Widget grid zoom")}</legend>
    <p className="page-note pb-3">{t("Zoom sets the column width, row height and text size together.")}</p>
    <div className="notification-style-options notification-zoom-options">{notificationGridZooms.map(zoom => {
      const { label, columns, height } = zoomChoices[zoom];
      const width = (150 - 4 * (columns - 1)) / columns;
      return <WidgetLayoutOption key={zoom} label={t(label)} selected={zoom === value} onClick={() => onChange(zoom)}>
        {Array.from({ length: columns }, (_, index) => <g key={index} transform={`translate(${8 + index * (width + 4)} 17)`}>
          <rect width={width} height={height} rx="3" fill="currentColor" fillOpacity=".15" stroke="currentColor" />
          <line x1="4" x2={width * .6} y1={height / 2} y2={height / 2} stroke="currentColor" strokeWidth={height / 6} strokeLinecap="round" />
          <rect y={height + 3} width={width} height={height} rx="3" fill="currentColor" fillOpacity=".1" stroke="currentColor" strokeOpacity=".45" />
        </g>)}
      </WidgetLayoutOption>;
    })}</div>
  </fieldset>;
}

export function NotificationWidgetWidthPicker({ value, defaultWidth, disabled, onChange }: {
  value?: WidgetWidth; defaultWidth?: WidgetWidth; disabled: boolean; onChange: (width?: WidgetWidth) => void;
}) {
  const { message: t } = useI18n();
  return <fieldset className="notification-style-picker" disabled={disabled}>
    <legend className="mb-2 font-medium">{t(defaultWidth ? "Widget width" : "Default widget width")}</legend>
    {!defaultWidth && <p className="page-note pb-3">{t("Automatic uses one or two columns based on the content. You can override the default for each widget.")}</p>}
    {defaultWidth && <Button type="button" variant="outline" className="notification-style-option mb-3 max-w-full whitespace-normal" aria-pressed={value === undefined} onClick={() => onChange(undefined)}>
      <Check aria-hidden="true" className={value === undefined ? "" : "invisible"} />
      {t("Use default width ({width})", { width: t(widthChoices[defaultWidth].label) })}
    </Button>}
    <div className="notification-style-options">{notificationWidgetSizes.map(size => {
      const { label, width } = widthChoices[size];
      return <WidgetLayoutOption key={size} label={t(label)} selected={size === value} onClick={() => onChange(size)}>
        <path d="M9 44h44m6 0h44m6 0h44" stroke="currentColor" strokeLinecap="round" opacity=".25" />
        {size === "auto" && <path d="M54 19h47q3 0 3 3v9q0 3-3 3H54" stroke="currentColor" strokeDasharray="3 3" />}
        <rect x="8" y="19" width={width} height="15" rx="3" fill="currentColor" fillOpacity=".15" stroke="currentColor" />
        <circle cx="16" cy="26.5" r="3" fill="currentColor" />
        <g transform="translate(23 24.5)" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x2={width * .44} /><line y1="5" y2="5" x2={width * .28} />
        </g>
      </WidgetLayoutOption>;
    })}</div>
  </fieldset>;
}

function acceptsSource(slot: NotificationWidgetSlot, entity: Entity) {
  if (entity.attributes.mode === "password") return false;
  if (slot.type === "remaining") return isNotificationTimeSource(entity);
  if (slot.type !== "progress" || entity.preferenceId === slot.entity) return true;
  const unit = entity.attributes.unit_of_measurement;
  return unit === "%" || !unit && progressNumber(entity.state) !== undefined;
}

export function NotificationWidgetSettings({ rule, entities, cameras, defaultWidth, disabled, onChange }: {
  rule: NotificationRule; entities: Entity[]; cameras: ConfiguredCamera[]; defaultWidth: WidgetWidth; disabled: boolean; onChange: (value: NotificationWidget) => void;
}) {
  const { message: t } = useI18n();
  const widget = rule.widget ?? {};
  const lines = widget.slots !== undefined && widget.slotLayout === "lines";
  const slotCount = lines ? MAX_WIDGET_SLOTS : MAX_INLINE_WIDGET_FIELDS;
  const slots = Array.from({ length: Math.max(slotCount, widget.slots?.length ?? 0) }, (_, i) => widget.slots?.[i] ?? { type: "empty" as const });
  const update = (patch: Partial<NotificationWidget>) => onChange({ ...widget, ...patch });
  const setSlot = (index: number, next: NotificationWidgetSlot) => {
    update({ slots: slots.map((slot, i) => i === index ? next : slot) });
  };
  const moveLine = (index: number, direction: -1 | 1, form: HTMLFormElement | null) => {
    const to = index + direction;
    const reordered = [...slots];
    [reordered[index], reordered[to]] = [slots[to], slots[index]];
    update({ slots: reordered });
    requestAnimationFrame(() => {
      const destination = form?.querySelector(`[data-line-index="${to}"]`);
      const control = destination?.querySelector<HTMLButtonElement>(`[data-direction="${direction}"]:enabled`)
        ?? destination?.querySelector<HTMLButtonElement>("[data-direction]:enabled");
      control?.focus();
    });
  };
  const defaultSlots = (): NotificationWidgetSlot[] => {
    const slots: NotificationWidgetSlot[] = [];
    if (rule.progress) slots.push({ type: "progress" });
    if (rule.kind === "ongoing" && (rule.timeLeftEntity || notificationMinutesLeft(rule, entities, Date.now()) !== undefined)) slots.push({ type: "remaining" });
    return slots;
  };
  const media = widget.media;
  const cameraId = media && "cameraId" in media ? media.cameraId : "";
  const cameraChoices = media?.type === "person" ? cameras.filter(camera => camera.personSnapshot.type !== "none") : cameras;
  return <>
    <p className="page-note">{t("These settings apply to the widget below the page title.")}</p>
    <NotificationWidgetWidthPicker value={widget.size} defaultWidth={defaultWidth} disabled={disabled} onChange={size => update({ size })} />
    <label>{t("Widget content")}<select value={widget.slots ? widget.slotLayout ?? "columns" : "auto"} disabled={disabled}
      onChange={event => update({ slotLayout: event.target.value === "lines" ? "lines" : undefined, slots: event.target.value === "auto" ? undefined : widget.slots ?? defaultSlots() })}>
      <option value="auto">{t("Automatic")}</option><option value="lines">{t("Custom lines")}</option><option value="columns">{t("Side-by-side fields")}</option>
    </select></label>
    {!lines && <>
      <label>{t("Widget title")}<input name="widget.title" maxLength={100} value={widget.title ?? ""} disabled={disabled} onChange={event => update({ title: event.target.value })} /></label>
      <label>{t("Widget short text")}<input name="widget.text" maxLength={100} value={widget.text ?? ""} disabled={disabled} onChange={event => update({ text: event.target.value })} /></label>
    </>}
    <label>{t("Widget media")}<select name="widget.media.type" value={media?.type ?? "auto"} disabled={disabled} onChange={event => {
      const type = event.target.value;
      if (type === "live" || type === "person") update({ media: { type, cameraId: type === "live" || cameras.some(camera => camera.id === cameraId && camera.personSnapshot.type !== "none") ? cameraId : "" } });
      else if (type === "image") update({ media: { type, entity: "" } });
      else update({ media: type === "none" ? { type } : undefined });
    }}>
      <option value="auto">{t("Automatic")}</option><option value="none">{t("No media")}</option>
      <option value="live">{t("Live video")}</option><option value="person">{t("Person snapshot")}</option><option value="image">{t("Image")}</option>
    </select></label>
    {media && "cameraId" in media && <label>{t("Widget camera")}<select name="widget.media.cameraId" value={cameraId} disabled={disabled} onChange={event => update({ media: { ...media, cameraId: event.target.value } })}>
      <option value="">{t("Choose a camera")}</option>
      {cameraId && !cameraChoices.some(camera => camera.id === cameraId) && <option value={cameraId}>{t("Unavailable camera")}</option>}
      {cameraChoices.map(camera => <option key={camera.id} value={camera.id}>{camera.name}</option>)}
    </select></label>}
    {media?.type === "image" && <EntityPicker label={t("Widget image")} name="widget.media.entity" entities={entities.filter(entity => entity.domain === "image")} value={media.entity} disabled={disabled} onChange={entity => update({ media: { type: "image", entity } })} />}
    {widget.slots && <><p className="page-note">{t(lines ? "Use the arrows to change the line order." : "Fields appear from left to right on one row.")}</p>
      {slots.slice(0, slotCount).map((slot, index) => {
        const field = t(lines ? "Line {number}" : "Field {number}", { number: index + 1 });
        const largeOnly = lines && index === MAX_WIDGET_SLOTS - 1;
        const shared = slot.type === "progress" && !!rule.progress || slot.type === "remaining" && rule.kind === "ongoing";
        const sourceLabel = slot.type === "progress" ? "Percentage sensor" : slot.type === "remaining" ? "Time left sensor" : "Sensor";
        return <fieldset key={index} className="notification-progress-field notification-widget-field" data-line-index={lines ? index : undefined}
          aria-label={largeOnly ? `${field} · ${t("Large zoom only")}` : field}>
          <legend className="w-full"><span className="flex items-center justify-between gap-2">
            <span>{field}{largeOnly && <small className="page-note block">{t("Large zoom only")}</small>}</span>
            {lines && <span className="flex shrink-0 gap-1">
              {([-1, 1] as const).map(direction => {
                const label = t(direction === -1 ? "Move {value1} up" : "Move {value1} down", { value1: field });
                return <Button key={direction} type="button" variant="ghost" size="icon" data-direction={direction} aria-label={label} title={label}
                  disabled={disabled || slot.type === "empty" || index + direction < 0 || index + direction >= slotCount}
                  onClick={event => moveLine(index, direction, event.currentTarget.form)}>
                  {direction === -1 ? <ArrowUp aria-hidden="true" /> : <ArrowDown aria-hidden="true" />}
                </Button>;
              })}
            </span>}
          </span></legend>
          <label>{t("Field type")}<select aria-label={t("{field} · type", { field })} name={`widget.slots.${index}.type`} value={slot.type} disabled={disabled} onChange={event => {
            const type = event.target.value as NotificationWidgetSlot["type"];
            const hideName = "hideName" in slot ? slot.hideName : undefined;
            if (type === "text") setSlot(index, { type, text: "" });
            else if (type === "empty") setSlot(index, { type });
            else if (type === "reading") setSlot(index, { type, entity: "", hideName });
            else setSlot(index, { type, hideName });
          }}>
            <option value="empty">{t("Empty")}</option><option value="text">{t("Free text")}</option><option value="progress">{t("Progress bar")}</option>
            <option value="reading">{t("Reading or status")}</option><option value="remaining">{t("Time remaining")}</option>
          </select></label>
          {slot.type === "text" && <label>{t("Free text")}<input name={`widget.slots.${index}.text`} aria-label={t("{field} · {source}", { field, source: t("Free text") })}
            maxLength={100} value={slot.text} disabled={disabled} onChange={event => setSlot(index, { type: "text", text: event.target.value })} /></label>}
          {slot.type !== "empty" && slot.type !== "text" && <>
            <EntityPicker name={`widget.slots.${index}.entity`} label={t(sourceLabel)} ariaLabel={t("{field} · {source}", { field, source: t(sourceLabel) })}
              entities={entities.filter(entity => acceptsSource(slot, entity))}
              value={slot.entity ?? ""} disabled={disabled} placeholder={shared ? t("From notification") : undefined} clearLabel={shared ? t("From notification") : undefined}
              onChange={entity => setSlot(index, slot.type === "reading" ? { ...slot, entity } : { ...slot, entity: entity || undefined })} />
            <label className="notification-toggle col-span-full"><span>{t("Hide name")}</span>
              <Switch aria-label={t("{field} · {source}", { field, source: t("Hide name") })} checked={!!slot.hideName} disabled={disabled}
                onCheckedChange={hideName => setSlot(index, { ...slot, hideName })} />
            </label>
          </>}
        </fieldset>;
      })}</>}
  </>;
}
