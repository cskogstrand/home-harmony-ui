import { useEffect, useState } from "react";
import { ArrowLeft, ChevronRight, Folder, ListMusic, Music2, Play, Plus, RefreshCw, Search, Star, Trash2 } from "lucide-react";
import type { Entity } from "@/types/api";
import { useApp } from "@/contexts/AppContext";
import { useI18n } from "@/hooks/use-i18n";
import { feature, supportsAction } from "@/lib/ha-model";
import { mediaArtwork, type MediaBrowser, type MediaItem, type SonosQueueItem } from "@/lib/sonos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export type SonosRun = (work: () => Promise<unknown>) => Promise<boolean>;
const tabs = ["Favorites", "Browse music", "Playlists", "Queue"] as const;
type Tab = typeof tabs[number];
const queueKey = (items: SonosQueueItem[]) => JSON.stringify(items);

export function SonosLibrary({ player, disabled, run, revision }: { player: Entity; disabled: boolean; run: SonosRun; revision: number }) {
  const { browseMedia, sonosQueue, command, services, homeOnline } = useApp();
  const { message: t } = useI18n();
  const [tab, setTab] = useState<Tab>("Favorites"), [path, setPath] = useState<MediaItem[]>([]);
  const [filter, setFilter] = useState(""), [limit, setLimit] = useState(60);
  const [data, setData] = useState<MediaBrowser>(), [queue, setQueue] = useState<SonosQueueItem[]>([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0), [clear, setClear] = useState<string>();
  const [remove, setRemove] = useState<{ index: number; queue: string }>();
  const supported = tab === "Queue" ? !!services.sonos?.get_queue : feature(player, 131072);
  const target = path[path.length - 1];
  const playerId = player.entityId;
  const queueSize = player.attributes.queue_size, queuePosition = player.attributes.queue_position;
  useEffect(() => {
    if (!homeOnline || !supported) { setLoading(false); return; }
    let active = true;
    setLoading(true); setError("");
    const load = async () => {
      try {
        if (tab === "Queue") {
          const items = await sonosQueue(playerId);
          if (active) setQueue(items);
        } else {
          const location = target ?? (tab === "Favorites" ? { media_content_type: "favorites", media_content_id: "" } : tab === "Playlists" ? { media_content_type: "playlist", media_content_id: "A:PLAYLISTS" } : undefined);
          let result = await browseMedia(playerId, location);
          if (tab === "Favorites" && !target) {
            const folders = await Promise.all((result.children ?? []).map(async item => item.can_expand && item.media_content_type === "favorites_folder" ? (await browseMedia(playerId, item)).children ?? [] : [item]));
            result = { ...result, children: folders.flat() };
          }
          if (active) setData(result);
        }
      } catch (error) { if (active) setError(error instanceof Error ? error.message : "Music could not be loaded. Check the connection and try again."); }
      finally { if (active) setLoading(false); }
    };
    void load();
    return () => { active = false; };
  }, [browseMedia, sonosQueue, playerId, homeOnline, supported, tab, target, refresh, revision, queueSize, queuePosition]);
  useEffect(() => {
    if (tab !== "Queue" || !homeOnline || disabled) return;
    const interval = window.setInterval(() => { if (!document.hidden) setRefresh(value => value + 1); }, 15000);
    return () => window.clearInterval(interval);
  }, [tab, homeOnline, disabled]);
  const changeTab = (value: Tab) => { if (value === tab) return; setTab(value); setPath([]); setData(undefined); setQueue([]); setFilter(""); setLimit(60); setError(""); setLoading(true); };
  const open = (item: MediaItem) => { setPath(items => [...items, item]); setData(undefined); setFilter(""); setLimit(60); };
  const play = (item: MediaItem, enqueue: "replace" | "add" | "next" = "replace") => run(() => command(playerId, "play_media", { media_content_id: item.media_content_id, media_content_type: item.media_content_type, enqueue }));
  const queueAction = async (action: "play_queue" | "remove_from_queue" | "clear_playlist", index?: number, expectedQueue = queueKey(queue)) => {
    const ok = await run(async () => {
      const latest = await sonosQueue(playerId);
      if (queueKey(latest) !== expectedQueue) { setQueue(latest); throw new Error("The queue changed. Check the updated tracks and try again."); }
      await command(playerId, action, index);
    });
    if (ok) setRefresh(value => value + 1);
    return ok;
  };
  const blocked = disabled || !homeOnline || loading || !!error;
  const matches = (title: string) => title.toLocaleLowerCase().includes(filter.toLocaleLowerCase());
  const items = (data?.children ?? []).filter(item => matches(item.title));
  const queueItems = queue.map((item, index) => ({ item, index })).filter(({ item }) => matches(`${item.media_title ?? ""} ${item.media_artist ?? ""}`));
  const count = tab === "Queue" ? queueItems.length : items.length;
  return <section className="sonos-library glow-panel" aria-label={t("Music library")}>
    <div className="sonos-library-heading"><div><h2>{t("Your music")}</h2><p className="sonos-caption">{t("Play on {name}", { name: player.name })}</p></div>
      <div className="sonos-library-actions"><label className="sonos-search"><Search size={18} aria-hidden="true" /><Input value={filter} aria-label={t("Filter this list")} placeholder={t("Filter this list…")} onChange={event => { setFilter(event.target.value); setLimit(60); }} /></label>
        <Button size="icon" variant="ghost" aria-label={t("Refresh music")} title={t("Refresh music")} disabled={!homeOnline || loading || !supported} onClick={() => setRefresh(value => value + 1)}><RefreshCw size={18} aria-hidden="true" /></Button>
      </div>
    </div>
    <div className="sonos-library-tabs" role="group" aria-label={t("Music views")}>{tabs.map(value => <Button key={value} variant="ghost" aria-pressed={tab === value} onClick={() => changeTab(value)}>{value === "Favorites" ? <Star size={17} /> : value === "Queue" ? <ListMusic size={17} /> : <Music2 size={17} />}{t(value)}</Button>)}</div>
    <div className="sonos-library-content" aria-busy={loading}>
      {!!path.length && <div className="sonos-breadcrumb"><Button variant="ghost" onClick={() => { setPath(items => items.slice(0, -1)); setData(undefined); setFilter(""); setLimit(60); }}><ArrowLeft size={17} />{t("Back")}</Button><h3>{target.title}</h3>{target.can_play && <Button variant="outline" disabled={blocked || !supportsAction(player, "play_media", services)} onClick={() => { void play(target); }}><Play size={16} />{t("Play all")}</Button>}</div>}
      {!supported ? <p className="sonos-empty-message">{t(tab === "Queue" ? "Queue access is not available. Update Home Assistant and check the Sonos integration." : "This speaker does not report a music browser.")}</p> : <>
        {error && <div className="sonos-inline-actions" role="alert"><p>{t(error)}</p><Button variant="outline" disabled={!homeOnline || loading} onClick={() => setRefresh(value => value + 1)}>{t("Retry")}</Button></div>}
        {loading && !count && <div className="sonos-library-loading" role="status"><span className="sr-only">{t("Loading music…")}</span>{[0, 1, 2, 3].map(value => <div key={value} />)}</div>}
        {!loading && !error && !count && <div className="sonos-empty-message"><Music2 size={28} aria-hidden="true" /><p>{t(filter ? "No matching music. Try another search." : tab === "Favorites" ? "Save favorites in the Sonos app to keep your music close." : tab === "Queue" ? "Your queue is quiet. Choose music to start listening." : tab === "Playlists" ? "No music-library playlists. You can also find playlists in Favorites or Browse music." : "No music in this folder.")}</p></div>}
        {tab === "Queue" ? <>
          {!!queue.length && <div className="sonos-queue-heading"><span className="sonos-caption">{t("{count} tracks", { count: queue.length })}</span>{supportsAction(player, "clear_playlist", services) && <Button variant="ghost" disabled={blocked} onClick={() => setClear(queueKey(queue))}><Trash2 size={16} />{t("Clear queue")}</Button>}</div>}
          <ol className="sonos-queue">{queueItems.slice(0, limit).map(({ item, index }) => <li key={index} aria-current={index === Number(player.attributes.queue_position) - 1 ? "true" : undefined}>
            <button type="button" disabled={blocked || !supportsAction(player, "play_queue", services)} onClick={() => { void queueAction("play_queue", index); }} aria-label={t("Play {title}", { title: item.media_title || t("Untitled track") })}><span className="sonos-track-number">{index === Number(player.attributes.queue_position) - 1 ? <Play size={16} fill="currentColor" /> : index + 1}</span><span><strong>{item.media_title || t("Untitled track")}</strong><small>{[item.media_artist, item.media_album_name].filter(Boolean).join(" · ")}</small></span></button>
            {supportsAction(player, "remove_from_queue", services) && <Button size="icon" variant="ghost" aria-label={t("Remove {title} from queue", { title: item.media_title || t("Untitled track") })} disabled={blocked} onClick={() => setRemove({ index, queue: queueKey(queue) })}><Trash2 size={17} /></Button>}
          </li>)}</ol>
        </> : <div className={tab === "Favorites" && !path.length ? "sonos-favorites" : "sonos-media-list"}>{items.slice(0, limit).map((item, index) => <div className="sonos-media-item" key={`${item.media_content_type}:${item.media_content_id}:${index}`}>
          <button type="button" className="sonos-media-open" disabled={loading || !homeOnline || (item.can_expand ? false : blocked || !item.can_play || !supportsAction(player, "play_media", services))} onClick={() => item.can_expand ? open(item) : void play(item)} aria-label={item.can_expand ? t("Browse {title}", { title: item.title }) : t("Play {title}", { title: item.title })}>
            <MediaThumbnail item={item} playerId={playerId} /><span><strong>{item.title}</strong><small>{item.can_expand ? t("Browse collection") : t(item.media_class === "playlist" ? "Playlist" : item.media_class === "album" ? "Album" : "Play now")}</small></span>{item.can_expand ? <ChevronRight size={18} /> : <Play size={18} />}
          </button>
          {item.can_play && item.media_content_type !== "favorite_item_id" && feature(player, 2097152) && <DropdownMenu><DropdownMenuTrigger asChild><Button size="icon" variant="ghost" disabled={blocked || !supportsAction(player, "play_media", services)} aria-label={t("Queue options for {title}", { title: item.title })}><Plus size={18} /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => { void play(item, "next"); }}>{t("Play next")}</DropdownMenuItem><DropdownMenuItem onSelect={() => { void play(item, "add"); }}>{t("Add to queue")}</DropdownMenuItem></DropdownMenuContent></DropdownMenu>}
        </div>)}</div>}
        {count > limit && <Button variant="outline" className="sonos-show-more" onClick={() => setLimit(value => value + 60)}>{t("Show more")}</Button>}
      </>}
    </div>
    <ConfirmDialog open={clear !== undefined} onOpenChange={open => { if (!open) setClear(undefined); }} title="Clear this group’s queue?" description="This removes every queued track and may stop playback. Your saved playlists and favorites stay in Sonos." confirmLabel="Clear queue" destructive disabled={blocked} onConfirm={async () => { await queueAction("clear_playlist", undefined, clear); }} />
    <ConfirmDialog open={remove !== undefined} onOpenChange={open => { if (!open) setRemove(undefined); }} title="Remove this track?" description="This removes the track from this group’s queue. Your saved playlist is unchanged." confirmLabel="Remove track" destructive disabled={blocked} onConfirm={async () => { await queueAction("remove_from_queue", remove.index, remove.queue); }} />
  </section>;
}

function MediaThumbnail({ item, playerId }: { item: MediaItem; playerId: string }) {
  const src = mediaArtwork(item, playerId);
  const [failed, setFailed] = useState("");
  return <span className="sonos-thumbnail">{src && failed !== src ? <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(src)} /> : item.can_expand ? <Folder size={26} strokeWidth={1.5} aria-hidden="true" /> : <Music2 size={26} strokeWidth={1.5} aria-hidden="true" />}</span>;
}
