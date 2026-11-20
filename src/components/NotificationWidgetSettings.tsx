import { ArrowDown, ArrowUp, Check, Plus, X } from "lucide-react";
import type { ReactNode } from "react";
import { useI18n } from "@/hooks/use-i18n";
import { isNotificationTimeSource, notificationMinutesLeft, progressNumber } from "@/lib/notifications";
import type { Entity } from "@/types/api";
import type { ConfiguredCamera } from "../../shared/cameras";
import { MAX_INLINE_WIDGET_FIELDS, MAX_WIDGET_SLOTS, notificationGridZooms, notificationWidgetSizes, widgetLineFields, type NotificationRule, type NotificationWidget, type NotificationWidgetSlot } from "../../shared/notifications";
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

function WidgetFieldControls({ slot, rule, entities, field, path, customLine, disabled, onChange }: {
  slot: NotificationWidgetSlot; rule: NotificationRule; entities: Entity[]; field: string; path: string;
  customLine: boolean; disabled: boolean; onChange: (slot: NotificationWidgetSlot) => void;
}) {
  const { message: t } = useI18n();
  const shared = slot.type === "progress" && !!rule.progress || slot.type === "remaining" && rule.kind === "ongoing";
  const sourceLabel = slot.type === "progress" ? "Percentage sensor" : slot.type === "remaining" ? "Time left sensor" : "Sensor";
  return <div className="grid min-w-0 gap-3">
    <div className="notification-widget-field">
      <label>{t("Field type")}<select data-field-type aria-label={t("{field} · type", { field })} name={`${path}.type`} value={slot.type} disabled={disabled} onChange={event => {
        const type = event.target.value as NotificationWidgetSlot["type"];
        const label = slot.type === "empty" ? {} : { name: slot.name, hideName: slot.hideName };
        if (type === "empty") onChange({ type });
        else if (type === "text") onChange({ type, text: "", ...label });
        else if (type === "reading") onChange({ type, entity: "", ...label });
        else onChange({ type, ...label });
      }}>
        {(!customLine || slot.type === "empty") && <option value="empty">{t("Empty")}</option>}
        <option value="text">{t("Free text")}</option><option value="progress">{t("Progress bar")}</option>
        <option value="reading">{t("Reading or status")}</option><option value="remaining">{t("Time remaining")}</option>
      </select></label>
      {slot.type === "text" && <label>{t("Free text")}<input name={`${path}.text`} aria-label={t("{field} · {source}", { field, source: t("Free text") })}
        maxLength={100} value={slot.text} disabled={disabled} onChange={event => onChange({ ...slot, text: event.target.value })} /></label>}
      {slot.type !== "empty" && slot.type !== "text" && <EntityPicker name={`${path}.entity`} label={t(sourceLabel)} ariaLabel={t("{field} · {source}", { field, source: t(sourceLabel) })}
        entities={entities.filter(entity => acceptsSource(slot, entity))} value={slot.entity ?? ""} disabled={disabled}
        placeholder={shared ? t("From notification") : undefined} clearLabel={shared ? t("From notification") : undefined}
        onChange={entity => onChange(slot.type === "reading" ? { ...slot, entity } : { ...slot, entity: entity || undefined })} />}
    </div>
    {slot.type !== "empty" && <div className="notification-widget-field">
      <label>{t("Field name (optional)")}<input name={`${path}.name`} aria-label={t("{field} · {source}", { field, source: t("Field name (optional)") })}
        maxLength={100} value={slot.name ?? ""} placeholder={t("Automatic")} disabled={disabled} onChange={event => onChange({ ...slot, name: event.target.value || undefined })} /></label>
      {(slot.type !== "text" || slot.name?.trim()) && <label className="notification-toggle min-h-12"><span>{t("Hide name")}</span>
        <Switch aria-label={t("{field} · {source}", { field, source: t("Hide name") })} checked={!!slot.hideName} disabled={disabled}
          onCheckedChange={hideName => onChange({ ...slot, hideName })} />
      </label>}
    </div>}
  </div>;
}

function focusWidgetField(group: HTMLElement, index: number) {
  requestAnimationFrame(() => {
    const field = group.querySelectorAll<HTMLSelectElement>("[data-field-type]")[index];
    (field ?? group.querySelector<HTMLButtonElement>("[data-add-field]"))?.focus();
  });
}

function MoveButtons<T>({ items, index, group, name, disabled, onChange }: {
  items: T[]; index: number; group: string; name: string; disabled: boolean; onChange: (items: T[]) => void;
}) {
  const { message: t } = useI18n();
  return <div className="flex shrink-0 gap-2" data-move-controls={`${group}-${index}`}>
    {([-1, 1] as const).map(direction => {
      const to = index + direction;
      const label = t(direction === -1 ? "Move {value1} up" : "Move {value1} down", { value1: name });
      return <Button key={direction} type="button" variant="ghost" size="icon" data-direction={direction}
        aria-label={label} title={label} disabled={disabled || to < 0 || to >= items.length} onClick={event => {
          const form = event.currentTarget.form;
          const reordered = [...items];
          [reordered[index], reordered[to]] = [items[to], items[index]];
          onChange(reordered);
          requestAnimationFrame(() => {
            const destination = form?.querySelector(`[data-move-controls="${group}-${to}"]`);
            const control = destination?.querySelector<HTMLButtonElement>(`[data-direction="${direction}"]:enabled`)
              ?? destination?.querySelector<HTMLButtonElement>("button:enabled");
            control?.focus();
          });
        }}>{direction === -1 ? <ArrowUp aria-hidden="true" /> : <ArrowDown aria-hidden="true" />}</Button>;
    })}
  </div>;
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
  const setFields = (index: number, fields: NotificationWidgetSlot[]) => {
    const next = fields.length > 1 ? { type: "fields" as const, fields } : fields[0] ?? { type: "empty" as const };
    update({ slots: slots.map((slot, i) => i === index ? next : slot) });
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
    {widget.slots && <><p className="page-note">{t(lines ? "Add up to three fields per line. The first field appears on the left." : "Fields appear from left to right on one row.")}</p>
      {slots.slice(0, slotCount).map((line, index) => {
        const name = t(lines ? "Line {number}" : "Field {number}", { number: index + 1 });
        const fields = widgetLineFields(line);
        const path = `widget.slots.${index}`;
        const controls = (slot: NotificationWidgetSlot, position: number, field: string) => <WidgetFieldControls
          slot={slot} field={field} path={line.type === "fields" ? `${path}.fields.${position}` : path}
          rule={rule} entities={entities} customLine={lines} disabled={disabled}
          onChange={next => setFields(index, fields.map((old, i) => i === position ? next : old))} />;
        if (!lines) return <fieldset key={index} className="notification-progress-field">
          <legend>{name}</legend>{controls(fields[0], 0, name)}
        </fieldset>;

        const largeOnly = index === MAX_WIDGET_SLOTS - 1;
        const lineFields = line.type === "empty" ? [] : fields;
        return <div role="group" key={index} className="settings-card notification-widget-line" data-line-index={index}
          aria-label={largeOnly ? `${name} · ${t("Large zoom only")}` : name}>
          <div className="notification-line-header">
            <strong>{name}{largeOnly && <small className="page-note block">{t("Large zoom only")}</small>}</strong>
            <MoveButtons group="lines" name={name} items={slots} index={index} disabled={disabled || !lineFields.length}
              onChange={slots => update({ slots })} />
          </div>
          {lineFields.map((slot, position) => {
            const field = t("Field {number}", { number: position + 1 });
            const remove = t("Remove {value1} from {value2}", { value1: field, value2: name });
            return <div key={position} className="notification-line-field">
              <div className="notification-line-field-heading"><span>{field}</span>
                <div className="flex items-center gap-2">
                  {lineFields.length > 1 && <MoveButtons group={`fields-${index}`} name={field} items={fields} index={position}
                    disabled={disabled} onChange={next => setFields(index, next)} />}
                  <Button type="button" size="icon" variant="ghost" aria-label={remove} title={remove} disabled={disabled} onClick={event => {
                    const remaining = fields.filter((_, i) => i !== position);
                    setFields(index, remaining);
                    focusWidgetField(event.currentTarget.closest("[data-line-index]"), Math.min(position, remaining.length - 1));
                  }}><X aria-hidden="true" /></Button>
                </div>
              </div>
              {controls(slot, position, lineFields.length === 1 ? name : `${name} · ${field}`)}
            </div>;
          })}
          <Button type="button" variant="outline" size="sm" className="notification-add-field" data-add-field
            disabled={disabled || lineFields.length >= MAX_INLINE_WIDGET_FIELDS} onClick={event => {
              setFields(index, [...lineFields, { type: "text", text: "" }]);
              focusWidgetField(event.currentTarget.closest("[data-line-index]"), lineFields.length);
            }}><Plus aria-hidden="true" />{t("Add field")}</Button>
        </div>;
      })}</>}
  </>;
}
