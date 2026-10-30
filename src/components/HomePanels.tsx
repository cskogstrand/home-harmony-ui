import { PanelTitle } from "@/components/PanelTitle";
import { msg, type Message } from "@/lib/i18n";
import { useI18n } from "@/hooks/use-i18n";
import { useState } from "react";
import { z } from "zod";
import { Link } from "react-router-dom";
import { CarFront, Sparkles, ArrowUpRight, Settings, Volume2, Sunrise, Heart, Sun, Moon, Coffee, CalendarDays, CalendarCheck, ClipboardList, ListChecks, Bell, House, type LucideIcon } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useFamily } from "@/contexts/FamilyContext";
import { available, supportsAction } from "@/lib/ha-model";
import type { Entity } from "@/types/api";
import { CommandFeedback } from "@/components/devices/DeviceControl";
import { EntityCard } from "@/components/devices/EntityCard";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { EntityPicker } from "./EntityPicker";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { MemberAvatar, PanelHeading } from "./FamilyPlanner";

const morningMessageSchema = z.object({ key: z.string(), name: z.string(), emoji: z.string(), text: z.string().refine(text => !!text.trim()) });

const morningSummaryIcons = new Map<string, LucideIcon>([
  ["sunrise", Sunrise],
  ["mdi:weather-sunset-up", Sunrise],
  ["sun", Sun],
  ["mdi:weather-sunny", Sun],
  ["moon", Moon],
  ["mdi:weather-night", Moon],
  ["coffee", Coffee],
  ["mdi:coffee", Coffee],
  ["calendar-days", CalendarDays],
  ["mdi:calendar", CalendarDays],
  ["calendar-check", CalendarCheck],
  ["mdi:calendar-check", CalendarCheck],
  ["clipboard-list", ClipboardList],
  ["mdi:clipboard-list", ClipboardList],
  ["list-checks", ListChecks],
  ["mdi:format-list-checks", ListChecks],
  ["bell", Bell],
  ["mdi:bell", Bell],
  ["house", House],
  ["mdi:home", House],
]);

export function MorningSummary() {
  const { t } = useI18n();
  const { currentHome, homeOnline, command, commands, services } = useApp();
  const { today, morningSummaryEntity, morningSummaryScript, morningSummaryPlaybackEntity } = useFamily();
  const summary = currentHome.entities.find(entity => entity.preferenceId === morningSummaryEntity || entity.entityId === morningSummaryEntity);
  const script = currentHome.entities.find(entity => entity.domain === "script" && (entity.preferenceId === morningSummaryScript || entity.entityId === morningSummaryScript));
  const playbackSwitch = currentHome.entities.find(entity => entity.domain === "input_boolean" && (entity.preferenceId === morningSummaryPlaybackEntity || entity.entityId === morningSummaryPlaybackEntity));
  const scriptId = script?.entityId ?? "";
  const running = script?.state === "on" || !!commands[scriptId]?.pending;
  const message = summary?.attributes.message;
  const messages = Array.isArray(summary?.attributes.messages) ? summary.attributes.messages.flatMap(value => {
    const parsed = morningMessageSchema.safeParse(value);
    return parsed.success ? [parsed.data] : [];
  }) : [];
  if (summary?.state !== today || !messages.length && (typeof message !== "string" || !message.trim())) return null;
  const people = currentHome.entities.filter(entity => entity.domain === "person");
  const entityTitle = summary.attributes.title;
  const title = (typeof entityTitle === "string" ? entityTitle.trim() : "") || t("Morning summary");
  const Icon = [summary.attributes.icon_name, summary.attributes.icon]
    .map(icon => typeof icon === "string" ? morningSummaryIcons.get(icon.trim().replace(/^lucide:/, "")) : undefined)
    .find(icon => icon !== undefined) ?? Sunrise;
  return <section className="glow-panel col-span-full" aria-label={title}>
    <div className="panel-heading">
      <PanelTitle icon={Icon}>{title}</PanelTitle>
      {script && <div className="command-controller shrink-0" aria-busy={running}>
        <Button variant="outline" size="sm" title={running ? t("Preparing summary…") : t("Play summary")} disabled={playbackSwitch?.state !== "on" || !homeOnline || !available(script) || !supportsAction(script, "turn_on", services) || running} onClick={() => { void command(scriptId, "turn_on", { variables: { summary_entity: summary.entityId } }).catch(() => {}); }}>
          <Volume2 size={16} aria-hidden="true" /><span className="sr-only sm:not-sr-only">{running ? t("Preparing summary…") : t("Play summary")}</span>
        </Button>
        {!commands[scriptId]?.error && <CommandFeedback entityId={scriptId} />}
      </div>}
    </div>
    {messages.length ? <ul className="space-y-5">{messages.map((entry, index) => {
      const key = entry.key.trim().toLowerCase();
      const exact = people.find(person => person.entityId === `person.${key}`);
      const matches = people.filter(person => person.name.toLowerCase() === key || person.name.toLowerCase().split(/\s+/)[0] === key);
      const person = exact ?? (matches.length === 1 ? matches[0] : undefined);
      return <li key={`${entry.key}-${index}`} className="flex items-start gap-3">
        {person ? <MemberAvatar member={person.preferenceId} /> : <span className="flex h-[44px] w-[44px] shrink-0 items-center justify-center text-2xl" aria-hidden="true">{entry.emoji}</span>}
        <div className="min-w-0 max-w-prose flex-1"><h3 className="break-words font-semibold">{entry.name}</h3><p className="whitespace-pre-wrap break-words leading-relaxed">{entry.text}</p></div>
      </li>;
    })}</ul> : <p className="whitespace-pre-wrap break-words leading-relaxed">{typeof message === "string" ? message : ""}</p>}
    {script && commands[scriptId]?.error && <CommandFeedback entityId={scriptId} />}
    {!homeOnline && <p className="page-note">{t("Cached summary · Home Assistant is offline.")}</p>}
  </section>;
}
export function SceneButtons({ entities }: { entities?: Entity[] }) {
  const { t } = useI18n();
  const { currentHome, command, commands, homeOnline, services } = useApp();
  const [sceneId, setSceneId] = useState<string>();
  const scenes = entities ?? currentHome.entities.filter(e => e.domain === "scene");
  const selectedScene = scenes.find(scene => scene.entityId === sceneId);
  return <><div className="scene-buttons">{scenes.map(scene => <div key={scene.entityId} className="command-controller" aria-busy={!!commands[scene.entityId]?.pending}><button className="w-full" aria-label={t("Activate {value1}", { value1: scene.name })} disabled={!homeOnline || !available(scene) || !supportsAction(scene, "turn_on", services) || commands[scene.entityId]?.pending} onClick={() => setSceneId(scene.entityId)}><Sparkles size={20} aria-hidden="true" /><span>{scene.name}</span></button><CommandFeedback entityId={scene.entityId} /></div>)}</div>{!scenes.length && <p className="empty-note">{t("No scenes yet.")}</p>}
    {sceneId && <ConfirmDialog open onOpenChange={open => { if (!open) setSceneId(undefined); }} title={t("Activate scene?")} description={t("Activate “{value1}”? This applies its configured device changes in Home Assistant.", { value1: selectedScene?.name ?? sceneId })} confirmLabel={t("Activate scene")} disabled={!homeOnline || !selectedScene || !available(selectedScene) || !supportsAction(selectedScene, "turn_on", services) || commands[sceneId]?.pending} onConfirm={() => command(sceneId, "turn_on")} />}
  </>;
}
export function HomeFavorites() {
  const { t } = useI18n();
  const { currentHome, haUrl } = useApp();
  const { homeEntities, setHomeEntities } = useFamily();
  const [open, setOpen] = useState(false);
  const defaults = [...currentHome.entities.filter(e => ["light", "climate", "switch"].includes(e.domain)).slice(0, 3), ...currentHome.entities.filter(e => e.domain === "scene").slice(0, 4)].map(e => e.preferenceId);
  const selected = homeEntities ?? defaults;
  const entities = selected.flatMap(id => currentHome.entities.find(e => e.preferenceId === id) ?? []);
  const [sceneId, setSceneId] = useState<string>();
  const scenes = entities.filter(e => e.domain === "scene");
  const missing = selected.length - entities.length;
  return <section className="glow-panel home-favorites" aria-label={t("Home favorites")}>
    <div className="panel-heading"><PanelTitle icon={Heart}>{t("Just right at home")}</PanelTitle><div className="favorite-heading-actions"><Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button variant="ghost" size="icon" disabled={!haUrl} aria-label={t("Customize home favorites")} title={t("Customize home favorites")}><Settings aria-hidden="true" /></Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>{t("Make home yours")}</DialogTitle><DialogDescription>{t("Choose your dashboard favorites.")}</DialogDescription></DialogHeader>{open && <FavoritePicker key={haUrl} selected={selected} onSave={ids => { if (setHomeEntities(ids)) setOpen(false); }} onCancel={() => setOpen(false)} />}</DialogContent></Dialog><Link className="text-link" to="/home">{t("All controls")}<ArrowUpRight size={16} /></Link></div></div>
    {!!entities.length && <div className="favorite-devices">{entities.filter(e => e.domain !== "scene").map(entity => <EntityCard key={entity.entityId} entity={entity} />)}</div>}
    {!!scenes.length && <SceneButtons entities={scenes} />}
    {!selected.length && haUrl && <p className="empty-note">{t("No favorites selected.")}</p>}
    {!!missing && <p className="muted">{t(missing === 1 ? "{count} saved favorite is unavailable." : "{count} saved favorites are unavailable.", { count: missing })}</p>}
  </section>;
}
function FavoritePicker({ selected, onSave, onCancel }: { selected: string[]; onSave: (ids: string[]) => void; onCancel: () => void }) {
  const { t } = useI18n();
  const { currentHome } = useApp();
  const [draft, setDraft] = useState(selected);
  const [removal, setRemoval] = useState<{ ids: string[]; description: Message }>();
  return <>
    <EntityPicker multiple label={t("Available favorites")} placeholder={t("Choose your dashboard favorites.")} entities={currentHome.entities} value={draft}
      missingLabel={id => t("Remove unavailable favorite {value1}", { value1: id })} onChange={ids => {
        const removed = draft.find(id => !ids.includes(id));
        if (!removed) { setDraft(ids); return; }
        const entity = currentHome.entities.find(entity => entity.preferenceId === removed);
        setRemoval({ ids, description: msg(entity ? "Remove “{name}” from your favorites selection? Save favorites to apply this change." : "Remove unavailable favorite “{name}” from your selection? Save favorites to apply this change.", { name: entity?.name ?? removed.slice(removed.indexOf("|") + 1) }) });
      }} />
    <div className="favorite-picker-footer"><span>{t("{count} selected", { count: draft.length })}</span><Button variant="ghost" disabled={!draft.length} onClick={() => setRemoval({ ids: [], description: msg("Clear all favorites from your selection? Save favorites to apply this change to the dashboard.") })}>{t("Clear all")}</Button><Button variant="ghost" onClick={onCancel}>{t("Cancel")}</Button><Button onClick={() => onSave(draft)}>{t("Save favorites")}</Button></div>
    {removal && <ConfirmDialog open onOpenChange={open => { if (!open) setRemoval(undefined); }} title={t("Remove favorites?")} description={removal.description} confirmLabel={t("Remove favorites")} destructive onConfirm={() => setDraft(removal.ids)} />}
  </>;
}
export function VehicleCard() {
  const { t } = useI18n();
  return <article className="glow-panel vehicle-panel"><PanelHeading icon={CarFront} title={t("Ready for the road")} /><Link className="text-link" to="/devices">{t("Browse devices")}<ArrowUpRight size={17} /></Link></article>;
}
