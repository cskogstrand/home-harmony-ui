import type { Area, Entity } from "@/types/api";
import { activityCategories, type ActivityCategory } from "../../shared/configuration";
import { activityIconCategory, activitySourceIcon, type ActivityIcon } from "./activity";
import { msg, type Message, type MessageKey } from "./i18n";

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
  /** The device's own area in Home Assistant, which its entities share unless one was moved elsewhere; "" without one. */
  deviceAreaKey: string;
  deviceArea: string;
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
    const deviceAreaKey = entity.device?.area_id ?? "", deviceArea = areaNames.get(deviceAreaKey) ?? "";
    const integration = entity.integration ? integrationLabel(entity.integration) : "";
    const name = labels.name(entity);
    return {
      id: entity.preferenceId, entity, name, detail: entity.entityId, icon, category,
      deviceKey: entity.device?.id ?? "", device, integrationKey: entity.integration ?? "", integration, areaKey: area ? entity.areaId : "", area,
      deviceAreaKey: deviceArea ? deviceAreaKey : "", deviceArea,
      search: normalizeSearch([name, entity.name, entity.entityId, device, integration, entity.integration, area, labels.category(category)].filter(Boolean).join(" "), labels.language),
    };
  });
}

/** Rows for chosen (or just unticked) sources that Home Assistant no longer reports, so they stay visible and removable. */
export function missingSourceRows(ids: Iterable<string>, known: ReadonlySet<string>, labels: SourceRowLabels): ActivitySourceRow[] {
  return [...new Set(ids)].filter(id => !known.has(id)).map((id): ActivitySourceRow => {
    const detail = id.slice(id.indexOf("|") + 1);
    return { id, name: labels.missingName, detail, icon: "activity", category: "missing", deviceKey: "", device: "", integrationKey: "", integration: "", areaKey: "", area: "", deviceAreaKey: "", deviceArea: "",
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

/** A tree level: where a source comes from, or its event type. */
export type SourceLevel = Exclude<SourceGrouping, "none">;
const innerLevels: SourceLevel[] = ["integration", "device", "type"];
/**
 * The tree's levels, outermost first: the chosen level, then integration → device → type without repeating it. Area adds a
 * level in front of the full path; "none" is a flat list.
 */
export function sourceLevels(grouping: SourceGrouping): SourceLevel[] {
  return grouping === "none" ? [] : [grouping, ...innerLevels.filter(level => level !== grouping)];
}

export interface SourceTreeLabels { category: (category: ActivitySourceRow["category"]) => string; noDevice: string; noIntegration: string; noArea: string }
/** One level's group as its row shows it; a merged row has several. */
export interface SourceTreePart { level: SourceLevel; key: string; label: string; category?: ActivitySourceRow["category"]; empty: boolean }
export interface SourceTreeNode {
  /** The path of level keys from the root, stable while the grouping stays, so folds survive sorting and filtering. */
  key: string;
  /** The group, followed by any single-child levels merged into it. */
  parts: SourceTreePart[];
  /** Every row below this node, in the sorted order. */
  rows: ActivitySourceRow[];
  /** Groups one level down; empty at the last level, where the rows themselves are the children. */
  children: SourceTreeNode[];
}

const levelKey = (row: ActivitySourceRow, level: SourceLevel) => level === "type" ? row.category : level === "device" ? row.deviceKey : level === "integration" ? row.integrationKey : row.areaKey;
const levelLabel = (row: ActivitySourceRow, level: SourceLevel, labels: SourceTreeLabels) => level === "type" ? labels.category(row.category)
  : level === "device" ? row.device || labels.noDevice : level === "integration" ? row.integration || labels.noIntegration : row.area || labels.noArea;

/**
 * Sorted rows as a tree of groups. Types keep the Event types order; other groups sort by name with the unassigned group
 * last, and rows keep the sort inside their group. With `merge`, a group whose only child is one group shares its row with
 * that child (and so on down), so a device with one event type is one row, never two.
 */
export function buildSourceTree(rows: ActivitySourceRow[], grouping: SourceGrouping, language: string, labels: SourceTreeLabels, merge = true): SourceTreeNode[] {
  const levels = sourceLevels(grouping);
  const collator = new Intl.Collator(language, { sensitivity: "base", numeric: true });
  const build = (rows: ActivitySourceRow[], depth: number, parent: string): SourceTreeNode[] => {
    const level = levels[depth];
    const groups = new Map<string, { part: SourceTreePart; rows: ActivitySourceRow[] }>();
    for (const row of rows) {
      const key = levelKey(row, level);
      let group = groups.get(key);
      if (!group) groups.set(key, group = { part: { level, key, label: levelLabel(row, level, labels), ...(level === "type" ? { category: row.category } : {}), empty: level !== "type" && !key }, rows: [] });
      group.rows.push(row);
    }
    return [...groups.values()]
      .sort(({ part: a }, { part: b }) => level === "type" ? typeRank(a.category!) - typeRank(b.category!)
        : Number(a.empty) - Number(b.empty) || collator.compare(a.label, b.label) || a.key.localeCompare(b.key))
      .map(({ part, rows }) => {
        const key = `${parent}/${level}:${part.key}`;
        const children = depth + 1 < levels.length ? build(rows, depth + 1, key) : [];
        // Children are built (and merged) first, so one step folds a whole chain of single children.
        if (merge && children.length === 1) return { key: children[0].key, parts: [part, ...children[0].parts], rows, children: children[0].children };
        return { key, parts: [part], rows, children };
      });
  };
  return levels.length ? build(rows, 0, "") : [];
}

/** The chosen set after ticking or clearing rows, keeping the saved order and adding new sources at the end. */
export function withSources(chosen: ReadonlySet<string>, ids: Iterable<string>, on: boolean) {
  const next = new Set(chosen);
  for (const id of ids) if (on) next.add(id); else next.delete(id);
  return next;
}

export const sameSources = (a: ReadonlySet<string>, b: ReadonlySet<string>) => a.size === b.size && [...a].every(id => b.has(id));
export const sourceChanges = (a: ReadonlySet<string>, b: ReadonlySet<string>) => [...a].filter(id => !b.has(id)).length + [...b].filter(id => !a.has(id)).length;

/**
 * How the chosen sources split by event type, in the Event types order with unavailable sources last: the settings card's
 * summary. Types with nothing chosen are left out.
 */
export function chosenSourceSummary(candidates: Entity[], chosen: Iterable<string>, personSensors: ReadonlySet<string>) {
  const categories = new Map(candidates.map(entity => [entity.preferenceId, activityIconCategory(activitySourceIcon(entity, personSensors))]));
  const counts = new Map<ActivitySourceRow["category"], number>();
  for (const id of new Set(chosen)) {
    const category = categories.get(id) ?? "missing";
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  return [...activityCategories, "missing" as const].filter(category => counts.has(category)).map(category => ({ category, count: counts.get(category)! }));
}

/** The confirmation's description: how many changes to Activity sources leaving would lose. */
export const unsavedSourcesDescription = (changes: number): Message => changes
  ? msg(changes === 1 ? "1 change to Activity sources is not saved. Keep editing to save it, or discard it and leave." : "{count} changes to Activity sources are not saved. Keep editing to save them, or discard them and leave.", { count: changes })
  : "Your changes to Activity sources are not saved. Keep editing to save them, or discard them and leave.";

const allColumns: SourceSortKey[] = ["name", "device", "integration", "area", "type"];
/**
 * The table's columns. A flat list shows them all; in a tree a column is left out when a level above already says it, so
 * under integration → device → type a source shows its name and, where it differs from its device, its area.
 */
export function sourceColumns(grouping: SourceGrouping): SourceSortKey[] {
  const levels: readonly string[] = sourceLevels(grouping);
  return grouping === "none" ? allColumns : allColumns.filter(key => key === "name" || !levels.includes(key));
}

/**
 * A source's name inside its device's group, without the device name in front ("Front door" under "Hallway sensor"). The
 * name stays whole when it does not start with the device name followed by a space or punctuation, or nothing is left.
 */
export function nameInDevice(name: string, device: string, language: string) {
  if (!device || name.length <= device.length || !name.toLocaleLowerCase(language).startsWith(device.toLocaleLowerCase(language))) return name;
  const rest = name.slice(device.length).replace(/^[\s:,.·–—-]+/u, "");
  return rest && rest.length < name.length - device.length ? rest : name;
}

/**
 * The one area a group row shows for everything below it: on a device's row, the device's own area from Home Assistant;
 * otherwise (or for a device without one) the area all its sources share, "" when that is none. Undefined when they differ.
 */
export function groupArea(rows: readonly ActivitySourceRow[], device: boolean): { key: string; label: string } | undefined {
  const [first] = rows;
  if (!first) return undefined;
  if (device && first.deviceKey && first.deviceAreaKey && rows.every(row => row.deviceKey === first.deviceKey)) return { key: first.deviceAreaKey, label: first.deviceArea };
  return rows.every(row => row.areaKey === first.areaKey) ? { key: first.areaKey, label: first.area } : undefined;
}

/** An entity ID cut for a one-line display: the start that may be shortened, and its last word, which always shows. */
export function entityIdParts(id: string): [string, string] {
  if (id.length <= 24) return [id, ""];
  const cut = id.slice(id.length - 16).search(/[._]/);
  const at = cut < 0 ? id.length - 10 : id.length - 16 + cut;
  return [id.slice(0, at), id.slice(at)];
}
