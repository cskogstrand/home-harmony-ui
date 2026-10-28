import { useState } from "react";
import { ArrowDown, ArrowUp, GripVertical, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { useFamily } from "@/contexts/FamilyContext";
import { useSharedConfiguration } from "@/contexts/SharedConfigurationContext";
import { useI18n } from "@/hooks/use-i18n";
import { useCardDrag } from "@/hooks/use-card-drag";
import { smartHomeCards } from "@/lib/smart-home-cards";
import { cardDensitySchema } from "../../../shared/configuration";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cardVariants } from "./card-presentation";
import { CardGroup } from "./CardGroup";
import { SmartHomeCard } from "./SmartHomeCard";

export function SmartHomeCards({ cards, area, editing }: { cards: ReturnType<typeof smartHomeCards>; area: string; editing: boolean }) {
  const { message: t, language } = useI18n();
  const { moveSmartHomeCard, setSmartHomeCardDensity } = useFamily();
  const shared = useSharedConfiguration();
  const [newGroup, setNewGroup] = useState("");
  const [emptyGroups, setEmptyGroups] = useState<string[]>([]);
  const [announcement, setAnnouncement] = useState("");
  const disabled = !shared?.state.loaded || !!shared.state.error;
  const visible = cards.filter(card => area === "all" || card.main?.areaId === area);
  const groups = [...new Set([...visible.map(card => card.group), ...(editing ? ["", ...emptyGroups, ...cards.map(card => card.group)] : [])])]
    .sort((a, b) => Number(!a) - Number(!b) || a.localeCompare(b, language));
  const move = (id: string, group: string, beforeId?: string) => {
    if (disabled) return;
    const focused = document.activeElement as HTMLElement | null;
    const control = focused?.closest<HTMLElement>("[data-smart-card]")?.dataset.smartCard === id ? focused.dataset.editorControl : undefined;
    if (moveSmartHomeCard(id, group, beforeId)) {
      setAnnouncement(t("Moved {name} to {group}.", { name: cards.find(card => card.id === id)?.name ?? "", group: group || t("Ungrouped") }));
      if (control) requestAnimationFrame(() => {
        const item = [...document.querySelectorAll<HTMLElement>("[data-smart-card]")].find(item => item.dataset.smartCard === id);
        const target = item?.querySelector<HTMLElement>(`[data-editor-control="${control}"]:not(:disabled)`) ?? item?.querySelector<HTMLElement>('[data-editor-control="group"]');
        target?.focus();
      });
    }
  };
  const drag = useCardDrag(editing && !disabled, move);
  return <>
    {editing && <div className="smart-editor-toolbar">
      <div><strong>{t("Configure cards")}</strong><p>{t("Drag cards to reorder or move between groups. You can also use the move buttons and group menu.")}</p></div>
      <form className="smart-new-group" onSubmit={event => { event.preventDefault(); const name = newGroup.trim(); if (name && !disabled) { setEmptyGroups(current => [...new Set([...current, name])]); setNewGroup(""); setAnnouncement(t("Group ready. Move a card into {group} to save it.", { group: name })); } }}>
        <Input aria-label={t("New group name")} placeholder={t("New group name")} value={newGroup} maxLength={80} disabled={disabled} onChange={event => setNewGroup(event.target.value)} />
        <Button className="mobile-icon-button" type="submit" variant="outline" disabled={disabled || !newGroup.trim()}><Plus size={17} aria-hidden="true" /><span className="max-[700px]:sr-only">{t("Add group")}</span></Button>
      </form>
      <p role="status">{shared?.state.saving ? t("Saving shared configuration…") : shared?.state.dirty ? t("Unsaved changes on this screen.") : t("Shared configuration saved.")}</p>
      {shared?.state.error && <div role="alert"><p>{t(shared.state.error)}</p><Link className="text-link" to="/settings/backups">{t("Storage and backups")}</Link></div>}
    </div>}
    <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
    <div className={`smart-card-groups${editing ? " is-editing" : ""}`}>{groups.map(group => {
      const members = visible.filter(card => card.group === group);
      return <section key={group} data-smart-group={editing ? group : undefined} aria-label={group || t("Ungrouped")}>
        {(editing || group || groups.length > 1) && <h3 className="smart-card-group-title">{group || t("Ungrouped")}<span>{members.length}</span></h3>}
        <CardGroup>{members.map((card, index) => <div key={card.id} data-smart-card={card.id} className={`smart-card-item${drag.dragging?.id === card.id ? " is-dragging" : ""}${drag.dragging?.target?.beforeId === card.id ? " is-drop-target" : ""}`}>
          {editing && <div className="smart-card-editor planner-form" aria-label={t("Configure {name}", { name: card.name })}>
            <div className="smart-card-move">
              <button type="button" className="smart-drag-handle" tabIndex={-1} aria-hidden="true" title={t("Drag to move")} disabled={disabled}
                onPointerDown={event => drag.start(card.id, event)} onPointerMove={drag.move} onPointerUp={drag.drop} onPointerCancel={drag.cancel} onLostPointerCapture={drag.cancel}><GripVertical size={21} /></button>
              <span>{t("Card {position} of {total}", { position: index + 1, total: members.length })}</span>
              <Button data-editor-control="earlier" variant="ghost" size="icon" disabled={disabled || index === 0} aria-label={t("Move {name} earlier", { name: card.name })} onClick={() => move(card.id, group, members[index - 1].id)}><ArrowUp size={18} /></Button>
              <Button data-editor-control="later" variant="ghost" size="icon" disabled={disabled || index === members.length - 1} aria-label={t("Move {name} later", { name: card.name })} onClick={() => move(card.id, group, members[index + 2]?.id)}><ArrowDown size={18} /></Button>
            </div>
            <div className="smart-card-edit-fields">
              <label>{t("Card size")}<select aria-label={t("Card size for {name}", { name: card.name })} disabled={disabled} value={card.density} onChange={event => setSmartHomeCardDensity(card.id, cardDensitySchema.parse(event.target.value))}>
                {cardDensitySchema.options.map(size => <option key={size} value={size}>{t(cardVariants[size])}</option>)}
              </select></label>
              <label>{t("Card group")}<select data-editor-control="group" aria-label={t("Card group for {name}", { name: card.name })} disabled={disabled} value={group} onChange={event => move(card.id, event.target.value)}>
                {groups.map(name => <option key={name} value={name}>{name || t("Ungrouped")}</option>)}
              </select></label>
            </div>
            <Link className="text-link" to={`/settings/smart-home?card=${encodeURIComponent(card.id)}`}>{t("Edit card")}</Link>
          </div>}
          <div className="smart-card-preview" ref={node => { if (node) node.inert = editing; }}><SmartHomeCard entity={card.main} entities={card.entities} title={card.name} design={card.design} density={card.density} preview={editing} editTo={`/settings/smart-home?card=${encodeURIComponent(card.id)}`} /></div>
        </div>)}</CardGroup>
        {editing && <div className={`smart-group-drop${drag.dragging?.target?.group === group && !drag.dragging.target.beforeId ? " is-drop-target" : ""}`}>
          {t(members.length ? "Drop here to place at the end" : "Drop a card here, or choose this group from a card’s menu")}
        </div>}
      </section>;
    })}</div>
    {drag.dragging && <div className="smart-drag-label" style={{ left: Math.min(drag.dragging.x + 16, window.innerWidth - 220), top: drag.dragging.y + 16 }} aria-hidden="true">{cards.find(card => card.id === drag.dragging.id)?.name}</div>}
  </>;
}
