import { Fragment, memo, useCallback, useDeferredValue, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, CircleAlert, Cpu, Layers, ListRestart, MapPin, Puzzle, Search, SquareCheck, SquareMinus, Tag, X } from "lucide-react";
import { useI18n } from "@/hooks/use-i18n";
import { activityIcons } from "@/components/activity-icons";
import { DeviceIcon } from "@/components/devices/DeviceControl";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { activityCategoryIcons, activityCategoryLabels, activitySourceRows, emptySourceFilters, filterSourceRows, groupSourceRows, missingSourceRows, sameSources, sortSourceRows, sourceChanges, sourceFiltersActive, withSources,
  type ActivitySourceRow, type SourceFilters, type SourceGroup, type SourceGrouping, type SourceSort, type SourceSortKey } from "@/lib/activity-sources";
import type { ActivityIcon } from "@/lib/activity";
import type { MessageKey } from "@/lib/i18n";
import type { Area, Entity } from "@/types/api";
import { activityCategories, type ActivityCategory } from "../../shared/configuration";
import "./activity-sources-table.css";

const columns: { key: SourceSortKey; label: MessageKey }[] = [
  { key: "name", label: "Name" }, { key: "device", label: "Device" }, { key: "integration", label: "Integration" }, { key: "area", label: "Area" }, { key: "type", label: "Type" },
];
const groupings: { value: SourceGrouping; label: MessageKey }[] = [
  { value: "none", label: "None" }, { value: "device", label: "Device" }, { value: "integration", label: "Integration" }, { value: "area", label: "Area" }, { value: "type", label: "Type" },
];
// Groupings with more groups than this start closed, so the first view is a scannable list of groups and counts.
const OPEN_GROUPS_UP_TO = 8;

/** The event type's icon (door, lock, robot …); other changes use the device icon. */
function SourceIcon({ entity, icon }: { entity?: Entity; icon: ActivityIcon }) {
  if (!entity) return <CircleAlert size={20} aria-hidden="true" />;
  if (icon === "activity") return <DeviceIcon type={entity.domain} deviceClass={entity.attributes.device_class} className="h-5 w-5 shrink-0" />;
  const Icon = activityIcons[icon];
  return <Icon size={20} aria-hidden="true" />;
}

type RowProps = { row: ActivitySourceRow; checked: boolean; disabled: boolean; typeLabel: string; hiddenLabel?: string; checkLabel: string; onChange: (ids: string[], on: boolean) => void };

/** One candidate: a checkbox, the name the activity rows use, and where it comes from. Memoized, so ticking one row repaints only that row. */
const SourceRow = memo(function SourceRow({ row, checked, disabled, typeLabel, hiddenLabel, checkLabel, onChange }: RowProps) {
  // On phones the cells run together as one wrapping line, each led by a small glyph that says what it is.
  const meta = [{ key: "device", value: row.device, Icon: Cpu }, { key: "integration", value: row.integration, Icon: Puzzle }, { key: "area", value: row.area, Icon: MapPin }];
  return <tr role="row" className={checked ? "is-chosen" : undefined} data-source={row.id}>
    <td role="cell" className="activity-sources-check"><Checkbox checked={checked} disabled={disabled} aria-label={checkLabel} onCheckedChange={value => onChange([row.id], value === true)} /></td>
    <th role="rowheader" scope="row" className="activity-sources-name"><span>
      <SourceIcon entity={row.entity} icon={row.icon} />
      {/* Long entity IDs may break after their dots and underscores instead of mid-word. */}
      <span className="activity-sources-copy"><strong>{row.name}</strong><small>{row.detail.split(/(?<=[._])/).map((part, index) => <Fragment key={index}>{index > 0 && <wbr />}{part}</Fragment>)}</small></span>
    </span></th>
    {meta.map(({ key, value, Icon }) => <td role="cell" key={key} className={`activity-sources-meta${value ? "" : " is-empty"}`}>{value && <Icon className="activity-sources-meta-icon" size={14} aria-hidden="true" />}{value}</td>)}
    <td role="cell" className="activity-sources-meta activity-sources-type"><Tag className="activity-sources-meta-icon" size={14} aria-hidden="true" />{typeLabel}{hiddenLabel && <small>{hiddenLabel}</small>}</td>
  </tr>;
});

export type ActivitySourcesTableProps = {
  candidates: Entity[];
  areas: Pick<Area, "id" | "name">[];
  /** The saved sources; undefined while the suggestions are followed. */
  saved: string[] | undefined;
  suggestions: string[];
  /** Camera person sensors by entity ID, with the camera's name. */
  personSensors: Record<string, string>;
  hidden: readonly ActivityCategory[];
  disabled: boolean;
  /** Saves the sources (undefined follows the suggestions); false keeps the draft. */
  onSave: (sources: string[] | undefined) => boolean;
  /** Where focus goes when the save bar closes. */
  onSettled: () => void;
};
type Draft = { ids: ReadonlySet<string>; suggested: boolean };

/**
 * Every entity that can report activity, as a table that can be searched, filtered, sorted and grouped. Ticks collect in
 * a draft until Save sources, so choosing dozens of sources writes the shared configuration once.
 */
export function ActivitySourcesTable({ candidates, areas, saved, suggestions, personSensors, hidden, disabled, onSave, onSettled }: ActivitySourcesTableProps) {
  const { t, language } = useI18n();
  const id = useId();
  const searchField = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [failed, setFailed] = useState(false);
  const [filters, setFilters] = useState<SourceFilters>(emptySourceFilters);
  // Rows ticked while the chosen filter is on stay put until the filter changes, so the pointer never loses its row.
  const [kept, setKept] = useState<ReadonlySet<string>>(() => new Set());
  const [grouping, setGrouping] = useState<SourceGrouping>("type");
  const [sort, setSort] = useState<SourceSort>({ key: "name", direction: "ascending" });
  const [folds, setFolds] = useState<{ closed: boolean; toggled: ReadonlySet<string> }>({ closed: false, toggled: new Set() });
  const text = useDeferredValue(filters.text);

  const savedIds = useMemo(() => new Set(saved ?? suggestions), [saved, suggestions]);
  const suggestionIds = useMemo(() => new Set(suggestions), [suggestions]);
  const chosen = draft?.ids ?? savedIds;
  const following = draft ? draft.suggested : !saved;
  const dirty = !!draft && (draft.suggested !== !saved || !sameSources(draft.ids, savedIds));
  const changes = draft ? sourceChanges(draft.ids, savedIds) : 0;

  const categoryLabel = useCallback((category: ActivityCategory | "missing") => t(category === "missing" ? "Unavailable sources" : activityCategoryLabels[category]), [t]);
  // The hook builds a new object every render; a string key keeps the rows memoized until a camera or its name changes.
  const sensorKey = Object.entries(personSensors).map(entry => entry.join("=")).sort().join("\n");
  const labels = useMemo(() => {
    const names = new Map(sensorKey ? sensorKey.split("\n").map(entry => [entry.slice(0, entry.indexOf("=")), entry.slice(entry.indexOf("=") + 1)]) : []);
    return { language, name: (entity: Entity) => names.get(entity.entityId) ?? entity.name, unnamedDevice: t("Unnamed device"), missingName: t("Source unavailable"), category: categoryLabel };
  }, [language, t, sensorKey, categoryLabel]);
  const known = useMemo(() => {
    const cameras = new Set(sensorKey ? sensorKey.split("\n").map(entry => entry.slice(0, entry.indexOf("="))) : []);
    return activitySourceRows(candidates, areas, cameras, labels);
  }, [candidates, areas, sensorKey, labels]);
  const knownIds = useMemo(() => new Set(known.map(row => row.id)), [known]);
  const missingKey = [...savedIds, ...draft?.ids ?? []].filter(value => !knownIds.has(value)).join("\n");
  const missing = useMemo(() => missingSourceRows(missingKey ? missingKey.split("\n") : [], knownIds, labels), [missingKey, knownIds, labels]);
  const rows = useMemo(() => missing.length ? [...known, ...missing] : known, [known, missing]);

  const shown = useMemo(() => filterSourceRows(rows, { ...filters, text }, chosen, kept, language), [rows, filters, text, chosen, kept, language]);
  const sorted = useMemo(() => sortSourceRows(shown, sort, language), [shown, sort, language]);
  const groupLabels = useMemo(() => ({ category: categoryLabel, noDevice: t("Without a device"), noIntegration: t("Unknown integration"), noArea: t("Unassigned") }), [categoryLabel, t]);
  const groups = useMemo(() => groupSourceRows(sorted, grouping, language, groupLabels), [sorted, grouping, language, groupLabels]);
  const shownChosen = shown.filter(row => chosen.has(row.id)).length;

  // Filter choices list only what the candidates have, so no choice leads to an empty table.
  const options = useMemo(() => {
    const collator = new Intl.Collator(language, { sensitivity: "base", numeric: true });
    const unique = (pick: (row: ActivitySourceRow) => [string, string]) => [...new Map(rows.map(pick)).entries()]
      .sort(([keyA, a], [keyB, b]) => Number(!keyA) - Number(!keyB) || collator.compare(a, b));
    return {
      areas: unique(row => [row.areaKey, row.area || t("Unassigned")]),
      integrations: unique(row => [row.integrationKey, row.integration || t("Unknown integration")]),
      categories: [...activityCategories, "missing" as const].filter(category => rows.some(row => row.category === category)),
    };
  }, [rows, language, t]);

  const change = useCallback((ids: string[], on: boolean) => {
    setDraft(current => {
      const base = current ?? { ids: savedIds, suggested: !saved };
      const ids2 = withSources(base.ids, ids, on);
      // Ticking back to the suggestions keeps following them when they were followed before.
      return { ids: ids2, suggested: (base.suggested || !saved) && sameSources(ids2, suggestionIds) };
    });
    setFailed(false);
    if (filters.chosen !== "all") setKept(current => withSources(current, ids, true));
  }, [savedIds, saved, suggestionIds, filters.chosen]);

  const filter = (patch: Partial<SourceFilters>) => {
    if (patch.chosen !== undefined && patch.chosen !== filters.chosen) setKept(new Set());
    // A new search opens every group, so matches are never hidden in a closed one.
    if (patch.text?.trim() && !filters.text.trim()) setFolds({ closed: false, toggled: new Set() });
    setFilters(current => ({ ...current, ...patch }));
  };
  const clearFilters = () => { setFilters(emptySourceFilters); setKept(new Set()); searchField.current?.focus(); };
  const regroup = (value: SourceGrouping) => {
    setGrouping(value);
    setFolds({ closed: value !== "none" && value !== "type" && groupSourceRows(rows, value, language, groupLabels).length > OPEN_GROUPS_UP_TO, toggled: new Set() });
  };
  const isOpen = (key: string) => folds.closed === folds.toggled.has(key);
  const fold = (key: string) => setFolds(current => ({ ...current, toggled: withSources(current.toggled, [key], !current.toggled.has(key)) }));
  const sortBy = (key: SourceSortKey) => setSort(current => ({ key, direction: current.key === key && current.direction === "ascending" ? "descending" : "ascending" }));

  const useSuggested = () => { setDraft({ ids: suggestionIds, suggested: true }); setFailed(false); };
  const cancel = () => { setDraft(null); setFailed(false); setKept(new Set()); onSettled(); };
  const save = () => {
    if (!draft) return;
    if (!onSave(draft.suggested ? undefined : [...draft.ids])) { setFailed(true); return; }
    setDraft(null); setFailed(false); setKept(new Set()); onSettled();
  };

  const notShownChosen = shown.filter(row => !chosen.has(row.id)).map(row => row.id);
  const shownChosenIds = shown.filter(row => chosen.has(row.id)).map(row => row.id);
  const active = sourceFiltersActive(filters);
  const rowProps = (row: ActivitySourceRow) => ({
    row, checked: chosen.has(row.id), disabled, onChange: change,
    typeLabel: row.category === "missing" ? t("Unavailable") : t(activityCategoryLabels[row.category]),
    hiddenLabel: row.category !== "missing" && hidden.includes(row.category) ? t("Hidden") : undefined,
    checkLabel: t("Use {name} as a source", { name: row.name }),
  });
  const groupIcon = (group: SourceGroup): ReactNode => {
    if (group.category === "missing") return <CircleAlert size={20} aria-hidden="true" />;
    if (group.category) { const Icon = activityIcons[activityCategoryIcons[group.category]]; return <Icon size={20} aria-hidden="true" />; }
    if (grouping === "device") return group.empty ? <Layers size={20} aria-hidden="true" /> : <DeviceIcon type={group.rows[0].entity?.domain ?? "sensor"} className="h-5 w-5 shrink-0" />;
    return grouping === "area" ? <MapPin size={20} aria-hidden="true" /> : <Puzzle size={20} aria-hidden="true" />;
  };
  const groupNote = (group: SourceGroup) => group.category === "missing" ? t("Not found in Home Assistant right now.")
    : group.category && hidden.includes(group.category) ? t("Hidden under Event types") : undefined;

  const select = (label: MessageKey, value: string, onChange: (value: string) => void, choices: [string, string][]) => <label>
    {t(label)}<select value={value} onChange={event => onChange(event.target.value)}>{choices.map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select>
  </label>;

  return <div className="activity-sources">
    <p className="activity-sources-total" role="status">
      <strong>{t(chosen.size === 1 ? "1 source chosen" : "{count} sources chosen", { count: chosen.size })}</strong>
      <span>{following ? t("Following the suggestions") : t("of {count} entities that can report activity", { count: known.length })}</span>
    </p>
    <div className="activity-sources-filters" role="search" aria-label={t("Filter sources")}>
      <label className="activity-sources-search">{t("Search sources")}<span className="activity-sources-search-field">
        <Search size={18} aria-hidden="true" />
        <Input ref={searchField} type="search" value={filters.text} placeholder={t("Name, device, room or ID")} onChange={event => filter({ text: event.target.value })} />
      </span></label>
      {select("Group by", grouping, value => regroup(value as SourceGrouping), groupings.map(choice => [choice.value, t(choice.label)]))}
      {select("Show", filters.chosen, value => filter({ chosen: value as SourceFilters["chosen"] }), [["all", t("All entities")], ["chosen", t("Chosen sources")], ["unchosen", t("Not chosen")]])}
      {select("Type", filters.category, value => filter({ category: value as SourceFilters["category"] }), [["all", t("All types")], ...options.categories.map((category): [string, string] => [category, categoryLabel(category)])])}
      {select("Area", filters.area, value => filter({ area: value }), [["all", t("All areas")], ...options.areas])}
      {select("Integration", filters.integration, value => filter({ integration: value }), [["all", t("All integrations")], ...options.integrations])}
    </div>
    <div className="activity-sources-results">
      <p role="status" id={`${id}-results`}>{t("{shown} of {total} shown, {chosen} chosen", { shown: shown.length, total: rows.length, chosen: shownChosen })}</p>
      <Button type="button" variant="ghost" disabled={!active} onClick={clearFilters}><X size={16} aria-hidden="true" />{t("Clear filters")}</Button>
    </div>
    <div className="activity-sources-actions" role="group" aria-label={t("Change shown sources")}>
      <Button type="button" variant="outline" disabled={disabled || !notShownChosen.length} onClick={() => change(notShownChosen, true)}><SquareCheck size={16} aria-hidden="true" />{t("Choose all shown")}</Button>
      <Button type="button" variant="outline" disabled={disabled || !shownChosenIds.length} onClick={() => change(shownChosenIds, false)}><SquareMinus size={16} aria-hidden="true" />{t("Remove all shown")}</Button>
      <Button type="button" variant="outline" disabled={disabled || following && sameSources(chosen, suggestionIds)} onClick={useSuggested}><ListRestart size={16} aria-hidden="true" />{t("Use suggested sources")}</Button>
    </div>
    <table className="activity-sources-table" role="table" aria-describedby={`${id}-results`}>
      <caption className="sr-only">{t("Activity sources")}</caption>
      <thead role="rowgroup"><tr role="row">
        <th role="columnheader" scope="col" className="activity-sources-check"><span className="sr-only">{t("Source")}</span><span className="activity-sources-sort-label" aria-hidden="true">{t("Sort by")}</span></th>
        {columns.map(column => {
          const current = sort.key === column.key;
          const Arrow = !current ? ArrowUpDown : sort.direction === "ascending" ? ArrowUp : ArrowDown;
          return <th role="columnheader" scope="col" key={column.key} aria-sort={current ? sort.direction : undefined} className={`activity-sources-column-${column.key}`}>
            <button type="button" className="activity-sources-sort" onClick={() => sortBy(column.key)}>{t(column.label)}<Arrow size={16} aria-hidden="true" /></button>
          </th>;
        })}
      </tr></thead>
      {!sorted.length ? <tbody role="rowgroup"><tr role="row" className="activity-sources-none"><td role="cell" colSpan={6}>
        <span>{rows.length ? t("No sources match these filters.") : t("No entities available.")}</span>
        {active && <Button type="button" variant="outline" onClick={clearFilters}>{t("Clear filters")}</Button>}
      </td></tr></tbody>
        : groups.map(group => {
          if (grouping === "none") return <tbody role="rowgroup" key="all">{group.rows.map(row => <SourceRow key={row.id} {...rowProps(row)} />)}</tbody>;
          const ids = group.rows.map(row => row.id), count = ids.filter(value => chosen.has(value)).length, open = isOpen(group.key), note = groupNote(group);
          return <tbody role="rowgroup" key={`${grouping}:${group.key}`} className="activity-sources-group">
            <tr role="row" className="activity-sources-group-row">
              <td role="cell" className="activity-sources-check"><Checkbox checked={count === ids.length ? true : count ? "indeterminate" : false} disabled={disabled}
                aria-label={t("Use all shown in {group} as sources", { group: group.label })} onCheckedChange={() => change(ids, count < ids.length)} /></td>
              <th role="rowheader" scope="rowgroup" colSpan={5}>
                <button type="button" className="activity-sources-fold" aria-expanded={open} onClick={() => fold(group.key)}>
                  {groupIcon(group)}
                  <span className="activity-sources-group-name">{group.label}{note && <small>{note}</small>}</span>
                  <span className="activity-sources-count">{t("{count} of {total} chosen", { count, total: ids.length })}</span>
                  <ChevronDown className="activity-sources-chevron" size={18} aria-hidden="true" />
                </button>
              </th>
            </tr>
            {open && group.rows.map(row => <SourceRow key={row.id} {...rowProps(row)} />)}
          </tbody>;
        })}
    </table>
    {(dirty || failed) && <div className="activity-sources-savebar" role="group" aria-label={t("Unsaved sources")}>
      <p>{changes ? t(changes === 1 ? "1 unsaved change" : "{count} unsaved changes", { count: changes }) : t("Unsaved changes")}
        {failed && <span role="alert">{t("Sources were not saved. Your changes are kept here, so you can try again.")}</span>}</p>
      <span className="activity-sources-savebar-actions">
        <Button type="button" variant="ghost" className="activity-sources-cancel" onClick={cancel}><X size={18} aria-hidden="true" /><span>{t("Cancel")}</span></Button>
        <Button type="button" disabled={disabled} onClick={save}>{t("Save sources")}</Button>
      </span>
    </div>}
  </div>;
}
