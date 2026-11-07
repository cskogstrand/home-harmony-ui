import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AudioLines, Check, ChevronDown, CirclePause, Disc3, Link2, Music2, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, SlidersHorizontal, Speaker, Square, Timer, Volume2, VolumeX } from "lucide-react";
import type { Entity, EntityAction } from "@/types/api";
import { useApp } from "@/contexts/AppContext";
import { useI18n } from "@/hooks/use-i18n";
import { available, entityStateLabel, numberValue, stringValues, supportsAction } from "@/lib/ha-model";
import { groupVolume, groupVolumeChanges, mediaTime, playbackPosition, sonosGroup, sonosPlayers, volumePercent } from "@/lib/sonos";
import { PageHeading } from "@/components/FamilyPlanner";
import { Button } from "@/components/ui/button";
import { Range } from "@/components/devices/CardControls";
import { DeviceControl } from "@/components/devices/DeviceControl";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SonosLibrary, type SonosRun } from "@/components/sonos/SonosLibrary";
import { MessageError, type Message } from "@/lib/i18n";
import "./sonos.css";

export default function Sonos() {
  const { currentHome, homeOnline, connectionStatus } = useApp();
  const { message: t } = useI18n();
  const [params, setParams] = useSearchParams();
  const players = sonosPlayers(currentHome.entities);
  const selected = players.find(player => player.entityId === params.get("player")) ?? players.find(player => player.state === "playing") ?? players.find(available) ?? players[0];
  useEffect(() => { if (selected && !params.get("player")) setParams({ player: selected.entityId }, { replace: true }); }, [selected, params, setParams]);
  return <div className="sonos-page">
    <PageHeading title="Sonos" description={t("Good music. Every room.")} />
    {!players.length ? <section className="glow-panel sonos-empty"><Speaker size={36} aria-hidden="true" />
      <h2>{t(homeOnline ? "Bring your rooms to life" : "Waiting for your speakers")}</h2>
      <p>{t(homeOnline ? "Add the Sonos integration in Home Assistant. Your speakers and favorites will appear here automatically." : ["connecting", "syncing"].includes(connectionStatus) ? "Connecting to Home Assistant…" : "Connect to Home Assistant to see and control your Sonos speakers.")}</p>
      <Button asChild variant="outline"><Link to="/integrations">{t("Integrations")}</Link></Button>
    </section> : <>
      <div className="sonos-destinations" role="group" aria-label={t("Choose a speaker")}>
        {players.map(player => <button type="button" key={player.entityId} aria-pressed={player.entityId === selected.entityId} onClick={() => setParams({ player: player.entityId }, { replace: true })}>
          {player.state === "playing" ? <AudioLines size={19} aria-hidden="true" /> : <Speaker size={19} aria-hidden="true" />}<span>{player.name}</span>
          {!available(player) && <span className="sonos-room-state">{t("Unavailable")}</span>}
        </button>)}
      </div>
      <SonosSession key={selected.entityId} selected={selected} players={players} />
    </>}
  </div>;
}

function SonosSession({ selected, players }: { selected: Entity; players: Entity[] }) {
  const { command, homeOnline, services, currentHome, commands } = useApp();
  const { message: t } = useI18n();
  const { coordinator, members } = sonosGroup(selected, players);
  const [busy, setBusy] = useState(false), [error, setError] = useState<Message>("");
  const inFlight = useRef(false);
  const [revision, setRevision] = useState(0);
  const run: SonosRun = async work => {
    if (inFlight.current || !homeOnline) return false;
    inFlight.current = true; setBusy(true); setError("");
    try { await work(); setRevision(value => value + 1); return true; }
    catch (error) { setError(error instanceof MessageError ? { key: error.key, values: error.values } : error instanceof Error ? error.message : "The action could not be completed. Try again."); return false; }
    finally { inFlight.current = false; setBusy(false); }
  };
  const blocked = busy || !homeOnline || !coordinator || !available(coordinator) || members.some(member => commands[member.entityId]?.pending);
  const send = (action: EntityAction, value?: unknown) => { if (coordinator) void run(() => command(coordinator.entityId, action, value)); };
  const volumeMembers = members.filter(member => available(member) && volumePercent(member) !== undefined && supportsAction(member, "volume_set", services));
  const changeVolumes = (target: number) => run(async () => {
    const result = await Promise.allSettled(groupVolumeChanges(volumeMembers, target).map(change => command(change.entityId, "volume_set", change.volume)));
    if (result.some(item => item.status === "rejected")) throw new Error("Some speakers did not respond. Check each room’s reported volume before trying again.");
  });
  const settings = selected.device && currentHome.entities.filter(entity => entity.device?.id === selected.device.id && entity.integration === "sonos" && ["number", "switch", "select"].includes(entity.domain));
  return <>
    {error && <p className="sonos-feedback" role="alert">{t(error)}</p>}
    <div className="sr-only" role="status">{busy ? t("Sending to your speakers…") : ""}</div>
    {!homeOnline && <p className="sonos-feedback" role="status">{t("Speakers are offline. Controls will return when Home Assistant reconnects.")}</p>}
    {!coordinator && <p className="sonos-feedback" role="status">{t("The group coordinator is unavailable. Select another room or check the group in Sonos.")}</p>}
    <div className="sonos-stage" aria-busy={busy}>
      <section className="sonos-player glass-surface" aria-label={t("Now playing")}>
        <SonosPlayer key={coordinator?.entityId ?? selected.entityId} player={coordinator ?? selected} members={members} disabled={blocked} send={send} />
        <div className="sonos-group-volume">
          <Volume2 size={22} aria-hidden="true" />
          <Range label={members.length > 1 ? "Group volume" : "Volume"} value={groupVolume(volumeMembers)} disabled={blocked || !volumeMembers.length} commitOnly set={value => { void changeVolumes(value); }} />
        </div>
        {members.length > 1 && <p className="sonos-caption">{t("Room levels move together, keeping their balance.")}</p>}
      </section>
      <SonosRooms key={coordinator?.entityId ?? selected.entityId} players={players} selected={selected} coordinator={coordinator} members={members} disabled={blocked} pending={busy} error={error} run={run} />
    </div>
    {coordinator && <SonosLibrary key={coordinator.entityId} player={coordinator} disabled={blocked} run={run} revision={revision} />}
    <details className="sonos-settings glow-panel">
      <summary><SlidersHorizontal size={20} aria-hidden="true" /><span>{t("Speaker settings")}</span><span className="sonos-caption">{selected.name}</span><ChevronDown size={18} aria-hidden="true" /></summary>
      <p className="sonos-caption">{t("Sound, night mode and hardware controls reported by this speaker.")}</p>
      <div className="sonos-settings-grid">{settings?.length ? settings.map(entity => <div key={entity.entityId}><h3>{entity.name}</h3><DeviceControl entity={entity} /></div>) : <p>{t("No extra controls are enabled for this speaker. Enable its sound settings in Home Assistant to show them here.")}</p>}</div>
      {coordinator && (supportsAction(coordinator, "set_sleep_timer", services) || supportsAction(coordinator, "clear_sleep_timer", services)) && <div className="sonos-sleep"><h3><Timer size={18} aria-hidden="true" />{t("Sleep timer")}</h3>
        <div className="sonos-inline-actions">{supportsAction(coordinator, "set_sleep_timer", services) && [15, 30, 60, 90].map(minutes => <Button key={minutes} variant="outline" disabled={blocked} onClick={() => send("set_sleep_timer", minutes * 60)}>{t("{minutes} min", { minutes })}</Button>)}
          {supportsAction(coordinator, "clear_sleep_timer", services) && <Button variant="ghost" disabled={blocked} onClick={() => send("clear_sleep_timer")}>{t("Cancel timer")}</Button>}
        </div><p className="sonos-caption">{t("The timer applies to the playing group. Its remaining time is managed by Sonos.")}</p>
      </div>}
    </details>
  </>;
}

function SonosPlayer({ player, members, disabled, send }: { player: Entity; members: Entity[]; disabled: boolean; send: (action: EntityAction, value?: unknown) => void }) {
  const { services } = useApp();
  const { message: t, language } = useI18n();
  const [now, setNow] = useState(Date.now());
  const [failedArt, setFailedArt] = useState("");
  useEffect(() => {
    if (disabled || player.state !== "playing") return;
    const timer = window.setInterval(() => { if (!document.hidden) setNow(Date.now()); }, 1000);
    return () => window.clearInterval(timer);
  }, [disabled, player.state]);
  const supports = (action: EntityAction) => supportsAction(player, action, services);
  const a = player.attributes;
  const title = typeof a.media_title === "string" && a.media_title ? a.media_title : t("A little quiet, for now");
  const subtitle = [a.media_artist, a.media_album_name].filter(value => typeof value === "string" && value).join(" · ");
  const art = typeof a.entity_picture === "string" ? `/api/media_player_proxy/${encodeURIComponent(player.entityId)}?media=${encodeURIComponent(String(a.media_content_id ?? a.media_title ?? ""))}` : "";
  const position = playbackPosition(player, disabled ? Date.parse(player.lastUpdated ?? "") || now : now);
  const duration = numberValue(a.media_duration);
  const playing = player.state === "playing";
  const playbackAction = playing ? supports("media_pause") ? "media_pause" : "media_stop" : "media_play";
  const PlaybackIcon = playing ? playbackAction === "media_pause" ? Pause : Square : Play;
  const repeat = typeof a.repeat === "string" ? a.repeat : "off";
  return <>
    <div className="sonos-player-heading"><h2>{t("Now playing")}</h2><span className="sonos-status">{playing ? <AudioLines size={17} aria-hidden="true" /> : <CirclePause size={17} aria-hidden="true" />}{entityStateLabel(player, language)}</span></div>
    <div className="sonos-player-main">
      <div className="sonos-artwork">{art && failedArt !== art ? <img src={art} alt={t("Album artwork")} onError={() => setFailedArt(art)} /> : <div className="sonos-artwork-empty"><Disc3 size={64} strokeWidth={1} aria-hidden="true" /><span>{t("Your next favorite awaits")}</span></div>}</div>
      <div className="sonos-track">
        <div className="sonos-playing-in"><Speaker size={16} aria-hidden="true" /><span>{members.map(member => member.name).join(" + ")}</span></div>
        <h3>{title}</h3><p className="sonos-artist">{subtitle || t("Choose something from your music library.")}</p>
        {typeof a.media_playlist === "string" && <p className="sonos-caption">{a.media_playlist}</p>}
        {duration && duration > 0 && position !== undefined ? <div className="sonos-progress"><Range label="Track position" ariaLabel={t("Track position")} value={Math.floor(position)} min={0} max={duration} unit=" s" commitOnly disabled={disabled || !supports("media_seek")} set={value => send("media_seek", value)} /><div aria-hidden="true"><span>{mediaTime(position)}</span><span>{mediaTime(duration)}</span></div></div> : <p className="sonos-caption sonos-live">{typeof a.media_channel === "string" ? a.media_channel : ""}</p>}
        <div className="sonos-transport" role="group" aria-label={t("Playback controls")}>
          <Button variant="ghost" size="icon" aria-label={t("Shuffle")} title={t("Shuffle")} aria-pressed={a.shuffle === true} disabled={disabled || !supports("shuffle_set")} onClick={() => send("shuffle_set", a.shuffle !== true)}><Shuffle size={20} /></Button>
          <Button variant="ghost" size="icon" aria-label={t("Previous track")} title={t("Previous track")} disabled={disabled || !supports("media_previous_track")} onClick={() => send("media_previous_track")}><SkipBack size={25} fill="currentColor" /></Button>
          <Button className="sonos-play" size="icon" aria-label={t(playing ? playbackAction === "media_pause" ? "Pause" : "Stop" : "Play")} disabled={disabled || !supports(playbackAction)} onClick={() => send(playbackAction)}><PlaybackIcon size={28} fill="currentColor" /></Button>
          <Button variant="ghost" size="icon" aria-label={t("Next track")} title={t("Next track")} disabled={disabled || !supports("media_next_track")} onClick={() => send("media_next_track")}><SkipForward size={25} fill="currentColor" /></Button>
          <Button variant="ghost" size="icon" aria-label={t("Repeat: {mode}", { mode: t(repeat === "one" ? "One track" : repeat === "all" ? "All tracks" : "Off") })} title={t("Repeat")} aria-pressed={repeat !== "off"} disabled={disabled || !supports("repeat_set")} onClick={() => send("repeat_set", repeat === "off" ? "all" : repeat === "all" ? "one" : "off")}>{repeat === "one" ? <Repeat1 size={20} /> : <Repeat size={20} />}</Button>
        </div>
      </div>
    </div>
  </>;
}

function SonosRooms({ players, selected, coordinator, members, disabled, pending, error, run }: { players: Entity[]; selected: Entity; coordinator?: Entity; members: Entity[]; disabled: boolean; pending: boolean; error: Message; run: SonosRun }) {
  const { command, services, commands, homeOnline } = useApp();
  const { message: t } = useI18n();
  const [view, setView] = useState<"volume" | "group">("volume"), [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>([]);
  const opener = useRef<HTMLButtonElement | null>(null);
  const [originalGroup, setOriginalGroup] = useState("");
  const memberIds = members.map(member => member.entityId);
  const muteMembers = members.filter(member => available(member) && supportsAction(member, "volume_mute", services));
  const allMuted = muteMembers.length > 0 && muteMembers.every(member => member.attributes.is_volume_muted === true);
  const groupable = !!coordinator && supportsAction(coordinator, "join", services);
  const sourceAttributes = (coordinator ?? selected).attributes;
  const sources = stringValues(sourceAttributes.source_list);
  const source = typeof sourceAttributes.source === "string" ? sourceAttributes.source : "";
  const apply = async () => {
    if (!coordinator) return;
    const removed = memberIds.filter(id => id !== coordinator.entityId && !draft.includes(id));
    const added = draft.filter(id => !memberIds.includes(id));
    const ok = await run(async () => {
      if (originalGroup !== memberIds.join(",")) throw new Error("The group changed. Close the editor and choose your rooms again.");
      // Stop on the first failure; Home Assistant's reported membership shows any partial result.
      for (const id of removed) await command(id, "unjoin");
      if (added.length) await command(coordinator.entityId, "join", added);
    });
    if (ok) setOpen(false);
  };
  return <section className="sonos-rooms glass-surface" aria-label={t("Rooms")}>
    <div className="sonos-player-heading"><h2>{t("Rooms")}</h2><span className="sonos-caption">{t("{count} in this group", { count: members.length })}</span></div>
    <div className="sonos-group-summary"><Speaker size={36} strokeWidth={1.5} aria-hidden="true" /><p>{members.map(member => member.name).join(" · ")}</p>
      <Button variant="outline" aria-haspopup="dialog" onClick={event => { opener.current = event.currentTarget; setView("volume"); setOpen(true); }}><SlidersHorizontal size={18} aria-hidden="true" />{t("Room volumes")}</Button>
    </div>
    <div className="sonos-inline-actions">
      {groupable && <Button variant="outline" disabled={disabled} aria-haspopup="dialog" onClick={event => { opener.current = event.currentTarget; setDraft(memberIds); setOriginalGroup(memberIds.join(",")); setView("group"); setOpen(true); }}><Link2 size={17} aria-hidden="true" />{t("Edit group")}</Button>}
      {!!muteMembers.length && <Button variant="ghost" disabled={disabled} onClick={() => { void run(async () => {
        const results = await Promise.allSettled(muteMembers.map(member => command(member.entityId, "volume_mute", !allMuted)));
        if (results.some(result => result.status === "rejected")) throw new Error("Some speakers did not respond. Check each room’s mute setting before trying again.");
      }); }}>{allMuted ? <Volume2 size={17} /> : <VolumeX size={17} />}{t(allMuted ? "Unmute group" : "Mute group")}</Button>}
    </div>
    {sources.length > 0 && <label className="sonos-source"><span><Music2 size={17} aria-hidden="true" />{t("Source")}</span><select value={source} disabled={disabled || !coordinator || !supportsAction(coordinator, "select_source", services)} onChange={event => { if (coordinator) void run(() => command(coordinator.entityId, "select_source", event.target.value)); }}>{!sources.includes(source) && <option value={source} disabled>{source || t("Choose a source")}</option>}{sources.map(value => <option key={value}>{value}</option>)}</select></label>}
    <Dialog open={open} onOpenChange={open => { if (!open && !pending) setOpen(false); }}>
      <DialogContent className="sonos-controls-dialog" aria-busy={pending} onCloseAutoFocus={event => { event.preventDefault(); opener.current?.focus(); }}>
        <DialogHeader><DialogTitle>{t(view === "group" ? "Edit group" : "Room volumes")}</DialogTitle><DialogDescription>{t(view === "group" ? "Choose rooms to play together. Added rooms will switch to this group’s music." : "Adjust each speaker without changing the group.")}</DialogDescription></DialogHeader>
        <div className="sonos-controls-body">
        {error && <p className="sonos-feedback" role="alert">{t(error)}</p>}
        {view === "volume" ? <div className="sonos-room-list">{members.map(member => <div className="sonos-room" key={member.entityId}>
      <div className="sonos-room-heading"><Speaker size={20} aria-hidden="true" /><strong>{member.name}</strong>{member.entityId === selected.entityId && <span className="sr-only">{t("Selected")}</span>}
        <Button variant="ghost" size="icon" aria-label={t(member.attributes.is_volume_muted === true ? "Unmute {name}" : "Mute {name}", { name: member.name })} title={t(member.attributes.is_volume_muted === true ? "Unmute" : "Mute")} aria-pressed={member.attributes.is_volume_muted === true} disabled={disabled || !available(member) || !supportsAction(member, "volume_mute", services)} onClick={() => { void run(() => command(member.entityId, "volume_mute", member.attributes.is_volume_muted !== true)); }}>{member.attributes.is_volume_muted === true ? <VolumeX size={19} /> : <Volume2 size={19} />}</Button>
      </div>
      {available(member) ? <Range label="Volume" ariaLabel={t("Volume for {name}", { name: member.name })} value={volumePercent(member)} commitOnly disabled={disabled || !supportsAction(member, "volume_set", services) || volumePercent(member) === undefined} set={value => { void run(() => command(member.entityId, "volume_set", value / 100)); }} /> : <p className="sonos-caption">{t("Unavailable")}</p>}
    </div>)}</div> : <div className="sonos-group-editor">
      <Button variant="ghost" disabled={disabled} onClick={() => setDraft([...new Set([...memberIds, ...players.filter(player => available(player) && supportsAction(player, "join", services)).map(player => player.entityId)])])}>{t("Select all available rooms")}</Button>
      {players.map(player => <label key={player.entityId}><Checkbox checked={draft.includes(player.entityId)} disabled={disabled || player.entityId === coordinator?.entityId || !available(player) || !supportsAction(player, memberIds.includes(player.entityId) ? "unjoin" : "join", services) || !!commands[player.entityId]?.pending} onCheckedChange={checked => setDraft(ids => checked ? [...ids, player.entityId] : ids.filter(id => id !== player.entityId))} /><span>{player.name}{player.entityId === coordinator?.entityId && <small>{t("Plays this group’s music")}</small>}{!available(player) && <small>{t("Unavailable")}</small>}</span></label>)}
    </div>}</div>
        <DialogFooter>{view === "group" ? <><Button variant="ghost" disabled={pending} onClick={() => setOpen(false)}>{t("Cancel")}</Button><Button disabled={disabled || !homeOnline} onClick={() => { void apply(); }}><Check size={17} />{t(pending ? "Sending to your speakers…" : "Apply group")}</Button></> : <Button variant="outline" disabled={pending} onClick={() => setOpen(false)}>{t("Done")}</Button>}</DialogFooter>
      </DialogContent>
    </Dialog>
  </section>;
}
