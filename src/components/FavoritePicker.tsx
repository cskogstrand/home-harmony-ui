import { useId, useRef, useState } from "react";
import { Check, ChevronDown, Heart, Layers, LayoutGrid, Plus, Radio, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import { useSharedConfiguration } from "@/contexts/SharedConfigurationContext";
import { useI18n } from "@/hooks/use-i18n";
import { msg, type Message } from "@/lib/i18n";
import type { Planner } from "../../shared/configuration";
import { EntityPicker } from "./EntityPicker";
import { PanelTitle } from "./PanelTitle";
import { ConfirmDialog } from "./common/ConfirmDialog";
import { SmartHomeCard } from "./devices/SmartHomeCard";
import { cardDesignFor, cardDesigns } from "./devices/card-designs";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "./ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import "./favorite-picker.css";

function FavoriteGroupPicker({ name, value, groups, disabled, onChange }: { name: string; value: string; groups: string[]; disabled: boolean; onChange: (group: string) => void }) {
  const { t, language } = useI18n();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const choices = ["", ...groups].filter(group => (group || t("Ungrouped")).toLocaleLowerCase(language).includes(search.trim().toLocaleLowerCase(language)));
  return <div className="favorite-group-field"><label htmlFor={id}>{t("Card group")}</label>
    <Popover modal open={open} onOpenChange={open => { setOpen(open); if (open) setSearch(""); }}>
      <PopoverTrigger asChild><Button id={id} type="button" variant="outline" disabled={disabled} aria-label={t("Card group for {name}", { name })} aria-describedby={`${id}-value`} className="favorite-group-trigger"><span id={`${id}-value`}>{value || t("Ungrouped")}</span><ChevronDown aria-hidden="true" /></Button></PopoverTrigger>
      <PopoverContent align="start" collisionPadding={12} className="favorite-group-popover" aria-label={t("Card group for {name}", { name })}>
        <Command label={t("Search groups")} defaultValue={`group:${value}`} shouldFilter={false}><CommandInput placeholder={t("Search groups")} value={search} onValueChange={setSearch} />
          <CommandList label={t("Card groups")}><CommandEmpty>{t("No matching groups.")}</CommandEmpty>
            {choices.map(group => <CommandItem key={group} value={`group:${group}`} disabled={disabled} onSelect={() => { if (!disabled) { onChange(group); setOpen(false); } }}><span>{group || t("Ungrouped")}</span>{value === group && <Check aria-hidden="true" />}</CommandItem>)}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  </div>;
}

export function FavoritePicker({ selected, groups, savedGroups, onSave, onCancel }: { selected: string[]; groups: Planner["homeEntityGroups"]; savedGroups: string[]; onSave: (ids: string[], groups: Planner["homeEntityGroups"], groupNames: string[]) => void; onCancel: () => void }) {
  const { t, message, language } = useI18n();
  const { currentHome } = useApp();
  const shared = useSharedConfiguration();
  const disabled = !shared?.state.loaded || !!shared.state.error;
  const [draft, setDraft] = useState(selected);
  const [draftGroups, setDraftGroups] = useState(groups);
  const [groupNames, setGroupNames] = useState(() => [...new Set([...savedGroups, ...Object.values(groups)].filter(Boolean))]);
  const [newGroup, setNewGroup] = useState("");
  const newGroupInput = useRef<HTMLInputElement>(null);
  const duplicateGroup = groupNames.some(group => group.toLocaleLowerCase(language) === newGroup.trim().toLocaleLowerCase(language));
  const [removal, setRemoval] = useState<{ ids: string[]; description: Message }>();
  const [type, setType] = useState<string>();
  const types = cardDesigns.map(design => ({ id: design.id, label: message(design.subtitle), entities: currentHome.entities.filter(entity => design.domains.includes(entity.domain)) }));
  types.push({ id: "other", label: t("Other entities"), entities: currentHome.entities.filter(entity => !cardDesignFor(entity.domain)) });
  const availableTypes = types.filter(type => type.entities.length);
  const active = availableTypes.find(item => item.id === type) ?? availableTypes[0];
  const activeIds = new Set(active?.entities.map(entity => entity.preferenceId));
  const change = (ids: string[]) => {
    const removed = draft.find(id => !ids.includes(id));
    if (!removed) { setDraft(ids); return; }
    const entity = currentHome.entities.find(entity => entity.preferenceId === removed);
    setRemoval({ ids, description: msg(entity ? "Remove “{name}” from your favorites selection? Save favorites to apply this change." : "Remove unavailable favorite “{name}” from your selection? Save favorites to apply this change.", { name: entity?.name ?? removed.slice(removed.indexOf("|") + 1) }) });
  };
  return <>
    <div className="favorite-picker-body">
      {active ? <section className="favorite-catalog glass-surface" aria-label={t("Choose a card type")}>
        <PanelTitle as="h3" icon={LayoutGrid}>{t("Choose a card type")}</PanelTitle>
        <p className="favorite-preview-note">{t("Choose a type to find your devices.")}</p>
        <div className="favorite-types" role="group" aria-label={t("Card types")}>
          {availableTypes.map(item => <div key={item.id} className="favorite-type">
            <button type="button" className="favorite-type-choice" aria-label={`${item.label} ${t("{count} available", { count: item.entities.length })}`} aria-pressed={item === active} onClick={() => setType(item.id)}><span><strong>{item.label}</strong><small><span>{t("Available: {count}", { count: item.entities.length })}</span>{item === active && <Check size={16} aria-hidden="true" />}</small></span></button>
            <div className="favorite-type-preview" aria-hidden="true" ref={node => { if (node) node.inert = true; }}>
              <SmartHomeCard entity={item.entities[0]} preview />
            </div>
          </div>)}
        </div>
        <div className="favorite-entity-choice">
        <EntityPicker key={active.id} multiple label={t("Choose favorites: {type}", { type: active.label })} entities={active.entities}
          value={draft.filter(id => activeIds.has(id))} disabled={disabled} placeholder={t("Choose your dashboard favorites.")}
          onChange={ids => change([...draft.filter(id => !activeIds.has(id) || ids.includes(id)), ...ids.filter(id => !draft.includes(id))])} />
        </div>
      </section> : <p className="empty-note">{t("No entities available.")}</p>}
      <section className="favorite-groups" aria-label={t("Card groups")}>
        <PanelTitle as="h3" icon={Layers}>{t("Card groups")}</PanelTitle>
        <p className="favorite-preview-note">{t("Create groups here, then choose a group for each card.")}</p>
        <form className="favorite-new-group" onSubmit={event => { event.preventDefault(); if (disabled || !newGroup.trim() || duplicateGroup) return; setGroupNames([...groupNames, newGroup.trim()]); setNewGroup(""); newGroupInput.current?.focus(); }}>
          <label><span>{t("New group name")}</span><Input ref={newGroupInput} value={newGroup} maxLength={80} disabled={disabled} onChange={event => setNewGroup(event.target.value)} /></label>
          <Button type="submit" variant="outline" disabled={disabled || !newGroup.trim() || duplicateGroup}><Plus aria-hidden="true" />{t("Add group")}</Button>
        </form>
        {duplicateGroup && <p className="favorite-preview-note" role="status">{t("A group with this name already exists.")}</p>}
        {!!groupNames.length && <ul className="favorite-group-names" aria-live="polite">{groupNames.map(group => <li key={group}><span>{group}</span><Button type="button" size="icon" variant="ghost" disabled={disabled} aria-label={t("Remove group {name}", { name: group })} title={t("Remove group {name}", { name: group })} onClick={() => { setGroupNames(groupNames.filter(name => name !== group)); setDraftGroups(Object.fromEntries(Object.entries(draftGroups).filter(([, name]) => name !== group))); newGroupInput.current?.focus(); }}><X aria-hidden="true" /></Button></li>)}</ul>}
        {!!groupNames.length && <p className="favorite-preview-note">{t("Removing a group leaves its cards ungrouped.")}</p>}
      </section>
      <section className="favorite-selection" aria-label={t("Selected favorites")}>
        <PanelTitle as="h3" icon={Heart}>{t("Selected favorites")}</PanelTitle>
        {!!draft.length && <p className="favorite-preview-note">{t("Preview your favorites and choose a group for each card.")}</p>}
        {draft.length ? <ul>{draft.map(id => {
          const entity = currentHome.entities.find(entity => entity.preferenceId === id);
          const name = entity?.name ?? id.slice(id.indexOf("|") + 1);
          return <li key={id} aria-label={name}>
            {entity ? <div className="favorite-selected-preview" aria-hidden="true" ref={node => { if (node) node.inert = true; }}><SmartHomeCard entity={entity} preview /></div>
              : <div className="favorite-unavailable glass-surface"><Radio aria-hidden="true" /><div><strong>{name}</strong><p>{t("Entity unavailable")}</p></div></div>}
            <div className="favorite-card-settings"><FavoriteGroupPicker name={name} value={draftGroups[id] ?? ""} groups={groupNames} disabled={disabled} onChange={group => setDraftGroups({ ...draftGroups, [id]: group })} /><Button variant="ghost" size="icon" disabled={disabled} aria-label={t("Remove {name} from favorites", { name })} title={t("Remove {name} from favorites", { name })} onClick={() => change(draft.filter(value => value !== id))}><X size={16} aria-hidden="true" /></Button></div>
          </li>;
        })}</ul> : <p className="empty-note">{t("No favorites selected.")}</p>}
      </section>
      {shared?.state.error && <div role="alert"><p className="text-destructive">{message(shared.state.error)}</p><Link className="text-link" to="/settings/backups">{t("Storage and backups")}</Link></div>}
    </div>
    <div className="favorite-picker-footer"><span role="status">{t("{count} selected", { count: draft.length })}</span><Button variant="ghost" disabled={disabled || !draft.length} onClick={() => setRemoval({ ids: [], description: msg("Clear all favorites from your selection? Save favorites to apply this change to the dashboard.") })}>{t("Clear all")}</Button><Button variant="ghost" onClick={onCancel}>{t("Cancel")}</Button><Button disabled={disabled} onClick={() => onSave(draft, draftGroups, groupNames)}>{t("Save favorites")}</Button></div>
    {removal && <ConfirmDialog open onOpenChange={open => { if (!open) setRemoval(undefined); }} title={t("Remove favorites?")} description={removal.description} confirmLabel={t("Remove favorites")} destructive disabled={disabled} onConfirm={() => setDraft(removal.ids)} />}
  </>;
}
