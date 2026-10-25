import { useEffect, useRef, useState } from "react";
import { Link, useBeforeUnload, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, ChevronRight, Layers3, Plus, Search, Trash2 } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { newPlannerId, useFamily } from "@/contexts/FamilyContext";
import { useSharedConfiguration } from "@/contexts/SharedConfigurationContext";
import { useI18n } from "@/hooks/use-i18n";
import { smartHomeCards } from "@/lib/smart-home-cards";
import { recommendedMainEntity, recommendedSupportingEntities } from "@/lib/smart-home-recommendations";
import { deviceName, smartHomeEntities } from "@/lib/device-model";
import type { Entity } from "@/types/api";
import { EntityPicker } from "./EntityPicker";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { cardDensitySchema, type DeviceCardSettings } from "../../shared/configuration";
import { cardDesigns, type CardDesign } from "./devices/card-designs";
import { cardVariants } from "./devices/card-presentation";
import { SmartHomeCard } from "./devices/SmartHomeCard";
import "./devices/device-cards.css";
import "./smart-home-settings.css";

type Draft = DeviceCardSettings;

function CardEditor({ card, disabled, onClose }: { card?: Draft; disabled: boolean; onClose: () => void }) {
  const { message: t, language } = useI18n();
  const { currentHome, homeOnline } = useApp();
  const { smartHome, saveSmartHomeCard, removeSmartHomeCard } = useFamily();
  const [draft, setDraft] = useState<Draft | undefined>(card);
  const [search, setSearch] = useState("");
  const [device, setDevice] = useState<string>();
  const entities = smartHomeEntities(currentHome.entities);
  const [showAll, setShowAll] = useState(!entities.length);
  const [confirm, setConfirm] = useState<"discard" | "remove">();
  const heading = useRef<HTMLHeadingElement>(null);
  const mainSources = useRef<HTMLDivElement>(null);
  const supportingSources = useRef<HTMLDivElement>(null);
  const design = cardDesigns.find(design => design.id === draft?.type);
  const main = entities.find(entity => entity.preferenceId === draft?.mainEntity && design?.domains.includes(entity.domain));
  const dirty = !!draft && JSON.stringify(draft) !== JSON.stringify(card);
  useBeforeUnload(event => { if (dirty) { event.preventDefault(); event.returnValue = ""; } });
  useEffect(() => { heading.current?.focus(); }, [design?.id]);
  const chooseType = (design: CardDesign) => setDraft({
    id: card?.id ?? newPlannerId(), type: design.id as Draft["type"], title: "", mainEntity: "", linkedEntities: [], group: "", density: "supercompact",
  });
  const change = (fields: Partial<Draft>) => setDraft(current => current ? { ...current, ...fields } : current);
  const groups = [...new Set(smartHome.layout.map(card => card.group).filter(Boolean))];
  const candidates = entities.filter(entity => design?.domains.includes(entity.domain));
  const selectedDevice = device ?? (main ? main.device?.id ?? "none" : undefined);
  const devices = [...new Map(candidates.flatMap(entity => entity.device ? [[entity.device.id, entity.device] as const] : [])).values()]
    .sort((a, b) => deviceName(a, language).localeCompare(deviceName(b, language), language));
  const onDevice = (entity: Entity) => (entity.device?.id ?? "none") === selectedDevice;
  const deviceCandidates = candidates.filter(onDevice);
  const supporting = entities.filter(entity => entity.preferenceId !== draft?.mainEntity);
  const deviceSupporting = supporting.filter(onDevice);
  const deviceSupportingIds = new Set(deviceSupporting.map(entity => entity.preferenceId));
  const localLinks = draft?.linkedEntities.filter(id => deviceSupportingIds.has(id)) ?? [];
  // Keep cross-device and missing selections editable when the main device changes.
  const otherLinks = draft?.linkedEntities.filter(id => !deviceSupportingIds.has(id)) ?? [];
  const [otherOpen, setOtherOpen] = useState(otherLinks.length > 0);
  const suggestedMain = !draft?.mainEntity && homeOnline ? recommendedMainEntity(deviceCandidates) : undefined;
  const suggestions = draft && homeOnline ? recommendedSupportingEntities(draft.type, main, entities, draft.linkedEntities) : [];
  const selectMain = (mainEntity: string) => change({ mainEntity, linkedEntities: draft?.linkedEntities.filter(id => id !== mainEntity) ?? [] });
  const types = cardDesigns.filter(design => (showAll || entities.some(entity => design.domains.includes(entity.domain)))
    && `${t(design.subtitle)} ${t(design.group)} ${design.domains.join(" ")}`.toLocaleLowerCase(language).includes(search.trim().toLocaleLowerCase(language)));
  const title = card ? t("Edit card") : design ? t("New {type} card", { type: t(design.subtitle).toLocaleLowerCase(language) }) : t("Choose a card type");
  return <section className="smart-builder" aria-label={t("Card editor")}>
    <Button variant="ghost" className="smart-builder-back" onClick={() => dirty ? setConfirm("discard") : onClose()}><ArrowLeft size={17} aria-hidden="true" />{t("Your cards")}</Button>
    <div className="smart-builder-heading"><h2 ref={heading} tabIndex={-1}>{title}</h2>{draft && <Button form="smart-card-form" type="submit" disabled={disabled || !draft.mainEntity || !dirty}>{t(card ? "Save changes" : "Add card")}</Button>}</div>
    {!design || !draft ? <>
      <p className="page-note">{t("Start with what you want to control or see. Attach its entities next.")}</p>
      <div className="smart-type-tools"><label className="smart-type-search"><Search size={18} aria-hidden="true" /><Input aria-label={t("Search card types")} type="search" placeholder={t("Search card types")} value={search} onChange={event => setSearch(event.target.value)} /></label>
        <label className="smart-type-all"><input type="checkbox" checked={showAll} onChange={event => setShowAll(event.target.checked)} />{t("Show all types")}</label>
      </div>
      <div className="smart-type-catalog">{[...new Set(types.map(type => type.group))].map(group => <section key={group}><h3>{t(group)}</h3><div className="smart-type-grid">{types.filter(design => design.group === group).map(design => {
        const count = entities.filter(entity => design.domains.includes(entity.domain)).length;
        return <button className="smart-type-choice" key={design.id} disabled={disabled} onClick={() => chooseType(design)}><design.icon size={23} strokeWidth={1.7} aria-hidden="true" /><span><strong>{t(design.subtitle)}</strong><small>{count ? t("{count} available", { count }) : t("No matching entities")}</small></span><ChevronRight size={16} aria-hidden="true" /></button>;
      })}</div></section>)}</div>
      {!types.length && <p className="empty-note">{t("No matching card types. Change your search or show all types.")}</p>}
      <Link className="text-link smart-catalog-link" to="/device-gallery">{t("Explore device card designs")}<ArrowUpRight size={16} aria-hidden="true" /></Link>
    </> : <div>
      <p className="page-note smart-builder-help">{t("Choose your sources and see the resulting card. Suggestions are added only when you choose them.")}</p>
      <div className="smart-compose">
        <div className="smart-compose-fields">
              <div ref={mainSources} className="smart-source-slot planner-form">
                <label className="smart-card-device">{t("Device")}<select value={selectedDevice ?? ""} disabled={disabled} onChange={event => { setDevice(event.target.value); if (draft.linkedEntities.length) setOtherOpen(true); change({ mainEntity: "" }); }}>
                  <option value="" disabled>{t("Choose a device")}</option>
                  {devices.map(device => <option key={device.id} value={device.id}>{deviceName(device, language)}</option>)}
                  {candidates.some(entity => !entity.device) && <option value="none">{t("Without a device")}</option>}
                </select></label>
                <EntityPicker label={t("Main entity")} ariaLabel={t("Main entity")} groupByDevice={false} entities={deviceCandidates} value={draft.mainEntity} disabled={disabled || selectedDevice === undefined} onChange={selectMain} />
                <p>{t("This entity supplies the card’s main controls and state.")}</p>
                {suggestedMain && <div className="smart-suggestions"><h3>{t("Recommended main entity")}</h3><Button type="button" variant="outline" disabled={disabled} onClick={() => { selectMain(suggestedMain.preferenceId); mainSources.current?.querySelector("button")?.focus(); }}>{t("Use {name}", { name: suggestedMain.name })}</Button></div>}
                {!candidates.length && <p role="status">{t(homeOnline ? "No matching entities. Choose another card type or check Home Assistant." : "Connect to Home Assistant to choose an entity.")}</p>}
              </div>
              <div ref={supportingSources} className="smart-source-slot smart-source-supporting planner-form"><EntityPicker multiple label={t("Supporting entities")} ariaLabel={t("Supporting entities")} groupByDevice={false} placeholder={t("Add readings, controls or images")} entities={deviceSupporting} value={localLinks} disabled={disabled || selectedDevice === undefined} onChange={linkedEntities => change({ linkedEntities: [...linkedEntities, ...otherLinks] })} />
                <p>{t("Only entities from the selected device are shown.")}</p>
                {!!suggestions.length && <section className="smart-suggestions" aria-label={t("Suggested for this card")}><h3>{t("Suggested for this card")}</h3><p>{t("Based on the card type and this device’s reported entities.")}</p>
                  {suggestions.map(({ entity, reason }) => <button type="button" key={entity.preferenceId} className="smart-suggestion" disabled={disabled} aria-label={t("Add {name}", { name: entity.name })} onClick={() => { change({ linkedEntities: [...draft.linkedEntities, entity.preferenceId] }); supportingSources.current?.querySelector("button")?.focus(); }}><span><strong>{entity.name}</strong><small>{t(reason)}</small></span><Plus size={18} aria-hidden="true" /></button>)}
                </section>}
                <details className="smart-other-entities" open={otherOpen} onToggle={event => setOtherOpen(event.currentTarget.open)}><summary>{t("Add entities from other devices")}</summary>
                  <EntityPicker multiple label={t("Entities from other devices")} placeholder={t("Add readings, controls or images")} entities={supporting.filter(entity => !onDevice(entity))} value={otherLinks} disabled={disabled || selectedDevice === undefined} onChange={linkedEntities => change({ linkedEntities: [...localLinks, ...linkedEntities] })} />
                  <p>{t("Include extra readings, controls or standalone entities on this card.")}</p>
                </details>
              </div>
        <form id="smart-card-form" className="smart-compose-options planner-form" onSubmit={event => {
            event.preventDefault();
            if (!disabled && draft.mainEntity && saveSmartHomeCard({ ...draft, title: draft.title.trim(), group: draft.group.trim() })) onClose();
          }}>
          <label>{t("Card name")}<Input value={draft.title} maxLength={100} placeholder={main?.name || t(design.subtitle)} disabled={disabled} onChange={event => change({ title: event.target.value })} /></label>
          <label>{t("Card type")}<select value={draft.type} disabled={disabled} onChange={event => {
            const type = cardDesigns.find(design => design.id === event.target.value)!;
            setDevice(undefined);
            change({ type: type.id as Draft["type"], mainEntity: "" });
          }}>{cardDesigns.map(type => <option key={type.id} value={type.id}>{t(type.subtitle)}</option>)}</select></label>
          <label>{t("Card size")}<select value={draft.density} disabled={disabled} onChange={event => change({ density: cardDensitySchema.parse(event.target.value) })}>{cardDensitySchema.options.map(size => <option key={size} value={size}>{t(cardVariants[size])}</option>)}</select></label>
          <label>{t("Card group")}<Input list="smart-card-groups" maxLength={80} value={draft.group} disabled={disabled} placeholder={t("Ungrouped")} onChange={event => change({ group: event.target.value })} /><datalist id="smart-card-groups">{groups.map(group => <option key={group} value={group} />)}</datalist></label>
          <p className="page-note">{t("Use the same group name to keep related cards together.")}</p>
          {card && <Button type="button" variant="ghost" className="smart-remove-card" disabled={disabled} onClick={() => setConfirm("remove")}><Trash2 size={17} aria-hidden="true" />{t("Remove card")}</Button>}
        </form>
        </div>
        <aside className="smart-compose-preview" aria-label={t("Card preview")}>
          <h3>{t("Card preview")}</h3><p className="page-note">{t("Your Smart home card, with the selected name, size and entities. Controls and media are paused.")}</p>
          <SmartHomeCard entity={main} title={draft.title || main?.name || t(design.subtitle)} design={design} density={draft.density} preview
            entities={supporting.filter(entity => draft.linkedEntities.includes(entity.preferenceId))} />
        </aside>
      </div>
      <div className="smart-builder-actions"><span>{t("Changes appear on every screen after you save.")}</span><Button type="button" variant="outline" onClick={() => dirty ? setConfirm("discard") : onClose()}>{t("Cancel")}</Button><Button form="smart-card-form" type="submit" disabled={disabled || !draft.mainEntity || !dirty}>{t(card ? "Save changes" : "Add card")}</Button></div>
    </div>}
    <ConfirmDialog open={!!confirm} onOpenChange={open => { if (!open) setConfirm(undefined); }} title={confirm === "remove" ? "Remove this card?" : "Discard card changes?"}
      description={confirm === "remove" ? "The card will be removed from every screen. Its Home Assistant entities will be kept." : "Your unsaved changes to this card will be lost."}
      confirmLabel={confirm === "remove" ? "Remove card" : "Discard changes"} destructive disabled={disabled && confirm === "remove"}
      onConfirm={() => { if (confirm === "remove" && (!card || !removeSmartHomeCard(card.id))) return false; onClose(); }} />
  </section>;
}

export function SmartHomeSettings() {
  const { message: t } = useI18n();
  const { currentHome, homeOnline } = useApp();
  const { smartHome, clearSmartHome } = useFamily();
  const shared = useSharedConfiguration();
  const [params, setParams] = useSearchParams();
  const [reset, setReset] = useState(false);
  const selectedId = params.get("card");
  const selected = smartHome.layout.find(card => card.id === selectedId);
  const disabled = !shared?.state.loaded || !!shared.state.error;
  const cards = smartHomeCards(currentHome.entities, smartHome);
  const open = (id?: string) => setParams(id ? { card: id } : {});
  return <div className="smart-settings">
    {selectedId === "new" || selected ? <CardEditor key={selectedId} card={selected} disabled={disabled} onClose={() => open()} /> : <>
      <section className="smart-collection" aria-label={t("Your cards")}>
        <div className="smart-builder-heading"><div><h2>{t("Your cards")}</h2><p className="page-note">{t("Choose what belongs on your dashboard, one card at a time.")}</p></div><Button disabled={disabled} onClick={() => open("new")}><Plus size={18} aria-hidden="true" />{t("Add card")}</Button></div>
        {!!selectedId && <p role="status">{t("This card no longer exists. Choose another or add a new one.")}</p>}
        {cards.length ? <ul className="smart-card-list">{cards.map(card => <li key={card.id}><button onClick={() => open(card.id)} className="smart-card-row"><span className="smart-card-row-icon glass-surface"><card.design.icon size={22} strokeWidth={1.7} aria-hidden="true" /></span><span className="smart-card-row-copy"><strong>{card.title || card.main?.name || t(card.design.subtitle)}</strong><small>{[t(card.design.subtitle), card.group, t(card.linkedEntities.length ? "{count} entities" : "1 entity", { count: card.linkedEntities.length + 1 })].filter(Boolean).join(" · ")}</small>{!card.main && <small className="smart-card-missing">{t("Main entity unavailable · choose a replacement")}</small>}</span><ChevronRight size={18} aria-hidden="true" /></button></li>)}</ul>
          : <div className="smart-collection-empty"><Layers3 size={38} strokeWidth={1.4} aria-hidden="true" /><h3>{t("A place for the things you use")}</h3><p>{t("Start with a light, thermostat or any card you need. Then attach its entities and see it take shape.")}</p></div>}
        <div className="smart-collection-links"><Link className="text-link" to="/home">{t("Open Smart home")}<ArrowUpRight size={16} aria-hidden="true" /></Link>{!!cards.length && <span>{t("Reorder cards and groups from Configure on Smart home.")}</span>}</div>
      </section>
      <section className="smart-danger" aria-labelledby="smart-danger-title"><h2 id="smart-danger-title">{t("Danger zone")}</h2><div><span><strong>{t("Start from an empty dashboard")}</strong><p>{t("Remove every Smart home card and group. Today’s favourites and Home Assistant devices stay as they are.")}</p></span><Button variant="outline" className="smart-remove-card" disabled={disabled || !cards.length} onClick={() => setReset(true)}><Trash2 size={17} aria-hidden="true" />{t("Clear Smart home")}</Button></div><Link className="text-link" to="/settings/backups">{t("Back up settings first")}<ArrowUpRight size={15} aria-hidden="true" /></Link></section>
    </>}
    <div className="smart-settings-status"><p role="status">{shared?.state.saving ? t("Saving shared configuration…") : shared?.state.dirty ? t("Unsaved changes on this screen.") : shared?.state.loaded ? t("Shared configuration saved.") : t("Loading shared configuration…")}</p>
      {!homeOnline && <p>{t("Home Assistant is offline. Showing the last available devices and entities.")}</p>}
      {shared?.state.error && <div role="alert"><p>{t(shared.state.error)}</p><Link className="text-link" to="/settings/backups">{t("Storage and backups")}</Link></div>}
    </div>
    <ConfirmDialog open={reset} onOpenChange={setReset} title="Clear Smart home?" destructive disabled={disabled} confirmLabel="Clear Smart home"
      description="All Smart home cards, groups and scene cards will be removed from every screen. Today’s favourites, other settings and Home Assistant devices will be kept. Restore a settings backup if you need this layout again."
      onConfirm={clearSmartHome} />
  </div>;
}
