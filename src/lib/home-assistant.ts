import { z } from "zod";
import { atLeastHaVersion } from "home-assistant-js-websocket/dist/util.js";
import {
  createConnection, subscribeEntities, getConfig, getServices, getUser, callService,
  ERR_INVALID_AUTH, ERR_INVALID_AUTH_CALLBACK, ERR_CONNECTION_LOST,
  Auth, type Connection, type HassConfig, type HassServices, type HassUser,
} from "home-assistant-js-websocket";
import type { CalendarEvent, EntityAction, EntityStates, Home, Registries, TodoItem } from "@/types/api";
import { available, emptyRegistries, entityCommand, feature, mapHome, supportsAction } from "./ha-model";
import { mediaBrowserSchema, sonosQueueSchema, type MediaItem } from "./sonos";
import { playCameraStream } from "./camera-stream";
import { MessageError } from "./i18n";
import { fetchTranslations, noTranslations, type HaTranslations } from "./ha-translations";
import type { NotificationEvent } from "./notifications";
import { MAX_LOGBOOK_BACKFILL_MS, parseLogbookMessage, type LogbookEvent } from "./activity";
import { nordPoolSlots, type PriceSlot } from "./electricity-price";

export type ConnectionStatus = "disconnected" | "connecting" | "syncing" | "connected" | "reconnecting" | "auth-error";
type CommandStatus = { pending: boolean; pendingAction?: EntityAction; error?: string; message?: string };
type CommandReport = (home: Home) => boolean;
interface Snapshot {
  url: string;
  status: ConnectionStatus;
  error: string;
  warnings: string[];
  states: EntityStates;
  registries: Registries;
  entityRegistryAvailable: boolean;
  config?: HassConfig;
  user?: HassUser;
  services: HassServices;
  /** Home Assistant names and state labels for the dashboard language; empty until loaded or when unavailable. */
  translations: HaTranslations;
  commands: Record<string, CommandStatus & { items?: Record<string, CommandStatus> }>;
}
const calendarDate = z.string().refine(value => /^\d{4}-\d{2}-\d{2}(T.*)?$/.test(value) && Number.isFinite(Date.parse(value)));
const calendarDateValue = z.union([calendarDate, z.object({ date: calendarDate }), z.object({ dateTime: calendarDate })]);
const calendarEventsSchema = z.array(z.object({
  summary: z.string(), start: calendarDateValue, end: calendarDateValue,
  location: z.string().nullish(), description: z.string().nullish(), uid: z.string().nullish(),
  recurrence_id: z.string().nullish(), rrule: z.string().nullish(),
}));
const todoItemsSchema = z.object({ items: z.array(z.object({
  uid: z.string().min(1), summary: z.string(), status: z.enum(["needs_action", "completed"]).nullable().default(null),
  due: z.string().nullish(), description: z.string().nullish(),
})) });
export const forecastSchema = z.array(z.object({
  datetime: z.string().refine(value => Number.isFinite(Date.parse(value))),
  condition: z.string().nullish(), temperature: z.number().finite().nullish(), templow: z.number().finite().nullish(),
  precipitation_probability: z.number().finite().nullish(), precipitation: z.number().finite().nullish(),
}));
export type Forecast = z.infer<typeof forecastSchema>;
const energyPrefsSchema = z.object({ energy_sources: z.array(z.unknown()).default([]), device_consumption: z.array(z.unknown()).default([]) });
const assistResultSchema = z.object({
  conversation_id: z.string().nullish(),
  response: z.object({
    response_type: z.enum(["action_done", "query_answer", "error"]),
    speech: z.object({ plain: z.object({ speech: z.string() }).nullish() }).nullish(),
    data: z.object({ code: z.string().nullish() }).nullish(),
  }),
});
const assistAgentsSchema = z.object({ agents: z.array(z.object({
  id: z.string().min(1).max(255), name: z.string().max(255), supported_languages: z.union([z.literal("*"), z.array(z.string())]),
})) });
export interface AssistAgent { id: string; name: string }
/** One Assist answer: Home Assistant's reply, its kind and, for follow-ups, the conversation it belongs to. */
export interface AssistAnswer { type: "action_done" | "query_answer" | "error"; speech: string; conversationId?: string; code?: string }
const historySchema = z.record(z.string(), z.array(z.object({ s: z.string(), lu: z.number().finite(), lc: z.number().finite().optional() })));
const connectionError = (error: unknown) => error === ERR_INVALID_AUTH || error === ERR_INVALID_AUTH_CALLBACK
  ? "Home Assistant rejected the server token. Update it in the HAOS configuration or .env, then restart the server."
  : "Cannot connect to Home Assistant through the dashboard server. Check the dashboard server logs and its configured Home Assistant URL, port and network connection.";

async function bounded<T>(promise: Promise<T>, milliseconds = 15000): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([promise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Request timed out")), milliseconds); })]);
  } finally { clearTimeout(timer); }
}

// Each screen owns its subscriptions and command guards; credentials stay on the server.
export class HomeAssistantClient {
  private snapshot: Snapshot;
  private listeners = new Set<() => void>();
  private connection?: Connection;
  private cleanup: (() => void)[] = [];
  private requests = new Set<AbortController>();
  private reports = new Map<string, { matches: CommandReport; accepted: boolean }>();
  private generation = 0;
  private epoch = 0;
  private fresh = false;
  private metadataReady = false;
  private metadataVersion = 0;
  private language?: string;
  // One request per language for this screen; failures are dropped so a reconnect can retry.
  private translationRequests = new Map<string, Promise<HaTranslations>>();

  constructor() {
    this.snapshot = { url: "", status: "disconnected", error: "", warnings: [], states: {}, registries: emptyRegistries, entityRegistryAvailable: false, services: {}, translations: noTranslations, commands: {} };
  }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(patch: Partial<Snapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach(listener => listener());
  }
  start = () => { void this.connect(); };
  private close() {
    this.generation++;
    this.epoch++;
    this.fresh = false;
    this.metadataReady = false;
    this.requests.forEach(request => request.abort());
    this.requests.clear();
    this.reports.clear();
    this.cleanup.splice(0).forEach(cleanup => cleanup());
    this.connection?.close();
    this.connection = undefined;
  }
  dispose = () => { this.close(); };
  disconnect = () => { this.close(); this.update({ status: "disconnected", error: "", commands: {} }); };
  connect = async () => {
    this.close();
    const generation = this.generation;
    const current = () => generation === this.generation;
    this.update({ status: "connecting", error: "", warnings: [], commands: {} });
    try {
      const response = await fetch("/api/runtime", { credentials: "same-origin", redirect: "error", signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error();
      const runtime = z.object({ homeAssistantUrl: z.string().url() }).parse(await response.json());
      if (!current()) return;
      this.update({ url: runtime.homeAssistantUrl });
      // HA credentials stay on the server; the same-origin socket replaces this placeholder.
      const auth = new Auth({ hassUrl: window.location.origin, clientId: `${window.location.origin}/`, access_token: "server-managed", refresh_token: "", expires: Number.MAX_SAFE_INTEGER, expires_in: Number.MAX_SAFE_INTEGER });
      const conn = await createConnection({ auth, setupRetry: 0 });
      if (!current()) { conn.close(); return; }
      this.connection = conn;
      if (!atLeastHaVersion(conn.haVersion, 2023, 9)) throw new Error("unsupported-version");
      const ready = () => {
        if (!current()) return;
        this.epoch++;
        this.fresh = false;
        this.metadataReady = false;
        this.update({ status: "syncing", error: "" });
        void this.loadMetadata(conn, generation);
        void this.loadTranslations(conn, generation);
      };
      const disconnected = () => {
        if (!current()) return;
        this.epoch++; this.fresh = false; this.metadataReady = false;
        this.requests.forEach(request => request.abort());
        this.update({ status: "reconnecting" });
      };
      const authError = () => {
        if (!current()) return;
        this.close();
        this.update({ status: "auth-error", user: undefined, error: connectionError(ERR_INVALID_AUTH) });
      };
      conn.addEventListener("ready", ready);
      conn.addEventListener("disconnected", disconnected);
      conn.addEventListener("reconnect-error", authError);
      this.cleanup.push(() => {
        conn.removeEventListener("ready", ready);
        conn.removeEventListener("disconnected", disconnected);
        conn.removeEventListener("reconnect-error", authError);
      });
      ready();
      let previous: EntityStates;
      this.cleanup.push(subscribeEntities(conn, states => {
        if (!current() || !conn.connected || states === previous) return;
        previous = states;
        this.fresh = true;
        let commands = this.snapshot.commands;
        if (this.reports.size) {
          const home = mapHome(states, this.snapshot.registries, "home", this.snapshot.config);
          for (const [id, report] of this.reports) {
            if (!report.matches(home)) continue;
            this.reports.delete(id);
            if (report.accepted) commands = { ...commands, [id]: { pending: false } };
          }
        }
        this.update({ states, commands, status: this.metadataReady ? "connected" : "syncing" });
      }));
      for (const event of ["area_registry_updated", "device_registry_updated", "entity_registry_updated", "service_registered", "service_removed"]) {
        void conn.subscribeEvents(() => { if (current() && conn.connected) void this.loadMetadata(conn, generation); }, event)
          .then(unsub => {
            if (current()) this.cleanup.push(() => { void unsub().catch(() => {}); });
            else void unsub().catch(() => {});
          }).catch(() => { if (current()) this.update({ warnings: [...this.snapshot.warnings, "Metadata updates unavailable; reconnect to refresh names and capabilities."] }); });
      }
    } catch (error) {
      if (!current()) return;
      this.close();
      this.update({ status: error === ERR_INVALID_AUTH ? "auth-error" : "disconnected",
        error: error instanceof Error && error.message === "unsupported-version" ? "Home Assistant 2023.9 or newer is required." : connectionError(error) });
    }
  };
  /** Selects the dashboard language for Home Assistant names and states. Cached languages apply immediately. */
  setLanguage = (language: string) => {
    if (language === this.language) return;
    this.language = language;
    // Never show another language's labels while this one loads.
    if (this.snapshot.translations !== noTranslations) this.update({ translations: noTranslations });
    if (this.connection?.connected) void this.loadTranslations(this.connection, this.generation);
  };
  private async loadTranslations(conn: Connection, generation: number) {
    const language = this.language;
    if (!language) return;
    let request = this.translationRequests.get(language);
    if (!request) {
      const pending = bounded(fetchTranslations(conn, language));
      this.translationRequests.set(language, pending);
      pending.catch(() => { if (this.translationRequests.get(language) === pending) this.translationRequests.delete(language); });
      request = pending;
    }
    try {
      const translations = await request;
      if (generation === this.generation && language === this.language && translations !== this.snapshot.translations) this.update({ translations });
    } catch { /* Translations are optional; the app's own labels remain. */ }
  }
  private async loadMetadata(conn: Connection, generation: number) {
    const epoch = this.epoch;
    const version = ++this.metadataVersion;
    const results = await Promise.allSettled([
      bounded(getConfig(conn)), bounded(getUser(conn)), bounded(getServices(conn)),
      bounded(conn.sendMessagePromise<Registries["areas"]>({ type: "config/area_registry/list" })),
      bounded(conn.sendMessagePromise<Registries["devices"]>({ type: "config/device_registry/list" })),
      bounded(conn.sendMessagePromise<Registries["entities"]>({ type: "config/entity_registry/list" })),
    ] as const);
    if (generation !== this.generation || epoch !== this.epoch || version !== this.metadataVersion || !conn.connected) return;
    const [config, user, services, areas, devices, entities] = results;
    const labels = ["configuration", "user", "services", "areas", "physical devices", "entity registry"];
    const warnings = results.flatMap((r, i) => r.status === "rejected" ? [`Home Assistant ${labels[i]} could not be loaded. Check permissions and reconnect.`] : []);
    this.metadataReady = services.status === "fulfilled";
    this.update({
      config: config.status === "fulfilled" ? config.value : undefined,
      user: user.status === "fulfilled" ? user.value : undefined,
      services: services.status === "fulfilled" ? services.value : {},
      entityRegistryAvailable: entities.status === "fulfilled",
      registries: { areas: areas.status === "fulfilled" ? areas.value : [], devices: devices.status === "fulfilled" ? devices.value : [], entities: entities.status === "fulfilled" ? entities.value : [] },
      warnings, status: this.metadataReady && this.fresh ? "connected" : "syncing",
    });
  }
  command = async (entityId: string, action: EntityAction, value?: unknown, code?: string, observe?: (home: Home) => CommandReport) => {
    const conn = this.connection;
    const generation = this.generation;
    const epoch = this.epoch;
    const item = entityId.startsWith("todo.") && value && typeof value === "object" && "item" in value && typeof value.item === "string" ? value.item : undefined;
    const setCommand = (command: Snapshot["commands"][string]) => {
      if (generation !== this.generation) return;
      if (item !== undefined) {
        const items = { ...this.snapshot.commands[entityId]?.items, [item]: command };
        if (!command.pending && !command.error) delete items[item];
        const statuses = Object.values(items);
        command = { ...command, items, pending: statuses.some(status => status.pending), error: statuses.find(status => status.error)?.error };
      }
      this.update({ commands: { ...this.snapshot.commands, [entityId]: command } });
    };
    const status = this.snapshot.commands[entityId];
    if ((item !== undefined && status?.items ? status.items[item] : status)?.pending) throw new Error("A command is already pending for this entity.");
    try {
      if (!conn?.connected || !this.fresh || this.snapshot.status !== "connected") throw new Error("Controls are paused until fresh Home Assistant state arrives.");
      const home = mapHome(this.snapshot.states, this.snapshot.registries, "home", this.snapshot.config);
      const { entities } = home;
      const entity = entities.find(e => e.entityId === entityId);
      if (!entity) throw new Error("This entity no longer exists.");
      const command = entityCommand(entity, action, this.snapshot.services, value, code);
      if (action === "join" && (command.data.group_members as string[]).some(id => {
        const member = entities.find(item => item.entityId === id);
        return !member || !available(member) || member.integration !== entity.integration || !supportsAction(member, "join", this.snapshot.services);
      })) throw new Error("A selected speaker is unavailable or cannot join this group.");
      // Eva can spend 30 seconds sending a command, then 60 seconds confirming a scene.
      let timeout = entity.integration === "eva" || ["scene", "script"].includes(entity.domain) ? 120000 : 15000;
      // Sonos waits up to 30 seconds for topology after each speaker joins.
      if (action === "join") timeout = 45000 * (command.data.group_members as string[]).length;
      else if (action === "unjoin") timeout = 45000;
      const report = observe?.(home);
      if (report) this.reports.set(entityId, { matches: report, accepted: false });
      setCommand(report ? { pending: true, pendingAction: action } : { pending: true });
      try {
        // Never suspend/queue/retry physical commands. The library rejects in-flight calls on loss.
        await bounded(action === "update_event" || action === "delete_event"
          ? conn.sendMessagePromise({ type: action === "delete_event" ? "calendar/event/delete" : "calendar/event/update", entity_id: entityId, ...command.data })
          : callService(conn, command.domain, command.service, command.data, command.target), timeout);
      } catch (error) {
        if (action === "create_event") throw new Error("Home Assistant could not confirm the save. Check the calendar before trying again to avoid duplicates.");
        if (action === "update_event") throw new Error("Home Assistant could not confirm the update. Check the calendar and your permissions before trying again.");
        if (action === "delete_event") throw new Error("Home Assistant could not confirm the deletion. Check the calendar and your permissions before trying again.");
        if (["join", "unjoin"].includes(action) && error !== ERR_CONNECTION_LOST && conn.connected) {
          if (error && typeof error === "object" && "message" in error && typeof error.message === "string" && error.message !== "Request timed out") throw new MessageError("Home Assistant could not change the group: {reason}", { reason: error.message.slice(0, 500) });
          throw new Error("Home Assistant did not confirm the group change. Check the group in Sonos before trying again.");
        }
        if (conn.connected && error && typeof error === "object" && (
          "code" in error && error.code === "timeout"
          || "message" in error && typeof error.message === "string" && (
            error.message === "Request timed out"
            // shortcut: Eva exposes this timeout as text; use a dedicated error code when available.
            || /^Eva accepted the command but did not confirm it within \d+ seconds$/.test(error.message)
          )
        )) throw new Error("Home Assistant has not confirmed the command. It may still be running or already complete. Check its state before trying again.");
        throw new Error(error === ERR_CONNECTION_LOST || !conn.connected
          ? "Connection lost. The command outcome is unknown; it will not be replayed. Check reported state before trying again."
          : "Home Assistant rejected or did not acknowledge the command. Check permissions, the required code and reported state before trying again.");
      }
      if (epoch !== this.epoch || generation !== this.generation) throw new Error("Connection changed. Check reported state; the command will not be replayed.");
      const waiting = this.reports.get(entityId);
      if (waiting) {
        // Close the confirmation dialog on acceptance. The control stays busy until telemetry arrives.
        waiting.accepted = true;
        return;
      }
      setCommand({ pending: false, message: "Request accepted. The reading below is reported by Home Assistant." });
    } catch (error) {
      if (generation === this.generation) this.reports.delete(entityId);
      setCommand({ pending: false, error: (error as Error).message });
      throw error;
    }
  };
  browseMedia = async (entityId: string, item?: Pick<MediaItem, "media_content_id" | "media_content_type">) => {
    const conn = this.connection, generation = this.generation, epoch = this.epoch;
    try {
      const entity = mapHome(this.snapshot.states, this.snapshot.registries, "home").entities.find(e => e.entityId === entityId);
      if (!conn?.connected || this.snapshot.status !== "connected" || !entity || !available(entity) || entity.domain !== "media_player" || !feature(entity, 131072)) throw new Error();
      const media = item && z.object({ media_content_id: z.string().max(8192), media_content_type: z.string().min(1).max(256) }).parse(item);
      const result = await bounded(conn.sendMessagePromise({ type: "media_player/browse_media", entity_id: entityId, ...media }));
      if (generation !== this.generation || epoch !== this.epoch || !conn.connected) throw new Error();
      return mediaBrowserSchema.parse(result);
    } catch { throw new Error("Music could not be loaded. Check the connection and try again."); }
  };
  sonosQueue = async (entityId: string) => {
    const conn = this.connection, generation = this.generation, epoch = this.epoch;
    try {
      const entity = mapHome(this.snapshot.states, this.snapshot.registries, "home").entities.find(e => e.entityId === entityId);
      if (!conn?.connected || this.snapshot.status !== "connected" || !entity || !available(entity) || entity.domain !== "media_player" || entity.integration !== "sonos" || !this.snapshot.services.sonos?.get_queue) throw new Error();
      const result = await bounded(conn.sendMessagePromise({ type: "call_service", domain: "sonos", service: "get_queue", target: { entity_id: entityId }, return_response: true }));
      if (generation !== this.generation || epoch !== this.epoch || !conn.connected) throw new Error();
      const queue = z.object({ response: z.record(z.string(), sonosQueueSchema) }).parse(result).response[entityId];
      if (!queue) throw new Error();
      return queue;
    } catch { throw new Error("The queue could not be loaded. Check the connection and try again."); }
  };
  todoItems = async (entityId: string): Promise<TodoItem[]> => {
    const conn = this.connection, generation = this.generation, epoch = this.epoch;
    try {
      const entity = mapHome(this.snapshot.states, this.snapshot.registries, "home").entities.find(e => e.entityId === entityId);
      if (!conn?.connected || !this.fresh || this.snapshot.status !== "connected" || entity?.domain !== "todo" || !available(entity)) throw new Error("To-do list unavailable.");
      const response = await bounded(conn.sendMessagePromise({ type: "todo/item/list", entity_id: entityId }));
      if (generation !== this.generation || epoch !== this.epoch || !conn.connected) throw new Error("Connection changed.");
      return todoItemsSchema.parse(response).items as TodoItem[];
    } catch {
      throw new Error("To-do items could not be read. Check the connection, list integration and Home Assistant permissions.");
    }
  };
  watchCameraStream = (entityId: string, video: HTMLVideoElement, signal: AbortSignal, onError: () => void) => {
    if (signal.aborted) return;
    const conn = this.connection;
    if (!conn?.connected || this.snapshot.status !== "connected" || !/^camera\.[a-z0-9_]+$/.test(entityId)) { onError(); return; }
    const controller = new AbortController();
    const stop = () => controller.abort();
    this.requests.add(controller);
    signal.addEventListener("abort", stop, { once: true });
    controller.signal.addEventListener("abort", () => { this.requests.delete(controller); signal.removeEventListener("abort", stop); }, { once: true });
    playCameraStream(conn, entityId, video, controller.signal, () => { stop(); onError(); });
  };
  watchForecast = (entityId: string, type: "hourly" | "daily" | "twice_daily", signal: AbortSignal, receive: (forecast: Forecast | null) => void) => {
    const conn = this.connection, generation = this.generation, epoch = this.epoch;
    const current = () => !signal.aborted && generation === this.generation && epoch === this.epoch && conn?.connected && this.snapshot.status === "connected";
    if (!current() || !/^weather\.[a-z0-9_]+$/.test(entityId)) { if (!signal.aborted) receive(null); return; }
    let unsubscribe: (() => Promise<void>) | undefined;
    const stop = () => {
      void unsubscribe?.().catch(() => {});
      signal.removeEventListener("abort", stop);
      this.cleanup = this.cleanup.filter(cleanup => cleanup !== stop);
    };
    this.cleanup.push(stop);
    signal.addEventListener("abort", stop, { once: true });
    void conn.subscribeMessage<{ forecast: unknown }>(message => {
      if (!current()) return;
      const parsed = forecastSchema.safeParse(message?.forecast);
      receive(parsed.success ? parsed.data : null);
    }, { type: "weather/subscribe_forecast", entity_id: entityId, forecast_type: type }, { resubscribe: false }).then(unsub => {
      if (current()) unsubscribe = unsub;
      else void unsub().catch(() => {});
    }).catch(() => { if (current()) receive(null); });
  };

  watchEvents = (eventType: string, signal: AbortSignal, receive: (event: NotificationEvent | null) => void, ready?: () => void) => {
    const conn = this.connection, generation = this.generation, epoch = this.epoch;
    const current = () => !signal.aborted && generation === this.generation && epoch === this.epoch && conn?.connected && this.snapshot.status === "connected";
    if (!current() || !/^[a-zA-Z0-9_]{1,100}$/.test(eventType)) { if (!signal.aborted) receive(null); return; }
    let unsubscribe: (() => Promise<void>) | undefined;
    const stop = () => {
      void unsubscribe?.().catch(() => {});
      signal.removeEventListener("abort", stop);
      this.cleanup = this.cleanup.filter(cleanup => cleanup !== stop);
    };
    this.cleanup.push(stop);
    signal.addEventListener("abort", stop, { once: true });
    void conn.subscribeMessage<NotificationEvent>(event => {
      if (current() && event?.event_type === eventType && event.data && typeof event.data === "object" && !Array.isArray(event.data)) receive(event);
    }, { type: "subscribe_events", event_type: eventType }, { resubscribe: false }).then(unsub => {
      if (current()) { unsubscribe = unsub; ready?.(); }
      else void unsub().catch(() => {});
    }).catch(() => { if (current()) receive(null); });
  };

  /**
   * Logbook for the given entities, or every logged entity when `entityIds` is omitted: history since `start` first, then live
   * events until `end` (live when omitted). The backfill is capped at two days. `receive(null)` reports an unavailable logbook.
   * The subscription belongs to the current connection; subscribe again after a reconnect. Returns the unsubscribe.
   */
  subscribeLogbook = ({ start, end, entityIds }: { start: Date; end?: Date; entityIds?: string[] }, receive: (events: LogbookEvent[] | null) => void) => {
    const controller = new AbortController(), signal = controller.signal;
    const unsubscribeLogbook = () => controller.abort();
    const conn = this.connection, generation = this.generation, epoch = this.epoch;
    const current = () => !signal.aborted && generation === this.generation && epoch === this.epoch && conn?.connected && this.snapshot.status === "connected";
    const from = Math.max(start.getTime(), Date.now() - MAX_LOGBOOK_BACKFILL_MS);
    if (!current() || !Number.isFinite(from) || entityIds?.some(id => !/^[a-z0-9_]+\.[a-z0-9_]+$/.test(id))) { receive(null); return unsubscribeLogbook; }
    if (entityIds?.length === 0 || end && end.getTime() <= from) { receive([]); return unsubscribeLogbook; }
    let unsubscribe: (() => Promise<void>) | undefined;
    const stop = () => {
      void unsubscribe?.().catch(() => {});
      signal.removeEventListener("abort", stop);
      this.cleanup = this.cleanup.filter(cleanup => cleanup !== stop);
    };
    this.cleanup.push(stop);
    signal.addEventListener("abort", stop, { once: true });
    void conn.subscribeMessage<unknown>(message => {
      if (!current()) return;
      const events = parseLogbookMessage(message);
      if (events) receive(events);
    }, { type: "logbook/event_stream", start_time: new Date(from).toISOString(), ...(end ? { end_time: end.toISOString() } : {}), ...(entityIds ? { entity_ids: entityIds } : {}) }, { resubscribe: false }).then(unsub => {
      if (current()) unsubscribe = unsub;
      else void unsub().catch(() => {});
    }).catch(() => { if (current()) receive(null); });
    return unsubscribeLogbook;
  };

  entityHistory = async (entityId: string, days: 1 | 7, signal: AbortSignal) => {
    const conn = this.connection, generation = this.generation, epoch = this.epoch;
    if (!conn?.connected || this.snapshot.status !== "connected" || !/^(sensor|air_quality)\.[a-z0-9_]+$/.test(entityId)) throw new Error("History unavailable");
    const end = new Date(), start = new Date(end.getTime() - days * 86400000);
    const result = await bounded(conn.sendMessagePromise({ type: "history/history_during_period", entity_ids: [entityId], start_time: start.toISOString(), end_time: end.toISOString(), minimal_response: true, no_attributes: true }));
    if (signal.aborted || generation !== this.generation || epoch !== this.epoch) throw new Error("History request cancelled");
    return historySchema.parse(result)[entityId] ?? [];
  };

  /**
   * Read-only price series for one local date from the Nord Pool entry behind a chosen price sensor, through
   * `nordpool.get_prices_for_date` with `return_response`. Resolves null when the sensor has no such source;
   * rejects when the prices are not published or cannot be read.
   */
  priceSeries = async (entityId: string, date: string, signal: AbortSignal): Promise<PriceSlot[] | null> => {
    const conn = this.connection, generation = this.generation, epoch = this.epoch;
    if (!conn?.connected || this.snapshot.status !== "connected" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Prices unavailable");
    const entry = this.snapshot.registries.entities.find(item => item.entity_id === entityId);
    if (entry?.platform !== "nordpool" || !entry.config_entry_id || !this.snapshot.services.nordpool?.get_prices_for_date) return null;
    const result = await bounded(conn.sendMessagePromise({ type: "call_service", domain: "nordpool", service: "get_prices_for_date", service_data: { config_entry: entry.config_entry_id, date }, return_response: true }));
    if (signal.aborted || generation !== this.generation || epoch !== this.epoch) throw new Error("Price request cancelled");
    const slots = nordPoolSlots((result as { response?: unknown } | null)?.response, entry.unique_id);
    if (!slots.length) throw new Error("Prices unavailable");
    return slots;
  };

  /** Read-only: whether Home Assistant's Energy dashboard has any sources. Rejects when the answer is unknown. */
  energySetup = async (signal: AbortSignal): Promise<"configured" | "missing"> => {
    const conn = this.connection, generation = this.generation, epoch = this.epoch;
    const current = () => !signal.aborted && generation === this.generation && epoch === this.epoch;
    if (!conn?.connected || this.snapshot.status !== "connected") throw new Error("Energy preferences unavailable");
    let result: unknown;
    try {
      result = await bounded(conn.sendMessagePromise({ type: "energy/get_prefs" }));
    } catch (error) {
      // Home Assistant answers not_found until someone saves the Energy configuration.
      if (current() && (error as { code?: unknown } | null)?.code === "not_found") return "missing";
      throw new Error("Energy preferences unavailable");
    }
    if (!current()) throw new Error("Energy preferences request cancelled");
    const prefs = energyPrefsSchema.parse(result);
    return prefs.energy_sources.length || prefs.device_consumption.length ? "configured" : "missing";
  };

  /**
   * Sends one sentence to Home Assistant Assist (`conversation/process`). Assist can act on whatever the owner exposed
   * to it in Home Assistant, so a failed or unanswered request is never resent automatically.
   */
  assist = async (text: string, { agentId, conversationId, language }: { agentId?: string; conversationId?: string; language: string }): Promise<AssistAnswer> => {
    const conn = this.connection, generation = this.generation, epoch = this.epoch;
    const sentence = text.trim();
    if (!sentence) throw new Error("Type a question first.");
    if (!conn?.connected || this.snapshot.status !== "connected") throw new Error("Home Assistant is offline. Your question was not sent.");
    let result: unknown;
    try {
      // Conversation agents backed by a language model can take longer than ordinary requests.
      result = await bounded(conn.sendMessagePromise({ type: "conversation/process", text: sentence, language,
        ...(agentId ? { agent_id: agentId } : {}), ...(conversationId ? { conversation_id: conversationId } : {}) }), 30000);
    } catch (error) {
      if (error === ERR_CONNECTION_LOST || !conn.connected) throw new Error("The connection was lost before Home Assistant answered. Anything you asked for may already have happened; check before asking again.");
      if ((error as { message?: unknown } | null)?.message === "Request timed out") throw new Error("Home Assistant did not answer in time. Anything you asked for may still happen; check before asking again.");
      throw new Error("Home Assistant could not handle the question. Check that Assist is set up in Home Assistant, then try again.");
    }
    if (generation !== this.generation || epoch !== this.epoch) throw new Error("The connection changed before Home Assistant answered. Check the home before asking again.");
    const parsed = assistResultSchema.safeParse(result);
    if (!parsed.success) throw new Error("Home Assistant sent an answer this screen cannot read.");
    const { response, conversation_id } = parsed.data;
    return { type: response.response_type, speech: response.speech?.plain?.speech.trim() ?? "",
      ...(conversation_id ? { conversationId: conversation_id } : {}), ...(response.data?.code ? { code: response.data.code } : {}) };
  };

  /** Read-only: the conversation agents that understand `language`, as Home Assistant lists them. */
  assistAgents = async (language: string): Promise<AssistAgent[]> => {
    const conn = this.connection, generation = this.generation, epoch = this.epoch;
    try {
      if (!conn?.connected || this.snapshot.status !== "connected") throw new Error();
      const result = await bounded(conn.sendMessagePromise({ type: "conversation/agent/list", language }));
      if (generation !== this.generation || epoch !== this.epoch) throw new Error();
      // Home Assistant narrows each agent's languages to the requested one; an empty list means it does not understand it.
      return assistAgentsSchema.parse(result).agents
        .filter(agent => agent.supported_languages === "*" || agent.supported_languages.length > 0)
        .map(({ id, name }) => ({ id, name: name.trim() || id }));
    } catch { throw new Error("Conversation agents could not be loaded. Check the connection to Home Assistant."); }
  };

  watchCalendarEvents = (entityId: string, start: string, end: string, signal: AbortSignal, receive: (events: CalendarEvent[] | null) => void) => {
    const conn = this.connection, generation = this.generation, epoch = this.epoch;
    const current = () => !signal.aborted && generation === this.generation && epoch === this.epoch && conn?.connected && this.snapshot.status === "connected";
    if (!current()) { if (!signal.aborted) receive(null); return; }
    let unsubscribe: (() => Promise<void>) | undefined;
    let stopStates: (() => void) | undefined;
    let poll: ReturnType<typeof setInterval> | undefined;
    const stop = () => {
      clearInterval(poll);
      stopStates?.();
      void unsubscribe?.().catch(() => {});
      signal.removeEventListener("abort", stop);
      this.cleanup = this.cleanup.filter(cleanup => cleanup !== stop);
    };
    this.cleanup.push(stop);
    signal.addEventListener("abort", stop, { once: true });
    void conn.subscribeMessage<{ events: unknown }>(message => {
      if (!current()) return;
      const parsed = calendarEventsSchema.safeParse(message?.events);
      receive(parsed.success ? parsed.data as CalendarEvent[] : null);
    }, { type: "calendar/event/subscribe", entity_id: entityId, start, end }, { resubscribe: false }).then(unsub => {
      if (current()) unsubscribe = unsub;
      else void unsub().catch(() => {});
    }).catch(error => {
      if (!current()) return;
      if (error?.code !== "unknown_command") { receive(null); return; }
      // ponytail: older HA versions lack calendar subscriptions; poll until they are upgraded.
      let loading = false;
      const load = async () => {
        if (!current() || loading) return;
        loading = true;
        try { const events = await this.calendarEvents(entityId, start, end, signal); if (current()) receive(events); }
        catch { if (current()) receive(null); }
        finally { loading = false; }
      };
      let previous = this.snapshot.states[entityId];
      stopStates = this.subscribe(() => {
        const state = this.snapshot.states[entityId];
        if (state !== previous) { previous = state; void load(); }
      });
      poll = setInterval(() => { void load(); }, 60000);
      void load();
    });
  };
  configurationRequest = (method: "GET" | "PUT", body?: string, revision?: string) => this.storageRequest("/api/config", {
    method, body, headers: body ? { "Content-Type": "application/json", "If-Match": `"${revision}"` } : {},
  });

  storageRequest = async (path: string, options: RequestInit = {}): Promise<Response> => {
    if (!path.startsWith("/api/") || path.includes("\\")) throw new Error("Use a dashboard API path.");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.method === "POST" ? 45000 : 15000);
    try {
      if (controller.signal.aborted) throw new Error();
      const response = await fetch(path, { ...options, credentials: "same-origin", redirect: "error", signal: controller.signal,
        headers: options.headers });
      // Consume the response before removing its cancellation guard.
      const contents = await response.arrayBuffer();
      if (controller.signal.aborted) throw new Error();
      return new Response(contents, { status: response.status, headers: response.headers });
    } catch { throw new Error("Shared storage could not be reached. A save may have completed; check the dashboard before retrying. Your unsaved settings are still on this screen."); }
    finally { clearTimeout(timer); }
  };

  calendarEvents = async (entityId: string, start: string, end: string, signal: AbortSignal): Promise<CalendarEvent[]> => {
    const generation = this.generation;
    if (this.snapshot.status !== "connected" || !entityId.startsWith("calendar.")) throw new Error("Home Assistant calendars are offline.");
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) controller.abort();
    this.requests.add(controller);
    const timer = setTimeout(abort, 15000);
    try {
      if (generation !== this.generation || controller.signal.aborted) throw new Error("Calendar request cancelled.");
      const query = new URLSearchParams({ start, end });
      const response = await fetch(`/api/calendars/${encodeURIComponent(entityId)}?${query}`, {
        signal: controller.signal, credentials: "same-origin", redirect: "error",
      });
      if (response.status === 401) throw ERR_INVALID_AUTH;
      if (!response.ok) throw new Error("Calendar API unavailable. Check the integration, permissions and server configuration.");
      const events = calendarEventsSchema.parse(await response.json()) as CalendarEvent[];
      if (generation !== this.generation || controller.signal.aborted) throw new Error("Calendar request cancelled.");
      return events;
    } catch (error) {
      if (error === ERR_INVALID_AUTH && generation === this.generation) {
        this.close(); this.update({ status: "auth-error", user: undefined, error: connectionError(error) });
      }
      // Do not expose API responses, which can contain sensitive details.
      throw new Error("Calendar events could not be read. Check the connection, calendar integration, permissions and server settings.");
    } finally { clearTimeout(timer); signal.removeEventListener("abort", abort); this.requests.delete(controller); }
  };
}
