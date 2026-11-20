import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { useI18n } from "@/hooks/use-i18n";
import { isNotificationTimeSource, notificationMinutesLeft, progressNumber } from "@/lib/notifications";
import type { Entity } from "@/types/api";
import type { ConfiguredCamera } from "../../shared/cameras";
import { MAX_WIDGET_SLOTS, notificationGridZooms, notificationWidgetSizes, type NotificationRule, type NotificationWidget, type NotificationWidgetSlot } from "../../shared/notifications";
import { EntityPicker } from "./EntityPicker";
import { Button } from "./ui/button";

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
  const update = (patch: Partial<NotificationWidget>) => onChange({ ...widget, ...patch });
  const setSlot = (index: number, next: NotificationWidgetSlot) => {
    const slots = Array.from({ length: MAX_WIDGET_SLOTS }, (_, i) => i === index ? next : widget.slots?.[i] ?? { type: "empty" as const });
    update({ slots });
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
    <p className="page-note">{t("These settings apply only to the tile below the page title. Empty text fields use the notification defaults.")}</p>
    <NotificationWidgetWidthPicker value={widget.size} defaultWidth={defaultWidth} disabled={disabled} onChange={size => update({ size })} />
    <label>{t("Widget title")}<input name="widget.title" maxLength={100} value={widget.title ?? ""} disabled={disabled} onChange={event => update({ title: event.target.value })} /></label>
    <label>{t("Widget short text")}<input name="widget.text" maxLength={100} value={widget.text ?? ""} disabled={disabled} onChange={event => update({ text: event.target.value })} /></label>
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
    <label>{t("Widget fields")}<select value={widget.slots ? "custom" : "auto"} disabled={disabled}
      onChange={event => update({ slots: event.target.value === "custom" ? defaultSlots() : undefined })}>
      <option value="auto">{t("Automatic")}</option><option value="custom">{t("Choose fields")}</option>
    </select></label>
    {widget.slots && <><p className="page-note">{t("Fields appear from left to right on one row.")}</p>
      {Array.from({ length: MAX_WIDGET_SLOTS }, (_, index) => {
        const slot = widget.slots[index] ?? { type: "empty" as const };
        const field = t("Field {number}", { number: index + 1 });
        const shared = slot.type === "progress" && !!rule.progress || slot.type === "remaining" && rule.kind === "ongoing";
        const sourceLabel = slot.type === "progress" ? "Percentage sensor" : slot.type === "remaining" ? "Time left sensor" : "Sensor";
        return <fieldset key={index} className="notification-progress-field notification-widget-field">
          <legend>{field}</legend>
          <label>{t("Field type")}<select aria-label={t("{field} · type", { field })} name={`widget.slots.${index}.type`} value={slot.type} disabled={disabled} onChange={event => {
            const type = event.target.value as NotificationWidgetSlot["type"];
            setSlot(index, type === "reading" ? { type, entity: "" } : { type });
          }}>
            <option value="empty">{t("Empty")}</option><option value="progress">{t("Progress bar")}</option>
            <option value="reading">{t("Reading or status")}</option><option value="remaining">{t("Time remaining")}</option>
          </select></label>
          {slot.type !== "empty" && <EntityPicker name={`widget.slots.${index}.entity`} label={t(sourceLabel)} ariaLabel={t("{field} · {source}", { field, source: t(sourceLabel) })}
            entities={entities.filter(entity => acceptsSource(slot, entity))}
            value={slot.entity ?? ""} disabled={disabled} placeholder={shared ? t("From notification") : undefined} clearLabel={shared ? t("From notification") : undefined}
            onChange={entity => setSlot(index, slot.type === "reading" ? { type: "reading", entity } : { type: slot.type, entity: entity || undefined })} />}
        </fieldset>;
      })}</>}
  </>;
}
