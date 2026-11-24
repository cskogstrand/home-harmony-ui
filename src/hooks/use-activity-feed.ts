import { useEffect, useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { useFamily } from "@/contexts/FamilyContext";
import { mergeLogbook, type LogbookEvent } from "@/lib/activity";
import { cameraPersonSensors } from "@/lib/camera-detection";

export type LogbookStatus = "loading" | "ready" | "unavailable" | "stale";
interface LogbookWindow { hours?: number; start?: string; end?: string; entityIds?: string[]; enabled?: boolean }

/**
 * Logbook events for a window (`hours` back from now, or `start`–`end`), updated live and resubscribed after a reconnect.
 * Events stay cached while Home Assistant is offline and are reported as `stale`.
 */
export function useLogbook({ hours, start, end, entityIds, enabled = true }: LogbookWindow) {
  const { homeOnline, subscribeLogbook } = useApp();
  const key = JSON.stringify({ hours, start, end, entityIds });
  const [feed, setFeed] = useState<{ key: string; events: LogbookEvent[]; status: LogbookStatus }>({ key, events: [], status: "loading" });
  useEffect(() => {
    if (!enabled || !homeOnline) return;
    const range = JSON.parse(key) as LogbookWindow;
    // A reconnect replays the window's history, so its first batch replaces the cached events.
    let replace = true;
    return subscribeLogbook({
      start: new Date(range.start ?? Date.now() - (range.hours ?? 24) * 3600000),
      end: range.end ? new Date(range.end) : undefined, entityIds: range.entityIds,
    }, events => {
      const fresh = replace && !!events;
      if (events) replace = false;
      setFeed(previous => {
        const cached = previous.key === key ? previous.events : [];
        return events ? { key, events: mergeLogbook(fresh ? [] : cached, events), status: "ready" } : { key, events: cached, status: "unavailable" };
      });
    });
  }, [key, enabled, homeOnline, subscribeLogbook]);
  const current = feed.key === key ? feed : { events: [], status: "loading" as const };
  const status: LogbookStatus = homeOnline ? current.status : current.events.length ? "stale" : "unavailable";
  return { events: current.events, status };
}

/** Camera person sensors by entity ID, named after their configured camera. */
export function useActivityPersonSensors() {
  const { entities } = useApp().currentHome;
  const { cameras } = useFamily();
  return Object.fromEntries([...cameraPersonSensors(cameras.items, entities)].map(([camera, sensor]) =>
    [sensor.entityId, cameras.items.find(item => item.id === camera)?.name || sensor.name]));
}
