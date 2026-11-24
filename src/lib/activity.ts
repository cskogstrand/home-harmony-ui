import { z } from "zod";

/** One Home Assistant logbook entry: a state change (`state`) or a described event (`message`). `when` is in milliseconds. */
export interface LogbookEvent { entityId: string; when: number; state?: string; message?: string; name?: string }

/** The logbook backfill never reaches further back than this, so a subscription cannot request days of history. */
export const MAX_LOGBOOK_BACKFILL_MS = 2 * 86400000;

const logbookEventSchema = z.object({
  entity_id: z.string().regex(/^[a-z0-9_]+\.[a-z0-9_]+$/),
  // Home Assistant sends epoch seconds with a fraction.
  when: z.number().finite().positive(),
  state: z.string().max(255).optional(),
  message: z.string().max(1000).optional(),
  name: z.string().max(255).optional(),
});
const logbookMessageSchema = z.object({ events: z.array(z.unknown()) });

/** Valid entity events from one `logbook/event_stream` message; entries without an entity or with an invalid shape are dropped. */
export function parseLogbookMessage(message: unknown): LogbookEvent[] | undefined {
  const parsed = logbookMessageSchema.safeParse(message);
  if (!parsed.success) return undefined;
  return parsed.data.events.flatMap(value => {
    const event = logbookEventSchema.safeParse(value);
    if (!event.success || event.data.state === undefined && event.data.message === undefined) return [];
    const { entity_id, when, state, message, name } = event.data;
    return [{ entityId: entity_id, when: Math.round(when * 1000), ...(state !== undefined ? { state } : {}), ...(message !== undefined ? { message } : {}), ...(name ? { name } : {}) }];
  });
}

const eventKey = (event: LogbookEvent) => `${event.entityId}|${event.when}|${event.state ?? ""}|${event.message ?? ""}`;
/** Adds a batch to the known events: newest first, without duplicates (a reconnect replays history) and capped at `limit`. */
export function mergeLogbook(previous: LogbookEvent[], batch: LogbookEvent[], limit = 2000) {
  const events = new Map(previous.map(event => [eventKey(event), event]));
  for (const event of batch) events.set(eventKey(event), event);
  return [...events.values()].sort((a, b) => b.when - a.when).slice(0, limit);
}
