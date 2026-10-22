import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import { useFamily } from "@/contexts/FamilyContext";
import { useSharedConfiguration } from "@/contexts/SharedConfigurationContext";
import { useI18n } from "@/hooks/use-i18n";
import { smartHomeEntities } from "@/lib/device-model";
import { visibilityGroup, visibilityGroupings, visibilityTree, type VisibilityDimension, type VisibilityGroup, type VisibilityGrouping } from "@/lib/smart-home-visibility";
import type { Entity } from "@/types/api";
import { PanelHeading } from "@/components/FamilyPlanner";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";

export function SmartHomeSettings() {
  const { t, message, language } = useI18n();
  const { currentHome, homeOnline } = useApp();
  const { smartHome, setSmartHomeDeviceVisible, setSmartHomeEntityVisible, setSmartHomeEntitiesVisible } = useFamily();
  const shared = useSharedConfiguration();
  const [search, setSearch] = useState("");
  const [grouping, setGrouping] = useState<VisibilityGrouping>("domain");
  const [filters, setFilters] = useState({ domain: "all", integration: "all", room: "all", visibility: "all", category: "all" });
  const [expansion, setExpansion] = useState<"default" | "all" | "none">("default");
  const [expansionVersion, setExpansionVersion] = useState(0);
  const [pending, setPending] = useState<{ name: string; ids: string[]; deviceId?: string; visible: boolean; allMatches?: boolean } | null>(null);
  const query = search.trim().toLocaleLowerCase(language);
  const entities = useMemo(() => smartHomeEntities(currentHome.entities), [currentHome.entities]);
  const visibleIds = new Set(smartHomeEntities(entities, smartHome).map(entity => entity.preferenceId));
  const disabled = !shared?.state.loaded || !!shared.state.error || !smartHome.knownEntities;
  const matches = (value: string) => value.toLocaleLowerCase(language).includes(query);
  const groupFor = (entity: Entity, dimension: VisibilityDimension) => visibilityGroup(entity, dimension, currentHome.areas, language);
  const filtered = entities.filter(entity => {
    const groups = (["domain", "integration", "room"] as const).map(dimension => ({ dimension, ...groupFor(entity, dimension) }));
    return groups.every(group => filters[group.dimension] === "all" || filters[group.dimension] === group.id)
      && (filters.visibility === "all" || visibleIds.has(entity.preferenceId) === (filters.visibility === "visible"))
      && (filters.category === "all" || (entity.category || "main") === filters.category)
      && matches([entity.name, entity.entityId, groupFor(entity, "device").name, ...groups.flatMap(group => [group.id, group.name])].join(" "));
  }).sort((a, b) => a.name.localeCompare(b.name, language));
  const groups = visibilityTree(filtered, visibilityGroupings[grouping], currentHome.areas, language);
  const deviceCounts = new Map<string, number>();
  for (const entity of entities) if (entity.device) deviceCounts.set(entity.device.id, (deviceCounts.get(entity.device.id) ?? 0) + 1);
  const hasFilters = !!query || Object.values(filters).some(value => value !== "all");
  const visibleMatches = filtered.filter(entity => visibleIds.has(entity.preferenceId)).length;
  const entityRow = (entity: Entity) => {
    const deviceHidden = !!entity.device && smartHome.hiddenDevices.includes(entity.device.id);
    return <label key={entity.preferenceId} className="flex min-h-12 cursor-pointer items-center justify-between gap-3 py-3">
      <span className="min-w-0"><span className="block break-words text-sm font-medium">{entity.name}</span><span className="block break-all text-xs text-muted-foreground">{entity.entityId}</span>{deviceHidden && <span className="block text-xs text-muted-foreground">{t("Hidden by device")}</span>}</span>
      <Switch aria-label={t("Show entity {name} on Smart home", { name: entity.name })} checked={visibleIds.has(entity.preferenceId)} disabled={disabled || deviceHidden}
        onCheckedChange={visible => setSmartHomeEntityVisible(entity.preferenceId, visible)} />
    </label>;
  };
  const groupRows = (items: VisibilityGroup[], parents: string[] = []): ReactNode => items.map(group => {
    const path = [...parents, group.name];
    const name = path.join(" / ");
    const visible = group.entities.filter(entity => visibleIds.has(entity.preferenceId)).length;
    const wholeDevice = group.deviceId && deviceCounts.get(group.deviceId) === group.entities.length ? group.deviceId : undefined;
    return <li key={group.id} className="relative border-b last:border-0">
        <details className="min-w-0" open={expansion === "all" || (expansion === "default" && (!!query || !parents.length))}>
          <summary className="min-h-12 cursor-pointer rounded-sm py-3 pr-14 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
            <span className="break-words font-medium">{group.name}</span>
            <span className="block pl-4 text-xs text-muted-foreground">{t("{visible} of {total} visible", { visible, total: group.entities.length })}</span>
          </summary>
          <ul className="border-l pl-2 sm:pl-3">{group.children.length ? groupRows(group.children, path) : group.entities.map(entity => <li key={entity.preferenceId}>{entityRow(entity)}</li>)}</ul>
        </details>
        <Switch className="absolute right-0 top-3" aria-label={wholeDevice ? t("Show device {name} on Smart home", { name: group.name }) : t("Show group {name} on Smart home", { name })}
          checked={wholeDevice ? !smartHome.hiddenDevices.includes(wholeDevice) && group.entities.some(entity => !smartHome.knownEntities || smartHome.knownEntities.includes(entity.preferenceId)) : visible > 0} disabled={disabled}
          onCheckedChange={value => setPending({ name, ids: group.entities.map(entity => entity.preferenceId), deviceId: wholeDevice, visible: value })} />
    </li>;
  });

  return <section className="glow-panel" id="smart-home-visibility" aria-label={t("Smart home visibility")}>
    <PanelHeading title={t("Smart home visibility")} to="/home" label={t("Smart home")} />
    <p className="page-note">{t("Choose which devices, entities and scenes appear on Smart home. Changes are saved automatically and shared across screens.")}</p>
    <p className="page-note">{t("New devices and entities stay hidden until you enable them here. Other pages and Home Assistant are unchanged.")}</p>
    <fieldset className="mt-6 min-w-0" aria-describedby="visibility-filters-hint">
      <legend className="text-base font-semibold">{t("Filters")}</legend>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p id="visibility-filters-hint" className="text-sm text-muted-foreground">{t("Choose which entities to manage.")}</p>
        {hasFilters && <Button variant="ghost" onClick={() => { setSearch(""); setFilters({ domain: "all", integration: "all", room: "all", visibility: "all", category: "all" }); }}>{t("Clear filters")}</Button>}
      </div>
      <div className="planner-form"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <label className="min-w-0 text-sm font-medium sm:col-span-2 xl:col-span-3">{t("Search devices and entities")}
        <Input type="search" value={search} onChange={event => { setSearch(event.target.value); setExpansion("default"); }} placeholder={t("Search names, IDs, rooms or integrations…")} />
      </label>
      {([ ["domain", t("Domain")], ["integration", t("Integration")], ["room", t("Room")] ] as const).map(([dimension, label]) => {
        const options = [...new Map(entities.map(entity => { const group = groupFor(entity, dimension); return [group.id, group]; })).values()].sort((a, b) => a.name.localeCompare(b.name, language));
        return <label key={dimension} className="min-w-0 text-sm font-medium">{label}<select value={filters[dimension]} onChange={event => setFilters({ ...filters, [dimension]: event.target.value })}>
          <option value="all">{t("All")}</option>{options.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
        </select></label>;
      })}
      <label className="min-w-0 text-sm font-medium">{t("Visibility")}<select value={filters.visibility} onChange={event => setFilters({ ...filters, visibility: event.target.value })}>
        <option value="all">{t("All")}</option><option value="visible">{t("Visible")}</option><option value="hidden">{t("Hidden")}</option>
      </select></label>
      <label className="min-w-0 text-sm font-medium">{t("Entity category")}<select value={filters.category} onChange={event => setFilters({ ...filters, category: event.target.value })}>
        <option value="all">{t("All")}</option><option value="main">{t("Primary entities")}</option><option value="config">{t("Configuration")}</option><option value="diagnostic">{t("Diagnostic")}</option>
      </select></label>
      </div></div>
    </fieldset>
    <fieldset className="mt-6 min-w-0 border-t pt-4" aria-describedby="visibility-grouping-hint">
      <legend className="pr-3 text-base font-semibold">{t("Grouping")}</legend>
      <p id="visibility-grouping-hint" className="mb-3 text-sm text-muted-foreground">{t("Arrange the results without changing which entities match.")}</p>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="planner-form min-w-0 w-full sm:max-w-md">
          <label className="min-w-0 text-sm font-medium">{t("Group by")}
            <select value={grouping} onChange={event => { setGrouping(event.target.value as VisibilityGrouping); setExpansion("default"); }}>
              <option value="domain">{t("Domain → integration → device")}</option>
              <option value="integration">{t("Integration → domain → device")}</option>
              <option value="room">{t("Room → domain → integration → device")}</option>
              <option value="device">{t("Device → entity")}</option>
              <option value="none">{t("Entities without grouping")}</option>
            </select>
          </label>
        </div>
        {grouping !== "none" && <div className="flex flex-wrap gap-1"><Button variant="ghost" onClick={() => { setExpansion("all"); setExpansionVersion(version => version + 1); }}>{t("Expand all")}</Button><Button variant="ghost" onClick={() => { setExpansion("none"); setExpansionVersion(version => version + 1); }}>{t("Collapse all")}</Button></div>}
      </div>
    </fieldset>
    <label className="mt-6 flex min-h-12 cursor-pointer items-center justify-between gap-3 border-y py-4">
      <span className="min-w-0">
        <span className="block font-semibold">{t("Show all matching entities")}</span>
        <span role="status" className="block text-sm text-muted-foreground"><span>{t("{count} of {total} entities", { count: filtered.length, total: entities.length })}</span> · <span>{t("{visible} of {total} visible", { visible: visibleMatches, total: filtered.length })}</span></span>
      </span>
      <Switch aria-label={t("Show all matching entities")} checked={filtered.length > 0 && visibleMatches === filtered.length} disabled={disabled || !filtered.length}
        onCheckedChange={visible => setPending({ name: "", ids: filtered.map(entity => entity.preferenceId), visible, allMatches: true })} />
    </label>
    <p className="page-note">{t("Group changes affect matching entities only. Whole-device toggles keep individual choices and also hide future entities.")}</p>
    {!homeOnline && <p role="status" className="page-note">{t("Home Assistant is offline. Showing the last available devices and entities.")}</p>}
    <div className="mt-3 max-h-[32rem] overflow-y-auto pr-2">
      <ul key={JSON.stringify([grouping, search, filters, expansion, expansionVersion])} aria-label={t("Visibility groups")}>{grouping === "none" ? filtered.map(entity => <li key={entity.preferenceId}>{entityRow(entity)}</li>) : groupRows(groups)}</ul>
      {!filtered.length && <p className="empty-note">{entities.length ? t("No matching entities. Change or clear the filters.") : t("No devices available.")}</p>}
    </div>
    <ConfirmDialog open={!!pending} onOpenChange={open => { if (!open) setPending(null); }} title="Are you sure?" disabled={disabled}
      description={pending ? { key: pending.allMatches
        ? pending.visible ? "Show all entities matching the filters ({count})? Other entities stay unchanged." : "Hide all entities matching the filters ({count})? Other entities stay unchanged."
        : pending.deviceId
        ? pending.visible ? "Show {name} and its {count} entities again? Individual visibility choices will be kept." : "Hide {name} and its {count} entities? Future entities on this device will also be hidden."
        : pending.visible ? "Show the {count} matching entities in {name}? Other entities stay unchanged." : "Hide the {count} matching entities in {name}? Other entities stay unchanged.",
      values: { name: pending.name, count: pending.ids.length } } : ""}
      confirmLabel={pending?.allMatches ? pending.visible ? "Show all matches" : "Hide all matches" : pending?.visible ? "Show group" : "Hide group"}
      onConfirm={() => pending ? (pending.deviceId ? setSmartHomeDeviceVisible(pending.deviceId, pending.visible) : setSmartHomeEntitiesVisible(pending.ids, pending.visible)) : false} />
    <p role="status" className="page-note">{shared?.state.saving ? t("Saving shared configuration…") : shared?.state.dirty ? t("Unsaved changes on this screen.") : shared?.state.loaded ? t("Shared configuration saved.") : t("Loading shared configuration…")}</p>
    {shared?.state.error && <div role="alert"><p className="text-destructive">{message(shared.state.error)}</p><Link to="/user-settings" className="text-link">{t("App preferences")}</Link></div>}
  </section>;
}
