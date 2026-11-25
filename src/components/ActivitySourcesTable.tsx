import { Fragment, memo, useCallback, useDeferredValue, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight, CircleAlert, Cpu, Layers, ListRestart, MapPin, Puzzle, Search, SquareCheck, SquareMinus, Tag, X, type LucideIcon } from "lucide-react";
import { useI18n } from "@/hooks/use-i18n";
import { activityIcons } from "@/components/activity-icons";
import { DeviceIcon } from "@/components/devices/DeviceControl";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { UnsavedChangesGuard } from "@/components/common/UnsavedChangesGuard";
import { activityCategoryIcons, activityCategoryLabels, activitySourceRows, buildSourceTree, emptySourceFilters, filterSourceRows, missingSourceRows, sameSources, sortSourceRows, sourceChanges, sourceFiltersActive, sourceLevels, withSources,
  type ActivitySourceRow, type SourceFilters, type SourceGrouping, type SourceLevel, type SourceSort, type SourceSortKey, type SourceTreeNode, type SourceTreePart } from "@/lib/activity-sources";
import type { ActivityIcon } from "@/lib/activity";
import { msg, type MessageKey } from "@/lib/i18n";
import type { Area, Entity } from "@/types/api";
import { activityCategories, type ActivityCategory } from "../../shared/configuration";
import "./activity-sources-table.css";

const columns: { key: SourceSortKey; label: MessageKey }[] = [
  { key: "name", label: "Name" }, { key: "device", label: "Device" }, { key: "integration", label: "Integration" }, { key: "area", label: "Area" }, { key: "type", label: "Type" },
];
const groupings: { value: SourceGrouping; label: MessageKey }[] = [
  { value: "integration", label: "Integration" }, { value: "area", label: "Area" }, { value: "device", label: "Device" }, { value: "type", label: "Type" }, { value: "none", label: "None" },
];
const levelLabels: Record<SourceLevel, MessageKey> = { area: "Area", integration: "Integration", device: "Device", type: "Type" };
// The small glyph for each level, shared with the phone's meta line.
const levelGlyphs: Record<SourceLevel, LucideIcon> = { area: MapPin, integration: Puzzle, device: Cpu, type: Tag };
// A level with more groups than this starts folded, so a long level is a scannable list of names and counts. Searching or
// filtering opens every path to a match instead.
const OPEN_GROUPS_UP_TO = 8;

/** The event type's icon (door, lock, robot …); other changes use the device icon. */
function SourceIcon({ entity, icon }: { entity?: Entity; icon: ActivityIcon }) {
  if (!entity) return <CircleAlert size={20} aria-hidden="true" />;
  if (icon === "activity") return <DeviceIcon type={entity.domain} deviceClass={entity.attributes.device_class} className="h-5 w-5 shrink-0" />;
  const Icon = activityIcons[icon];
  return <Icon size={20} aria-hidden="true" />;
}

/** The indent of a tree row: its depth below the top level. */
const depth = (level: number) => ({ "--level": level - 1 }) as CSSProperties;

type RowProps = {
  row: ActivitySourceRow; line: string; level: number; setsize: number; posinset: number; tabbable: boolean;
  checked: boolean; disabled: boolean; typeLabel: string; hiddenLabel?: string; checkLabel: string; onChange: (ids: string[], on: boolean) => void;
};

/** One candidate: a checkbox, the name the activity rows use, and where it comes from. Memoized, so ticking one row repaints only that row. */
const SourceRow = memo(function SourceRow({ row, line, level, setsize, posinset, tabbable, checked, disabled, typeLabel, hiddenLabel, checkLabel, onChange }: RowProps) {
  // On phones the cells run together as one wrapping line, each led by a small glyph that says what it is.
  const meta = [{ key: "device", value: row.device, Icon: Cpu }, { key: "integration", value: row.integration, Icon: Puzzle }, { key: "area", value: row.area, Icon: MapPin }];
  return <tr role="row" aria-level={level} aria-setsize={setsize} aria-posinset={posinset} tabIndex={tabbable ? 0 : -1} data-line={line} data-source={row.id}
    className={`activity-sources-entry${checked ? " is-chosen" : ""}`} style={depth(level)}>
    <th role="rowheader" scope="row" className="activity-sources-name"><span className="activity-sources-lead">
      <span className="activity-sources-check"><Checkbox tabIndex={-1} checked={checked} disabled={disabled} aria-label={checkLabel} onCheckedChange={value => onChange([row.id], value === true)} /></span>
      <SourceIcon entity={row.entity} icon={row.icon} />
      {/* Long entity IDs may break after their dots and underscores instead of mid-word. */}
      <span className="activity-sources-copy"><strong>{row.name}</strong><small>{row.detail.split(/(?<=[._])/).map((part, index) => <Fragment key={index}>{index > 0 && <wbr />}{part}</Fragment>)}</small></span>
    </span></th>
    {meta.map(({ key, value, Icon }) => <td role="gridcell" key={key} className={`activity-sources-meta${value ? "" : " is-empty"}`}>{value && <Icon className="activity-sources-meta-icon" size={14} aria-hidden="true" />}{value}</td>)}
    <td role="gridcell" className="activity-sources-meta activity-sources-type"><Tag className="activity-sources-meta-icon" size={14} aria-hidden="true" />{typeLabel}{hiddenLabel && <small>{hiddenLabel}</small>}</td>
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
/** A visible row of the tree: a group (`node`) or a source (`row`), with its place among its siblings. */
type Line = { key: string; level: number; setsize: number; posinset: number; parent?: string } & ({ node: SourceTreeNode; open: boolean; row?: undefined } | { row: ActivitySourceRow; node?: undefined; open?: undefined });

/**
 * Every entity that can report activity, as a tree grid that can be searched, filtered, sorted and grouped. Ticks collect in
 * a draft until Save sources, so choosing dozens of sources writes the shared configuration once.
 */
export function ActivitySourcesTable({ candidates, areas, saved, suggestions, personSensors, hidden, disabled, onSave, onSettled }: ActivitySourcesTableProps) {
  const { t, language } = useI18n();
  const id = useId();
  const searchField = useRef<HTMLInputElement>(null);
  const body = useRef<HTMLTableSectionElement>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [failed, setFailed] = useState(false);
  const [filters, setFilters] = useState<SourceFilters>(emptySourceFilters);
  // Rows ticked while the chosen filter is on stay put until the filter changes, so the pointer never loses its row.
  const [kept, setKept] = useState<ReadonlySet<string>>(() => new Set());
  const [grouping, setGrouping] = useState<SourceGrouping>("integration");
  const [sort, setSort] = useState<SourceSort>({ key: "name", direction: "ascending" });
  // Groups the owner folded or opened against their default; cleared when the grouping or a filter changes.
  const [toggled, setToggled] = useState<ReadonlySet<string>>(() => new Set());
  // The tree grid's single tab stop (roving tabindex).
  const [active, setActive] = useState<string>();
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
  const treeLabels = useMemo(() => ({ category: categoryLabel, noDevice: t("Without a device"), noIntegration: t("Unknown integration"), noArea: t("Unassigned") }), [categoryLabel, t]);
  const tree = useMemo(() => buildSourceTree(sorted, grouping, language, treeLabels), [sorted, grouping, language, treeLabels]);
  const filtering = sourceFiltersActive({ ...filters, text });
  const shownChosen = shown.filter(row => chosen.has(row.id)).length;

  // The rows on screen, in order: a group is followed by its children only while it is open.
  const lines = useMemo(() => {
    const out: Line[] = [];
    if (grouping === "none") {
      sorted.forEach((row, index) => out.push({ key: row.id, row, level: 1, setsize: sorted.length, posinset: index + 1 }));
      return out;
    }
    const walk = (nodes: SourceTreeNode[], level: number, parent?: string) => nodes.forEach((node, index) => {
      const open = toggled.has(node.key) !== (filtering || nodes.length <= OPEN_GROUPS_UP_TO);
      out.push({ key: node.key, node, open, level, setsize: nodes.length, posinset: index + 1, parent });
      if (!open) return;
      if (node.children.length) walk(node.children, level + 1, node.key);
      else node.rows.forEach((row, rowIndex) => out.push({ key: `${node.key}/${row.id}`, row, level: level + 1, setsize: node.rows.length, posinset: rowIndex + 1, parent: node.key }));
    });
    walk(tree, 1);
    return out;
  }, [grouping, sorted, tree, toggled, filtering]);
  const tabStop = active !== undefined && lines.some(line => line.key === active) ? active : lines[0]?.key;

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
    // Every new search or filter opens the paths to its matches again.
    setToggled(new Set());
    setFilters(current => ({ ...current, ...patch }));
  };
  const clearFilters = () => { setFilters(emptySourceFilters); setKept(new Set()); setToggled(new Set()); searchField.current?.focus(); };
  const regroup = (value: SourceGrouping) => { setGrouping(value); setToggled(new Set()); setActive(undefined); };
  const fold = (key: string) => setToggled(current => withSources(current, [key], !current.has(key)));
  const sortBy = (key: SourceSortKey) => setSort(current => ({ key, direction: current.key === key && current.direction === "ascending" ? "descending" : "ascending" }));

  const useSuggested = () => { setDraft({ ids: suggestionIds, suggested: true }); setFailed(false); };
  const discard = () => { setDraft(null); setFailed(false); setKept(new Set()); };
  const cancel = () => { discard(); onSettled(); };
  const save = () => {
    if (!draft) return;
    if (!onSave(draft.suggested ? undefined : [...draft.ids])) { setFailed(true); return; }
    setDraft(null); setFailed(false); setKept(new Set()); onSettled();
  };

  const notShownChosen = shown.filter(row => !chosen.has(row.id)).map(row => row.id);
  const shownChosenIds = shown.filter(row => chosen.has(row.id)).map(row => row.id);
  const anyFilter = sourceFiltersActive(filters);
  const rowProps = (row: ActivitySourceRow) => ({
    row, checked: chosen.has(row.id), disabled, onChange: change,
    typeLabel: row.category === "missing" ? t("Unavailable") : t(activityCategoryLabels[row.category]),
    hiddenLabel: row.category !== "missing" && hidden.includes(row.category) ? t("Hidden") : undefined,
    checkLabel: t("Use {name} as a source", { name: row.name }),
  });
  const partIcon = (part: SourceTreePart, rows: ActivitySourceRow[]): ReactNode => {
    if (part.category === "missing") return <CircleAlert size={20} aria-hidden="true" />;
    if (part.category) { const Icon = activityIcons[activityCategoryIcons[part.category]]; return <Icon size={20} aria-hidden="true" />; }
    if (part.level === "device") return part.empty ? <Layers size={20} aria-hidden="true" /> : <DeviceIcon type={rows[0].entity?.domain ?? "sensor"} className="h-5 w-5 shrink-0" />;
    return part.level === "area" ? <MapPin size={20} aria-hidden="true" /> : <Puzzle size={20} aria-hidden="true" />;
  };
  const groupNote = (node: SourceTreeNode) => {
    const type = node.parts.find(part => part.category);
    return type?.category === "missing" ? t("Not found in Home Assistant right now.")
      : type?.category && hidden.includes(type.category as ActivityCategory) ? t("Hidden under Event types") : undefined;
  };
  // A group's ticks: every shown row below it, and how many of them are chosen.
  const groupState = (node: SourceTreeNode) => {
    const ids = node.rows.map(row => row.id);
    return { ids, count: ids.filter(value => chosen.has(value)).length };
  };

  // Tree grid keys: ↑ ↓ Home End move between rows; → opens a group, then enters it; ← closes it, then goes to its parent;
  // Space ticks the row (or the whole group); Enter folds a group and ticks a source.
  const focusLine = (key: string) => {
    setActive(key);
    [...body.current?.rows ?? []].find(row => row.dataset.line === key)?.focus();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTableSectionElement>) => {
    const target = event.target as HTMLElement;
    const row = target.closest<HTMLTableRowElement>("tr[data-line]");
    const index = row ? lines.findIndex(line => line.key === row.dataset.line) : -1;
    const line = lines[index];
    if (!line || event.altKey || event.ctrlKey || event.metaKey) return;
    // On the row itself; on its checkbox or fold button the browser keeps Space and Enter.
    const onRow = target === row;
    const go = (next?: Line) => { event.preventDefault(); if (next) focusLine(next.key); };
    if (event.key === "ArrowDown") go(lines[index + 1]);
    else if (event.key === "ArrowUp") go(lines[index - 1]);
    else if (event.key === "Home") go(lines[0]);
    else if (event.key === "End") go(lines[lines.length - 1]);
    else if (event.key === "ArrowRight") {
      event.preventDefault();
      if (line.node && !line.open) { fold(line.node.key); focusLine(line.key); }
      else if (line.node) go(lines[index + 1]);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      if (line.node && line.open) { fold(line.node.key); focusLine(line.key); }
      else if (line.parent) go(lines.find(other => other.key === line.parent));
    } else if (onRow && (event.key === " " || event.key === "Enter")) {
      event.preventDefault();
      if (disabled && (event.key === " " || line.row)) return;
      if (line.node && event.key === "Enter") fold(line.node.key);
      else if (line.node) { const { ids, count } = groupState(line.node); change(ids, count < ids.length); }
      else if (line.row) change([line.row.id], !chosen.has(line.row.id));
    }
  };

  const select = (label: MessageKey, value: string, onChange: (value: string) => void, choices: [string, string][]) => <label>
    {t(label)}<select value={value} onChange={event => onChange(event.target.value)}>{choices.map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select>
  </label>;
  const levels = sourceLevels(grouping);

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
      <Button type="button" variant="ghost" disabled={!anyFilter} onClick={clearFilters}><X size={16} aria-hidden="true" />{t("Clear filters")}</Button>
    </div>
    <div className="activity-sources-actions" role="group" aria-label={t("Change shown sources")}>
      <Button type="button" variant="outline" disabled={disabled || !notShownChosen.length} onClick={() => change(notShownChosen, true)}><SquareCheck size={16} aria-hidden="true" />{t("Choose all shown")}</Button>
      <Button type="button" variant="outline" disabled={disabled || !shownChosenIds.length} onClick={() => change(shownChosenIds, false)}><SquareMinus size={16} aria-hidden="true" />{t("Remove all shown")}</Button>
      <Button type="button" variant="outline" disabled={disabled || following && sameSources(chosen, suggestionIds)} onClick={useSuggested}><ListRestart size={16} aria-hidden="true" />{t("Use suggested sources")}</Button>
    </div>
    {!!levels.length && <div className="activity-sources-levels" id={`${id}-levels`}>
      <ol aria-label={t("Tree levels")}>
        {[...levels, "source" as const].map((level, index) => {
          const Glyph = level === "source" ? SquareCheck : levelGlyphs[level];
          return <li key={level}>{index > 0 && <ChevronRight className="activity-sources-levels-step" size={14} aria-hidden="true" />}<Glyph size={14} aria-hidden="true" />{t(level === "source" ? "Source" : levelLabels[level])}</li>;
        })}
      </ol>
      <p>{t("A group with only one group inside shares its row with it, and the inner name is shown below.")}</p>
    </div>}
    <p className="activity-sources-sort-label" aria-hidden="true">{t("Sort by")}</p>
    <table className="activity-sources-table" role="treegrid" aria-describedby={levels.length ? `${id}-results ${id}-levels` : `${id}-results`}>
      <caption className="sr-only">{t("Activity sources")}</caption>
      <thead role="rowgroup"><tr role="row">
        {columns.map(column => {
          const current = sort.key === column.key;
          const Arrow = !current ? ArrowUpDown : sort.direction === "ascending" ? ArrowUp : ArrowDown;
          return <th role="columnheader" scope="col" key={column.key} aria-sort={current ? sort.direction : undefined} className={`activity-sources-column-${column.key}`}>
            <button type="button" className="activity-sources-sort" onClick={() => sortBy(column.key)}>{t(column.label)}<Arrow size={16} aria-hidden="true" /></button>
          </th>;
        })}
      </tr></thead>
      <tbody role="rowgroup" ref={body} onKeyDown={onKeyDown} onFocus={event => { const line = (event.target as HTMLElement).closest<HTMLElement>("tr[data-line]")?.dataset.line; if (line) setActive(line); }}>
        {!lines.length ? <tr role="row" className="activity-sources-none"><td role="gridcell" colSpan={5}>
          <span>{rows.length ? t("No sources match these filters.") : t("No entities available.")}</span>
          {anyFilter && <Button type="button" variant="outline" onClick={clearFilters}>{t("Clear filters")}</Button>}
        </td></tr>
          : lines.map(line => {
            if (line.row) return <SourceRow key={line.key} line={line.key} level={line.level} setsize={line.setsize} posinset={line.posinset} tabbable={line.key === tabStop} {...rowProps(line.row)} />;
            const { node, open } = line, { ids, count } = groupState(node), note = groupNote(node), [part, ...merged] = node.parts;
            const name = node.parts.map(each => each.label).join(", ");
            return <tr role="row" key={line.key} data-line={line.key} aria-level={line.level} aria-setsize={line.setsize} aria-posinset={line.posinset} aria-expanded={open}
              tabIndex={line.key === tabStop ? 0 : -1} className="activity-sources-group-row" style={depth(line.level)}>
              <th role="rowheader" scope="row" colSpan={5} className="activity-sources-name"><span className="activity-sources-lead">
                <span className="activity-sources-check"><Checkbox tabIndex={-1} checked={count === ids.length ? true : count ? "indeterminate" : false} disabled={disabled}
                  aria-label={t("Use all shown in {group} as sources", { group: name })} onCheckedChange={() => change(ids, count < ids.length)} /></span>
                <button type="button" tabIndex={-1} className="activity-sources-fold" aria-expanded={open} onClick={() => fold(node.key)}>
                  <ChevronRight className="activity-sources-chevron" size={18} aria-hidden="true" />
                  {partIcon(part, node.rows)}
                  <span className="activity-sources-group-name">
                    <span>{part.label}</span>
                    {merged.length > 0 && <span className="activity-sources-merged">{merged.map(each => {
                      const Glyph = levelGlyphs[each.level];
                      return <span key={each.level}><span className="sr-only">, </span><Glyph size={14} aria-hidden="true" />{each.label}</span>;
                    })}</span>}
                    {note && <small>{note}</small>}
                  </span>
                  <span className="activity-sources-count">{t("{count} of {total} chosen", { count, total: ids.length })}</span>
                </button>
              </span></th>
            </tr>;
          })}
      </tbody>
    </table>
    <UnsavedChangesGuard dirty={dirty} title="Discard unsaved sources?" onDiscard={discard}
      description={changes ? msg(changes === 1 ? "1 change to Activity sources is not saved. Keep editing to save it, or discard it and leave." : "{count} changes to Activity sources are not saved. Keep editing to save them, or discard them and leave.", { count: changes })
        : "Your changes to Activity sources are not saved. Keep editing to save them, or discard them and leave."} />
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
