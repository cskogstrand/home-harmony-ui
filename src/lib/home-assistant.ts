import { z } from "zod";
import { atLeastHaVersion } from "home-assistant-js-websocket/dist/util.js";
import {
  createConnection, subscribeEntities, getConfig, getServices, getUser, callService,
  ERR_INVALID_AUTH, ERR_INVALID_AUTH_CALLBACK, ERR_CONNECTION_LOST,
  Auth, type Connection, type HassConfig, type HassServices, type HassUser,
} from "home-assistant-js-websocket";
import type { CalendarEvent, EntityAction, EntityStates, Registries, TodoItem } from "@/types/api";
import { available, emptyRegistries, entityCommand, mapHome } from "./ha-model";

export type ConnectionStatus = "disconnected" | "connecting" | "syncing" | "connected" | "reconnecting" | "auth-error";
interface Snapshot {
  url: string;
  status: ConnectionStatus;
  error: string;
  warnings: string[];
  states: EntityStates;
  registries: Registries;
  config?: HassConfig;
  user?: HassUser;
  services: HassServices;
  commands: Record<string, { pending: boolean; error?: string; message?: string }>;
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
})) });
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
  private generation = 0;
  private epoch = 0;
  private fresh = false;
  private metadataReady = false;
  private metadataVersion = 0;

  constructor() {
    this.snapshot = { url: "", status: "disconnected", error: "", warnings: [], states: {}, registries: emptyRegistries, services: {}, commands: {} };
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
        this.update({ states, status: this.metadataReady ? "connected" : "syncing" });
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
      registries: { areas: areas.status === "fulfilled" ? areas.value : [], devices: devices.status === "fulfilled" ? devices.value : [], entities: entities.status === "fulfilled" ? entities.value : [] },
      warnings, status: this.metadataReady && this.fresh ? "connected" : "syncing",
    });
  }
  command = async (entityId: string, action: EntityAction, value?: unknown, code?: string) => {
    const conn = this.connection;
    const generation = this.generation;
    const epoch = this.epoch;
    const setCommand = (command: Snapshot["commands"][string]) => {
      if (generation === this.generation) this.update({ commands: { ...this.snapshot.commands, [entityId]: command } });
    };
    if (this.snapshot.commands[entityId]?.pending) throw new Error("A command is already pending for this entity.");
    try {
      if (!conn?.connected || !this.fresh || this.snapshot.status !== "connected") throw new Error("Controls are paused until fresh Home Assistant state arrives.");
      const entity = mapHome(this.snapshot.states, this.snapshot.registries, "home").entities.find(e => e.entityId === entityId);
      if (!entity) throw new Error("This entity no longer exists.");
      const command = entityCommand(entity, action, this.snapshot.services, value, code);
      setCommand({ pending: true });
      try {
        // Never suspend/queue/retry physical commands. The library rejects in-flight calls on loss.
        await bounded(action === "update_event" || action === "delete_event"
          ? conn.sendMessagePromise({ type: action === "delete_event" ? "calendar/event/delete" : "calendar/event/update", entity_id: entityId, ...command.data })
          : callService(conn, command.domain, command.service, command.data, command.target));
      } catch (error) {
        if (action === "create_event") throw new Error("Home Assistant could not confirm the save. Check the calendar before trying again to avoid duplicates.");
        if (action === "update_event") throw new Error("Home Assistant could not confirm the update. Check the calendar and your permissions before trying again.");
        if (action === "delete_event") throw new Error("Home Assistant could not confirm the deletion. Check the calendar and your permissions before trying again.");
        throw new Error(error === ERR_CONNECTION_LOST || !conn.connected
          ? "Connection lost. The command outcome is unknown; it will not be replayed. Check reported state before trying again."
          : "Home Assistant rejected or did not acknowledge the command. Check permissions, the required code and reported state before trying again.");
      }
      if (epoch !== this.epoch || generation !== this.generation) throw new Error("Connection changed. Check reported state; the command will not be replayed.");
      setCommand({ pending: false, message: "Request accepted. The reading below is reported by Home Assistant." });
    } catch (error) {
      setCommand({ pending: false, error: (error as Error).message });
      throw error;
    }
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
