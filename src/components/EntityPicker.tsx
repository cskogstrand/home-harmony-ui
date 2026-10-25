import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ArrowLeft, Check, ChevronDown, ChevronRight, Layers, Search, X } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useI18n } from "@/hooks/use-i18n";
import type { Entity } from "@/types/api";
import { DeviceIcon } from "./devices/DeviceControl";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Input } from "./ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import "./entity-picker.css";

type EntityPickerProps = {
  entities: Entity[];
  label: string;
  ariaLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  hideLabel?: boolean;
  describedBy?: string;
  className?: string;
  groupByDevice?: boolean;
  getLabel?: (entity: Entity) => string;
  getDescription?: (entity: Entity) => string;
  disabledReason?: (entity: Entity) => string;
  missingLabel?: (id: string) => string;
} & ({ multiple?: false; value: string; onChange: (value: string) => void; clearLabel?: string }
  | { multiple: true; value: string[]; onChange: (value: string[]) => void; clearLabel?: never });

export function EntityPicker(props: EntityPickerProps) {
  const { entities, label, ariaLabel = label, disabled, getLabel = entity => entity.name, getDescription, disabledReason } = props;
  const { currentHome } = useApp();
  const { message: t, language } = useI18n();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [device, setDevice] = useState<string | undefined>();
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const selected = props.multiple === true ? props.value : props.value ? [props.value] : [];
  const missingLabel = props.missingLabel ?? ((value: string) => `${t("Entity unavailable")} · ${value.slice(value.indexOf("|") + 1)}`);
  const areaName = (entity: Entity) => currentHome.areas.find(area => area.id === entity.areaId && area.id !== "unassigned")?.name ?? "";
  const deviceName = (entity: Entity) => entity.device?.name_by_user || entity.device?.name || entity.device?.model || t("Unnamed device");
  const sorted = useMemo(() => [...entities].sort((a, b) => a.name.localeCompare(b.name, language)), [entities, language]);
  const devices = new Map<string, Entity[]>();
  for (const entity of sorted) if (entity.device) {
    const members = devices.get(entity.device.id);
    if (members) members.push(entity); else devices.set(entity.device.id, [entity]);
  }
  const normalize = (value: string) => value.toLocaleLowerCase(language).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const terms = normalize(search).trim().split(/\s+/).filter(Boolean);
  const matches = (value: string) => terms.every(term => normalize(value).includes(term));
  const matching = sorted.filter(entity => (device === undefined || device === "all" || (device === "none" ? !entity.device : entity.device?.id === device))
    && matches([getLabel(entity), entity.name, entity.entityId, entity.domain, entity.device && deviceName(entity), areaName(entity), entity.integration].filter(Boolean).join(" ")));
  const missing = selected.filter(value => !entities.some(entity => entity.preferenceId === value) && matches(missingLabel(value)));
  const browsingDevices = props.groupByDevice !== false && device === undefined && devices.size > 0;
  const matchingIds = new Set(matching.map(entity => entity.preferenceId));
  const deviceChoices = [...devices.entries()].filter(([, members]) => members.some(entity => matchingIds.has(entity.preferenceId)))
    .sort(([, a], [, b]) => deviceName(a[0]).localeCompare(deviceName(b[0]), language));
  const pickDevice = (value: string | undefined) => { setDevice(value); setSearch(""); if (list.current) list.current.scrollTop = 0; input.current?.focus(); };
  const entityCount = (count: number) => t(count === 1 ? "1 entity" : "{count} entities", { count });
  const choose = (value: string) => {
    if (disabled) return;
    if (props.multiple === true) props.onChange(selected.includes(value) ? selected.filter(id => id !== value) : [...selected, value]);
    else { props.onChange(value); setOpen(false); }
  };
  const moveFocus = (event: KeyboardEvent) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) || event.currentTarget === input.current && !event.key.startsWith("Arrow")) return;
    const options = Array.from(list.current?.querySelectorAll<HTMLElement>("[data-picker-option]:not(:disabled)") ?? []);
    if (!options.length) return;
    event.preventDefault();
    const index = options.indexOf(document.activeElement as HTMLElement);
    const next = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : index < 0 ? (event.key === "ArrowDown" ? 0 : options.length - 1) : (index + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length;
    options[next].focus();
  };
  const selectionNames = selected.map(value => { const entity = entities.find(entity => entity.preferenceId === value); return entity ? getLabel(entity) : missingLabel(value); });
  const renderEntity = (value: string, entity?: Entity) => {
    const name = entity ? getLabel(entity) : missingLabel(value);
    const reason = entity && disabledReason?.(entity);
    const checked = selected.includes(value);
    const descriptionId = entity ? `${id}-${entity.entityId}` : undefined;
    const content = <><DeviceIcon type={entity?.domain ?? "sensor"} deviceClass={entity?.attributes.device_class} className="h-5 w-5 shrink-0 text-muted-foreground" /><span className="entity-picker-copy"><strong>{name}</strong>{entity && <small>{[entity.device && deviceName(entity), areaName(entity)].filter(Boolean).join(" · ")}</small>}{entity && <small id={descriptionId} className="entity-picker-id">{entity.entityId}</small>}{(reason || entity && getDescription?.(entity)) && <small>{reason || getDescription?.(entity)}</small>}</span></>;
    return <li key={value}>{props.multiple ? <label className={`entity-picker-option${reason || disabled ? " is-disabled" : ""}`}>
      {content}<Checkbox data-picker-option checked={checked} disabled={disabled || !!reason} aria-label={name} aria-describedby={descriptionId} onCheckedChange={() => choose(value)} />
    </label> : <button type="button" data-picker-option className="entity-picker-option" disabled={disabled || !!reason || !entity} aria-label={entity ? `${name} · ${entity.entityId}` : name} onClick={() => choose(value)}>
      {content}{checked && <Check size={18} className="shrink-0 text-primary" aria-hidden="true" />}
    </button>}</li>;
  };
  return <div className={`entity-picker ${props.className ?? ""}`}>
    {!props.hideLabel && <label htmlFor={id}>{label}</label>}
    {/* Let the portaled results own their scroll lock inside a parent dialog. */}
    <Popover modal open={open} onOpenChange={value => { setOpen(value); if (value) { setSearch(""); setDevice(undefined); } }}>
      <PopoverTrigger asChild><Button id={id} type="button" variant="outline" disabled={disabled} aria-label={ariaLabel} aria-describedby={[props.describedBy, `${id}-selection`].filter(Boolean).join(" ")} className="entity-picker-trigger">
        <span id={`${id}-selection`}>{selectionNames.length > 2 ? t("{count} selected", { count: selectionNames.length }) : selectionNames.length ? selectionNames.join(", ") : props.placeholder ?? t("Choose an entity")}</span><ChevronDown size={16} className="shrink-0" aria-hidden="true" />
      </Button></PopoverTrigger>
      <PopoverContent align="start" collisionPadding={12} className="entity-picker-popover" aria-label={ariaLabel} onOpenAutoFocus={event => { event.preventDefault(); input.current?.focus(); }}>
        <div className="entity-picker-search"><Search size={18} aria-hidden="true" /><Input ref={input} type="search" aria-label={t("Search devices and entities")} placeholder={t("Search names, IDs, rooms or integrations…")} value={search} onChange={event => { setSearch(event.target.value); if (list.current) list.current.scrollTop = 0; }} onKeyDown={moveFocus} /></div>
        <div className="entity-picker-heading">{props.groupByDevice !== false && !browsingDevices && devices.size > 0 && <Button type="button" variant="ghost" size="icon" aria-label={t("Back to devices")} onClick={() => pickDevice(undefined)}><ArrowLeft size={18} aria-hidden="true" /></Button>}
          <strong>{browsingDevices ? t("Choose a device") : device === "none" ? t("Without a device") : device && devices.has(device) ? deviceName(devices.get(device)[0]) : t("All entities")}</strong>
        </div>
        <ul ref={list} className="entity-picker-options" onKeyDown={moveFocus}>
          {browsingDevices && <>
            <li><button type="button" data-picker-option className="entity-picker-option" onClick={() => pickDevice("all")}><Layers size={20} aria-hidden="true" /><span className="entity-picker-copy"><strong>{t("All entities")}</strong><small>{entityCount(entities.length)}</small></span><ChevronRight size={16} aria-hidden="true" /></button></li>
            {sorted.some(entity => !entity.device) && <li><button type="button" data-picker-option className="entity-picker-option" onClick={() => pickDevice("none")}><Layers size={20} aria-hidden="true" /><span className="entity-picker-copy"><strong>{t("Without a device")}</strong><small>{t("Helpers, calendars and other standalone entities")}</small></span><ChevronRight size={16} aria-hidden="true" /></button></li>}
            {deviceChoices.map(([key, members]) => <li key={key}><button type="button" data-picker-option className="entity-picker-option" aria-label={t("Choose device {name}", { name: deviceName(members[0]) })} onClick={() => pickDevice(key)}><DeviceIcon type={members[0].domain} className="h-5 w-5 shrink-0 text-muted-foreground" /><span className="entity-picker-copy"><strong>{deviceName(members[0])}</strong><small>{[...new Set(members.map(areaName).filter(Boolean)), entityCount(members.length)].join(" · ")}</small></span><ChevronRight size={16} aria-hidden="true" /></button></li>)}
          </>}
          {(!browsingDevices || terms.length > 0) && matching.map(entity => renderEntity(entity.preferenceId, entity))}
          {missing.map(value => renderEntity(value))}
          {!matching.length && !missing.length && <li className="entity-picker-empty">{entities.length ? t("No matching entities. Change or clear the filters.") : t("No entities available.")}</li>}
        </ul>
        <div className="entity-picker-footer"><span role="status">{props.multiple ? t("{count} selected", { count: selected.length }) : t(matching.length === 1 ? "1 matching entity" : "{count} matching entities", { count: matching.length })}</span>
          {props.clearLabel && <Button type="button" variant="ghost" disabled={disabled} onClick={() => choose("")}><X size={16} aria-hidden="true" />{props.clearLabel}</Button>}
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>{t(props.multiple ? "Done" : "Close")}</Button>
        </div>
      </PopoverContent>
    </Popover>
  </div>;
}
