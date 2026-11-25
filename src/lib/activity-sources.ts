import type { Area, Entity } from "@/types/api";
import { activityCategories, type ActivityCategory } from "../../shared/configuration";
import { activityIconCategory, activitySourceIcon, type ActivityIcon } from "./activity";
import type { MessageKey } from "./i18n";

/** Event type names, as under Settings → Activity → Event types. */
export const activityCategoryLabels: Record<ActivityCategory, MessageKey> = {
  openings: "Doors and windows", locks: "Locks", alarm: "Alarm", appliances: "Appliances", robots: "Robot vacuums and mowers",
  doorbells: "Doorbells", cameras: "Camera person detection", other: "Other changes",
};
/** Each event type's glyph, shared with the activity rows. */
export const activityCategoryIcons: Record<ActivityCategory, ActivityIcon> = {
  openings: "door", locks: "lock", alarm: "alarm", appliances: "appliance", robots: "robot", doorbells: "doorbell", cameras: "camera", other: "activity",
};

/** One row of the Activity sources table: a candidate entity, or a chosen source Home Assistant no longer reports. */
export interface ActivitySourceRow {
  /** The stable preference ID that is saved as a source. */
  id: string;
  entity?: Entity;
  name: string;
  /** The entity ID, or the saved ID's tail for a missing source. */
  detail: string;
  icon: ActivityIcon;
  /** The event type, as under Event types; missing sources have none. */
  category: ActivityCategory | "missing";
  deviceKey: string;
  device: string;
  integrationKey: string;
  integration: string;
  areaKey: string;
  area: string;
  /** Lowercase, accent-free text that the search matches. */
  search: string;
}

export type SourceGrouping = "none" | "device" | "integration" | "area" | "type";
export type SourceSortKey = "name" | "device" | "integration" | "area" | "type";
export interface SourceSort { key: SourceSortKey; direction: "ascending" | "descending" }
export interface SourceFilters {
  text: string;
  chosen: "all" | "chosen" | "unchosen";
  category: "all" | ActivityCategory | "missing";
  area: string;
  integration: string;
}
export const emptySourceFilters: SourceFilters = { text: "", chosen: "all", category: "all", area: "all", integration: "all" };
export const sourceFiltersActive = (filters: SourceFilters) => filters.text.trim() !== "" || filters.chosen !== "all" || filters.category !== "all" || filters.area !== "all" || filters.integration !== "all";

// Home Assistant reports integrations by their domain; the common ones read better by their own names.
const integrationNames: Record<string, string> = {
  zwave_js: "Z-Wave JS", zha: "ZHA", mqtt: "MQTT", esphome: "ESPHome", homekit_controller: "HomeKit Device", hue: "Philips Hue", unifiprotect: "UniFi Protect",
  xiaomi_miio: "Xiaomi Miio", tplink: "TP-Link", deconz: "deCONZ", zigbee2mqtt: "Zigbee2MQTT", mobile_app: "Mobile App",
};
/** A readable name for an integration domain such as `zwave_js` or `bosch_shc`. */
export function integrationLabel(domain: string) {
  return integrationNames[domain] ?? domain.split("_").filter(Boolean).map(word => word[0].toUpperCase() + word.slice(1)).join(" ");
}

export const normalizeSearch = (value: string, language: string) => value.toLocaleLowerCase(language).normalize("NFD").replace(/[̀-ͯ]/g, "");

export interface SourceRowLabels {
  language: string;
  /** The name the activity rows use, such as a camera's own name for its person sensor. */
  name: (entity: Entity) => string;
  unnamedDevice: string;
  missingName: string;
  category: (category: ActivityCategory | "missing") => string;
}

/** Table rows for every candidate entity, in Home Assistant's order. */
export function activitySourceRows(candidates: Entity[], areas: Pick<Area, "id" | "name">[], personSensors: ReadonlySet<string>, labels: SourceRowLabels): ActivitySourceRow[] {
  const areaNames = new Map(areas.filter(area => area.id !== "unassigned").map(area => [area.id, area.name]));
  return candidates.map((entity): ActivitySourceRow => {
    const icon = activitySourceIcon(entity, personSensors);
    const category = activityIconCategory(icon);
    const device = entity.device ? entity.device.name_by_user || entity.device.name || entity.device.model || labels.unnamedDevice : "";
    const area = areaNames.get(entity.areaId) ?? "";
    const integration = entity.integration ? integrationLabel(entity.integration) : "";
    const name = labels.name(entity);
    return {
      id: entity.preferenceId, entity, name, detail: entity.entityId, icon, category,
      deviceKey: entity.device?.id ?? "", device, integrationKey: entity.integration ?? "", integration, areaKey: area ? entity.areaId : "", area,
      search: normalizeSearch([name, entity.name, entity.entityId, device, integration, entity.integration, area, labels.category(category)].filter(Boolean).join(" "), labels.language),
    };
  });
}

/** Rows for chosen (or just unticked) sources that Home Assistant no longer reports, so they stay visible and removable. */
export function missingSourceRows(ids: Iterable<string>, known: ReadonlySet<string>, labels: SourceRowLabels): ActivitySourceRow[] {
  return [...new Set(ids)].filter(id => !known.has(id)).map((id): ActivitySourceRow => {
    const detail = id.slice(id.indexOf("|") + 1);
    return { id, name: labels.missingName, detail, icon: "activity", category: "missing", deviceKey: "", device: "", integrationKey: "", integration: "", areaKey: "", area: "",
      search: normalizeSearch(`${labels.missingName} ${detail} ${labels.category("missing")}`, labels.language) };
  });
}

/** Rows matching the filters. `kept` rows stay through the chosen filter, so ticking one does not make it vanish under the pointer. */
export function filterSourceRows(rows: ActivitySourceRow[], filters: SourceFilters, chosen: ReadonlySet<string>, kept: ReadonlySet<string>, language: string) {
  const terms = normalizeSearch(filters.text, language).trim().split(/\s+/).filter(Boolean);
  return rows.filter(row => (filters.chosen === "all" || kept.has(row.id) || (filters.chosen === "chosen") === chosen.has(row.id))
    && (filters.category === "all" || row.category === filters.category)
    && (filters.area === "all" || row.areaKey === filters.area)
    && (filters.integration === "all" || row.integrationKey === filters.integration)
    && terms.every(term => row.search.includes(term)));
}

const typeRank = (category: ActivitySourceRow["category"]) => category === "missing" ? activityCategories.length : activityCategories.indexOf(category);
const sortText = (row: ActivitySourceRow, key: Exclude<SourceSortKey, "type">) => row[key];

/** Sorted rows; empty values sort last in either direction, then rows fall back to name and ID. */
export function sortSourceRows(rows: ActivitySourceRow[], sort: SourceSort, language: string) {
  const collator = new Intl.Collator(language, { sensitivity: "base", numeric: true });
  const sign = sort.direction === "ascending" ? 1 : -1;
  const byName = (a: ActivitySourceRow, b: ActivitySourceRow) => collator.compare(a.name, b.name) || collator.compare(a.detail, b.detail);
  return [...rows].sort((a, b) => {
    if (sort.key === "type") return sign * (typeRank(a.category) - typeRank(b.category)) || byName(a, b);
    if (sort.key === "name") return sign * byName(a, b);
    const left = sortText(a, sort.key), right = sortText(b, sort.key);
    if (!left !== !right) return left ? -1 : 1;
    return sign * collator.compare(left, right) || byName(a, b);
  });
}

export interface SourceGroup { key: string; label: string; rows: ActivitySourceRow[]; category?: ActivitySourceRow["category"]; empty?: boolean }

/** Sorted rows split into groups: types in the Event types order, other groupings by name with the unassigned group last. */
export function groupSourceRows(rows: ActivitySourceRow[], grouping: SourceGrouping, language: string, labels: { category: (category: ActivitySourceRow["category"]) => string; noDevice: string; noIntegration: string; noArea: string }): SourceGroup[] {
  if (grouping === "none") return [{ key: "all", label: "", rows }];
  const groups = new Map<string, SourceGroup>();
  for (const row of rows) {
    const key = grouping === "type" ? row.category : grouping === "device" ? row.deviceKey : grouping === "integration" ? row.integrationKey : row.areaKey;
    let group = groups.get(key);
    if (!group) {
      const label = grouping === "type" ? labels.category(row.category) : grouping === "device" ? row.device || labels.noDevice : grouping === "integration" ? row.integration || labels.noIntegration : row.area || labels.noArea;
      groups.set(key, group = { key, label, rows: [], ...(grouping === "type" ? { category: row.category } : {}), empty: grouping !== "type" && !key });
    }
    group.rows.push(row);
  }
  const collator = new Intl.Collator(language, { sensitivity: "base", numeric: true });
  return [...groups.values()].sort((a, b) => grouping === "type" ? typeRank(a.category!) - typeRank(b.category!)
    : Number(!!a.empty) - Number(!!b.empty) || collator.compare(a.label, b.label) || a.key.localeCompare(b.key));
}

/** The chosen set after ticking or clearing rows, keeping the saved order and adding new sources at the end. */
export function withSources(chosen: ReadonlySet<string>, ids: Iterable<string>, on: boolean) {
  const next = new Set(chosen);
  for (const id of ids) if (on) next.add(id); else next.delete(id);
  return next;
}

export const sameSources = (a: ReadonlySet<string>, b: ReadonlySet<string>) => a.size === b.size && [...a].every(id => b.has(id));
export const sourceChanges = (a: ReadonlySet<string>, b: ReadonlySet<string>) => [...a].filter(id => !b.has(id)).length + [...b].filter(id => !a.has(id)).length;
