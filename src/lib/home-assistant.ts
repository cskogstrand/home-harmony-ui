import { z } from "zod";
import { atLeastHaVersion } from "home-assistant-js-websocket/dist/util.js";
import {
  getAuth, createConnection, subscribeEntities, getConfig, getServices, getUser, callService,
  ERR_INVALID_AUTH, ERR_INVALID_AUTH_CALLBACK, ERR_INVALID_HTTPS_TO_HTTP, ERR_CONNECTION_LOST,
  type Auth, type Connection, type HassConfig, type HassServices, type HassUser,
} from "home-assistant-js-websocket";
import type { CalendarEvent, EntityAction, EntityStates, Registries } from "@/types/api";
import { emptyRegistries, entityCommand, mapHome, normalizeHaUrl } from "./ha-model";

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
}));
const URL_KEY = "home-harmony:ha-url";
const connectionError = (error: unknown) => error === ERR_INVALID_AUTH || error === ERR_INVALID_AUTH_CALLBACK
  ? "Home Assistant authentication expired, was revoked, or the callback did not match. Connect again to sign in."
  : error === ERR_INVALID_HTTPS_TO_HTTP
    ? "Mixed content blocked this connection. Use local HTTP for both applications, or trusted HTTPS for both."
    : "Cannot connect to Home Assistant. Check the local URL, network access and browser certificate trust. No public endpoint is needed.";

async function bounded<T>(promise: Promise<T>, milliseconds = 15000): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([promise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Request timed out")), milliseconds); })]);
  } finally { clearTimeout(timer); }
}

// One concrete HA session owns credentials, socket, subscriptions and command guards.
export class HomeAssistantClient {
  private snapshot: Snapshot;
  private listeners = new Set<() => void>();
  private auth?: Auth;
  private authPromise?: Promise<Auth>;
  private connection?: Connection;
  private cleanup: (() => void)[] = [];
  private requests = new Set<AbortController>();
  private generation = 0;
  private epoch = 0;
  private fresh = false;
  private metadataReady = false;
  private metadataVersion = 0;

  constructor() {
    let url = "";
    try { const saved = localStorage.getItem(URL_KEY); if (saved) url = normalizeHaUrl(saved); } catch { /* A new configuration is available in Settings. */ }
    this.snapshot = { url, status: "disconnected", error: "", warnings: [], states: {}, registries: emptyRegistries, services: {}, commands: {} };
  }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(patch: Partial<Snapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach(listener => listener());
  }
  private clearCallback() {
    const url = new URL(window.location.href);
    for (const key of ["auth_callback", "code", "state", "error", "error_description"]) url.searchParams.delete(key);
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }
  start = () => {
    if (this.authPromise && this.snapshot.status === "connecting") { void this.connect(this.snapshot.url); return; }
    if (!new URLSearchParams(window.location.search).has("auth_callback")) return;
    if (!this.snapshot.url) {
      this.clearCallback();
      this.update({ status: "auth-error", error: "The selected instance is missing. Enter its URL in Home settings and connect again." });
      return;
    }
    void this.connect(this.snapshot.url);
  };
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
  disconnect = () => {
    this.close();
    this.update({ status: "disconnected", error: "", commands: {} });
  };
  logout = async () => {
    const auth = this.auth;
    this.auth = undefined;
    this.authPromise = undefined;
    this.disconnect();
    const generation = this.generation;
    this.update({ states: {}, registries: emptyRegistries, config: undefined, user: undefined, services: {}, warnings: [] });
    if (auth) {
      try { await bounded(auth.revoke()); }
      catch { if (generation === this.generation) this.update({ error: "Signed out locally, but server token revocation could not be confirmed. Remove this session in your Home Assistant profile when reachable." }); }
    }
  };
  connect = async (input: string) => {
    let url: string;
    try { url = normalizeHaUrl(input); }
    catch (error) { this.update({ error: error instanceof TypeError ? "Enter a valid HTTP or HTTPS Home Assistant URL." : (error as Error).message }); return; }
    this.close();
    const generation = this.generation;
    if (url !== this.snapshot.url) {
      this.auth = undefined; this.authPromise = undefined;
      this.update({ states: {}, registries: emptyRegistries, config: undefined, user: undefined, services: {} });
    }
    this.update({ url, status: "connecting", error: "", warnings: [], commands: {} });
    const current = () => generation === this.generation;
    try {
      // Persist the selected origin only. Credentials live in this object's memory.
      try { localStorage.setItem(URL_KEY, url); } catch { throw new Error("url-storage"); }
      if (!this.auth) {
        this.authPromise ??= getAuth({ hassUrl: url, clientId: `${window.location.origin}/`, redirectUrl: `${window.location.origin}/settings`, limitHassInstance: true });
        this.clearCallback();
        const auth = await bounded(this.authPromise);
        if (!current()) return;
        this.auth = auth;
        this.authPromise = undefined;
      }
      const conn = await createConnection({ auth: this.auth, setupRetry: 0 });
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
        this.auth = undefined; this.authPromise = undefined;
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
      this.authPromise = undefined;
      if (error === ERR_INVALID_AUTH || error === ERR_INVALID_AUTH_CALLBACK) this.auth = undefined;
      this.close();
      this.clearCallback();
      this.update({ status: error === ERR_INVALID_AUTH || error === ERR_INVALID_AUTH_CALLBACK ? "auth-error" : "disconnected",
        error: error instanceof Error && error.message === "unsupported-version" ? "Home Assistant 2023.9 or newer is required." : error instanceof Error && error.message === "url-storage" ? "This browser cannot save the instance URL needed for the login callback. Enable local storage for this dashboard and connect again." : connectionError(error) });
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
      const entity = mapHome(this.snapshot.states, this.snapshot.registries, this.snapshot.url).entities.find(e => e.entityId === entityId);
      if (!entity) throw new Error("This entity no longer exists.");
      const command = entityCommand(entity, action, this.snapshot.services, value, code);
      setCommand({ pending: true });
      try {
        // Never suspend/queue/retry physical commands. The library rejects in-flight calls on loss.
        await bounded(callService(conn, command.domain, command.service, command.data, command.target));
      } catch (error) {
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
  calendarEvents = async (entityId: string, start: string, end: string, signal: AbortSignal): Promise<CalendarEvent[]> => {
    const auth = this.auth;
    const generation = this.generation;
    if (!auth || this.snapshot.status !== "connected" || !entityId.startsWith("calendar.")) throw new Error("Home Assistant calendars are offline.");
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) controller.abort();
    this.requests.add(controller);
    const timer = setTimeout(abort, 15000);
    try {
      if (auth.expired) await bounded(auth.refreshAccessToken());
      if (generation !== this.generation || controller.signal.aborted) throw new Error("Calendar request cancelled.");
      const query = new URLSearchParams({ start, end });
      const response = await fetch(`${this.snapshot.url}/api/calendars/${encodeURIComponent(entityId)}?${query}`, {
        headers: { Authorization: `Bearer ${auth.accessToken}` }, signal: controller.signal, credentials: "omit", redirect: "error",
      });
      if (response.status === 401) throw ERR_INVALID_AUTH;
      if (!response.ok) throw new Error("Calendar API unavailable. Check the integration, permissions and HA CORS configuration.");
      const events = calendarEventsSchema.parse(await response.json()) as CalendarEvent[];
      if (generation !== this.generation || controller.signal.aborted) throw new Error("Calendar request cancelled.");
      return events;
    } catch (error) {
      if (error === ERR_INVALID_AUTH && generation === this.generation) {
        this.auth = undefined; this.close(); this.update({ status: "auth-error", user: undefined, error: connectionError(error) });
      }
      // Do not expose API responses, which can contain sensitive details.
      throw new Error("Calendar events could not be read. Check the connection, calendar integration, permissions and CORS settings.");
    } finally { clearTimeout(timer); signal.removeEventListener("abort", abort); this.requests.delete(controller); }
  };
}
