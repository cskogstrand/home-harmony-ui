import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AudioLines, Check, Disc3, Link2, Music2, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, SlidersHorizontal, Speaker, Square, Timer, Volume2, VolumeX } from "lucide-react";
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SonosLibrary, type SonosRun } from "@/components/sonos/SonosLibrary";
import { MessageError, type Message } from "@/lib/i18n";
import "./sonos.css";

export default function Sonos() {
  const { currentHome, homeOnline, connectionStatus } = useApp();
  const { message: t, language } = useI18n();
  const [params, setParams] = useSearchParams();
  const players = sonosPlayers(currentHome.entities);
  const selected = players.find(player => player.entityId === params.get("player")) ?? players.find(player => player.state === "playing") ?? players.find(available) ?? players[0];
  const seen = new Set<string>();
  const destinations = players.flatMap(player => {
    const group = sonosGroup(player, players);
    const destination = group.coordinator ?? player;
    const groupId = stringValues(player.attributes.group_members)[0] ?? player.entityId;
    if (seen.has(groupId)) return [];
    seen.add(groupId);
    return [{ player: destination, members: group.members }];
  });
  const selectPlayer = (id: string) => setParams({ player: id }, { replace: true });
  useEffect(() => { if (selected && !params.get("player")) setParams({ player: selected.entityId }, { replace: true }); }, [selected, params, setParams]);
  return <div className="sonos-page">
    <PageHeading title="Sonos" />
    {!players.length ? <section className="glow-panel sonos-empty"><Speaker size={36} aria-hidden="true" />
      <h2>{t(homeOnline ? "Bring your rooms to life" : "Waiting for your speakers")}</h2>
      <p>{t(homeOnline ? "Add the Sonos integration in Home Assistant. Your speakers and favorites will appear here automatically." : ["connecting", "syncing"].includes(connectionStatus) ? "Connecting to Home Assistant…" : "Connect to Home Assistant to see and control your Sonos speakers.")}</p>
      <Button asChild variant="outline"><Link to="/integrations">{t("Integrations")}</Link></Button>
    </section> : <>
      <section id="sonos-rooms" tabIndex={-1} className="sonos-destination-section" aria-label={t("Choose a speaker")}>
        <div className="sonos-destinations" role="group" aria-label={t("Rooms")}>
          {destinations.map(({ player, members }) => <button type="button" key={player.entityId} aria-pressed={members.some(member => member.entityId === selected.entityId)} onClick={() => selectPlayer(player.entityId)}>
            {player.state === "playing" ? <AudioLines size={20} aria-hidden="true" /> : <Speaker size={20} aria-hidden="true" />}
            <span><strong>{members.map(member => member.name).join(" + ")}</strong><small>{entityStateLabel(player, language)}{available(player) && typeof player.attributes.media_title === "string" ? ` · ${player.attributes.media_title}` : ""}</small></span>
            {members.some(member => member.entityId === selected.entityId) && <Check size={18} aria-hidden="true" />}
          </button>)}
        </div>
      </section>
      <SonosSession selected={selected} players={players} selectPlayer={selectPlayer} />
    </>}
  </div>;
}

function SonosSession({ selected, players, selectPlayer }: { selected: Entity; players: Entity[]; selectPlayer: (id: string) => void }) {
  const { command, homeOnline, services, currentHome, commands } = useApp();
  const { message: t } = useI18n();
  const { coordinator, members } = sonosGroup(selected, players);
  const [busy, setBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ playerId: string; message: Message }>();
  const error = feedback?.playerId === selected.entityId ? feedback.message : "";
  const inFlight = useRef(false);
  const [revision, setRevision] = useState(0);
  const run: SonosRun = async work => {
    if (inFlight.current || !homeOnline) return false;
    inFlight.current = true; setBusy(true); setFeedback(undefined);
    try { await work(); setRevision(value => value + 1); return true; }
    catch (error) { setFeedback({ playerId: selected.entityId, message: error instanceof MessageError ? { key: error.key, values: error.values } : error instanceof Error ? error.message : "The action could not be completed. Try again." }); return false; }
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
  const sourceAttributes = (coordinator ?? selected).attributes;
  const sources = stringValues(sourceAttributes.source_list);
  const source = typeof sourceAttributes.source === "string" ? sourceAttributes.source : "";
  return <>
    {error && <p className="sonos-feedback" role="alert">{t(error)}</p>}
    <div className="sr-only" role="status">{busy ? t("Sending to your speakers…") : ""}</div>
    {!homeOnline && <p className="sonos-feedback" role="status">{t("Speakers are offline. Controls will return when Home Assistant reconnects.")}</p>}
    {!coordinator && <p className="sonos-feedback" role="status">{t("The group coordinator is unavailable. Select another room or check the group in Sonos.")}</p>}
    <section className="sonos-player glass-surface" aria-label={t("Now playing")} aria-busy={busy}>
      <SonosPlayer key={coordinator?.entityId ?? selected.entityId} player={coordinator ?? selected} members={members} disabled={blocked} send={send}>
        <div className="sonos-group-volume">
          <Volume2 size={22} aria-hidden="true" />
          <Range label={members.length > 1 ? "Group volume" : "Volume"} value={groupVolume(volumeMembers)} disabled={blocked || !volumeMembers.length} commitOnly set={value => { void changeVolumes(value); }} />
        </div>
      </SonosPlayer>
      <div className="sonos-player-actions">
        <SonosLibrary player={coordinator ?? selected} destination={members.map(member => member.name).join(" + ")} disabled={blocked} commandError={error} run={run} revision={revision} />
        <SonosRooms key={selected.entityId} players={players} selected={selected} coordinator={coordinator} members={members} disabled={blocked} pending={busy} error={error} run={run} />
        <Dialog open={settingsOpen} onOpenChange={open => { if (!busy) setSettingsOpen(open); }}>
          <DialogTrigger asChild><Button variant="ghost"><SlidersHorizontal size={19} aria-hidden="true" />{t("Speaker settings")}</Button></DialogTrigger>
          <DialogContent className="sonos-controls-dialog" aria-busy={busy}>
            <DialogHeader><DialogTitle>{t("Speaker settings")}</DialogTitle><DialogDescription>{selected.name} · {t("Sound, night mode and hardware controls reported by this speaker.")}</DialogDescription></DialogHeader>
            <div className="sonos-controls-body">
              {error && <p className="sonos-feedback" role="alert">{t(error)}</p>}
              {members.length > 1 && <label className="sonos-source"><span>{t("Speaker")}</span><select value={selected.entityId} onChange={event => selectPlayer(event.target.value)}>{members.map(member => <option key={member.entityId} value={member.entityId}>{member.name}</option>)}</select></label>}
              {sources.length > 0 && <label className="sonos-source"><span><Music2 size={17} aria-hidden="true" />{t("Source")}</span><select value={source} disabled={blocked || !coordinator || !supportsAction(coordinator, "select_source", services)} onChange={event => { if (coordinator) void run(() => command(coordinator.entityId, "select_source", event.target.value)); }}>{!sources.includes(source) && <option value={source} disabled>{source || t("Choose a source")}</option>}{sources.map(value => <option key={value}>{value}</option>)}</select></label>}
              <div className="sonos-settings-grid">{settings?.length ? settings.map(entity => <div key={entity.entityId}><h3>{entity.name}</h3><DeviceControl entity={entity} /></div>) : <p>{t("No extra controls are enabled for this speaker. Enable its sound settings in Home Assistant to show them here.")}</p>}</div>
              {coordinator && (supportsAction(coordinator, "set_sleep_timer", services) || supportsAction(coordinator, "clear_sleep_timer", services)) && <div className="sonos-sleep"><h3><Timer size={18} aria-hidden="true" />{t("Sleep timer")}</h3>
                <div className="sonos-inline-actions">{supportsAction(coordinator, "set_sleep_timer", services) && [15, 30, 60, 90].map(minutes => <Button key={minutes} variant="outline" disabled={blocked} onClick={() => send("set_sleep_timer", minutes * 60)}>{t("{minutes} min", { minutes })}</Button>)}
                  {supportsAction(coordinator, "clear_sleep_timer", services) && <Button variant="ghost" disabled={blocked} onClick={() => send("clear_sleep_timer")}>{t("Cancel timer")}</Button>}
                </div><p className="sonos-caption">{t("The timer applies to the playing group. Its remaining time is managed by Sonos.")}</p>
              </div>}
            </div>
            <DialogFooter><Button variant="outline" disabled={busy} onClick={() => setSettingsOpen(false)}>{t("Done")}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </section>
  </>;
}

function SonosPlayer({ player, members, disabled, send, children }: { player: Entity; members: Entity[]; disabled: boolean; send: (action: EntityAction, value?: unknown) => void; children: ReactNode }) {
  const { services } = useApp();
  const { message: t } = useI18n();
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
    <div id="sonos-player-main" className="sonos-player-main">
      <div className="sonos-artwork">{art && failedArt !== art ? <img src={art} alt={t("Album artwork")} onError={() => setFailedArt(art)} /> : <div className="sonos-artwork-empty"><Disc3 size={64} strokeWidth={1} aria-hidden="true" /></div>}</div>
      <div className="sonos-track">
        <div className="sonos-track-info"><div className="sonos-playing-in"><Speaker size={16} aria-hidden="true" /><span>{members.map(member => member.name).join(" + ")}</span></div>
        <h2>{title}</h2><p className="sonos-artist">{subtitle || t("Choose something from your music library.")}</p>
        {typeof a.media_playlist === "string" && <p className="sonos-caption">{a.media_playlist}</p>}</div>
        {duration && duration > 0 && position !== undefined ? <div className="sonos-progress"><Range label="Track position" ariaLabel={t("Track position")} value={Math.floor(position)} min={0} max={duration} unit=" s" commitOnly disabled={disabled || !supports("media_seek")} set={value => send("media_seek", value)} /><div aria-hidden="true"><span>{mediaTime(position)}</span><span>{mediaTime(duration)}</span></div></div> : <p className="sonos-caption sonos-live">{typeof a.media_channel === "string" ? a.media_channel : ""}</p>}
        <div className="sonos-transport" role="group" aria-label={t("Playback controls")}>
          <Button variant="ghost" size="icon" aria-label={t("Shuffle")} title={t("Shuffle")} aria-pressed={a.shuffle === true} disabled={disabled || !supports("shuffle_set")} onClick={() => send("shuffle_set", a.shuffle !== true)}><Shuffle size={20} /></Button>
          <Button variant="ghost" size="icon" aria-label={t("Previous track")} title={t("Previous track")} disabled={disabled || !supports("media_previous_track")} onClick={() => send("media_previous_track")}><SkipBack size={25} fill="currentColor" /></Button>
          <Button className="sonos-play" size="icon" aria-label={t(playing ? playbackAction === "media_pause" ? "Pause" : "Stop" : "Play")} disabled={disabled || !supports(playbackAction)} onClick={() => send(playbackAction)}><PlaybackIcon size={28} fill="currentColor" /></Button>
          <Button variant="ghost" size="icon" aria-label={t("Next track")} title={t("Next track")} disabled={disabled || !supports("media_next_track")} onClick={() => send("media_next_track")}><SkipForward size={25} fill="currentColor" /></Button>
          <Button variant="ghost" size="icon" aria-label={t("Repeat: {mode}", { mode: t(repeat === "one" ? "One track" : repeat === "all" ? "All tracks" : "Off") })} title={t("Repeat")} aria-pressed={repeat !== "off"} disabled={disabled || !supports("repeat_set")} onClick={() => send("repeat_set", repeat === "off" ? "all" : repeat === "all" ? "one" : "off")}>{repeat === "one" ? <Repeat1 size={20} /> : <Repeat size={20} />}</Button>
        </div>
        {children}
      </div>
    </div>
  </>;
}

function SonosRooms({ players, selected, coordinator, members, disabled, pending, error, run }: { players: Entity[]; selected: Entity; coordinator?: Entity; members: Entity[]; disabled: boolean; pending: boolean; error: Message; run: SonosRun }) {
  const { command, services, commands, homeOnline } = useApp();
  const { message: t } = useI18n();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>([]);
  const [originalGroup, setOriginalGroup] = useState("");
  const memberIds = members.map(member => member.entityId);
  const muteMembers = members.filter(member => available(member) && supportsAction(member, "volume_mute", services));
  const allMuted = muteMembers.length > 0 && muteMembers.every(member => member.attributes.is_volume_muted === true);
  const groupable = !!coordinator && supportsAction(coordinator, "join", services);
  const groupChanged = draft.length !== memberIds.length || draft.some(id => !memberIds.includes(id));
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
  return <Dialog open={open} onOpenChange={open => {
    if (pending) return;
    if (open) { setDraft(memberIds); setOriginalGroup(memberIds.join(",")); }
    setOpen(open);
  }}>
    <DialogTrigger asChild><Button variant="ghost"><Link2 size={19} aria-hidden="true" />{t("Group settings")}</Button></DialogTrigger>
      <DialogContent className="sonos-controls-dialog" aria-busy={pending}>
        <DialogHeader><DialogTitle>{t("Group settings")}</DialogTitle><DialogDescription>{t("Choose rooms to play together. Added rooms will switch to this group’s music.")}</DialogDescription></DialogHeader>
        <div className="sonos-controls-body">
        {error && <p className="sonos-feedback" role="alert">{t(error)}</p>}
        <section className="sonos-controls-section" aria-label={t("Room volumes")}><h3>{t("Room volumes")}</h3><div className="sonos-room-list">{members.map(member => <div className="sonos-room" key={member.entityId}>
      <div className="sonos-room-heading"><Speaker size={20} aria-hidden="true" /><strong>{member.name}</strong>{member.entityId === selected.entityId && <span className="sr-only">{t("Selected")}</span>}
        <Button variant="ghost" size="icon" aria-label={t(member.attributes.is_volume_muted === true ? "Unmute {name}" : "Mute {name}", { name: member.name })} title={t(member.attributes.is_volume_muted === true ? "Unmute" : "Mute")} aria-pressed={member.attributes.is_volume_muted === true} disabled={disabled || !available(member) || !supportsAction(member, "volume_mute", services)} onClick={() => { void run(() => command(member.entityId, "volume_mute", member.attributes.is_volume_muted !== true)); }}>{member.attributes.is_volume_muted === true ? <VolumeX size={19} /> : <Volume2 size={19} />}</Button>
      </div>
      {available(member) ? <Range label="Volume" ariaLabel={t("Volume for {name}", { name: member.name })} value={volumePercent(member)} commitOnly disabled={disabled || !supportsAction(member, "volume_set", services) || volumePercent(member) === undefined} set={value => { void run(() => command(member.entityId, "volume_set", value / 100)); }} /> : <p className="sonos-caption">{t("Unavailable")}</p>}
    </div>)}</div>
      {!!muteMembers.length && <Button variant="ghost" disabled={disabled} onClick={() => { void run(async () => {
        const results = await Promise.allSettled(muteMembers.map(member => command(member.entityId, "volume_mute", !allMuted)));
        if (results.some(result => result.status === "rejected")) throw new Error("Some speakers did not respond. Check each room’s mute setting before trying again.");
      }); }}>{allMuted ? <Volume2 size={17} /> : <VolumeX size={17} />}{t(allMuted ? "Unmute group" : "Mute group")}</Button>}
    </section><section className="sonos-controls-section" aria-label={t("Rooms in group")}><h3>{t("Rooms in group")}</h3><div className="sonos-group-editor">
      <Button variant="ghost" disabled={disabled || !groupable} onClick={() => setDraft([...new Set([...memberIds, ...players.filter(player => available(player) && supportsAction(player, "join", services)).map(player => player.entityId)])])}>{t("Select all available rooms")}</Button>
      {players.map(player => <label key={player.entityId}><Checkbox checked={draft.includes(player.entityId)} disabled={disabled || !groupable || player.entityId === coordinator?.entityId || !available(player) || !supportsAction(player, memberIds.includes(player.entityId) ? "unjoin" : "join", services) || !!commands[player.entityId]?.pending} onCheckedChange={checked => setDraft(ids => checked ? [...ids, player.entityId] : ids.filter(id => id !== player.entityId))} /><span>{player.name}{player.entityId === coordinator?.entityId && <small>{t("Plays this group’s music")}</small>}{!available(player) && <small>{t("Unavailable")}</small>}</span></label>)}
    </div></section></div>
        <DialogFooter><Button variant="ghost" disabled={pending} onClick={() => setOpen(false)}>{t(groupChanged ? "Cancel" : "Done")}</Button><Button disabled={disabled || !homeOnline || !groupable || !groupChanged} onClick={() => { void apply(); }}><Check size={17} />{t(pending ? "Sending to your speakers…" : "Apply group")}</Button></DialogFooter>
      </DialogContent>
  </Dialog>;
}
