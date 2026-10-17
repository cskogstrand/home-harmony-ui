import { z } from "zod";
import { atLeastHaVersion } from "home-assistant-js-websocket/dist/util.js";
import {
  getAuth, createConnection, subscribeEntities, getConfig, getServices, getUser, callService,
  ERR_INVALID_AUTH, ERR_INVALID_AUTH_CALLBACK, ERR_INVALID_HTTPS_TO_HTTP, ERR_CONNECTION_LOST,
  Auth, type AuthData, type Connection, type HassConfig, type HassServices, type HassUser,
} from "home-assistant-js-websocket";
import type { CalendarEvent, EntityAction, EntityStates, Registries, TodoItem } from "@/types/api";
import { available, emptyRegistries, entityCommand, mapHome, normalizeHaUrl } from "./ha-model";

export type ConnectionStatus = "disconnected" | "connecting" | "syncing" | "connected" | "reconnecting" | "auth-error";
interface Snapshot {
  url: string;
  status: ConnectionStatus;
  error: string;
  warnings: string[];
  sessionWarning: string;
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
const URL_KEY = "home-harmony:ha-url";
const TOKEN_KEY = "home-harmony:ha-session";
const AUTH_REVISION_KEY = "home-harmony:ha-auth-revision";
const PAUSED_KEY = "home-harmony:ha-paused";
const authDataSchema = z.object({
  hassUrl: z.string(), clientId: z.string(),
  access_token: z.string().min(1), refresh_token: z.string().min(1),
  expires: z.number().finite().nonnegative(), expires_in: z.number().finite().positive(),
});
const savedAuthSchema = authDataSchema.extend({ storageRevision: z.string().nullable() });
const NO_SAVED_SESSION = new Error("No saved session");
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
  private authVersion = 0;
  private storageRevision: string | null = null;
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
    try { this.storageRevision = localStorage.getItem(AUTH_REVISION_KEY); } catch { /* Storage failures are reported on connect. */ }
    this.snapshot = { url, status: "disconnected", error: "", warnings: [], sessionWarning: "", states: {}, registries: emptyRegistries, services: {}, commands: {} };
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
  private readTokens(url: string): AuthData | null {
    try {
      const raw = localStorage.getItem(TOKEN_KEY);
      if (!raw) return null;
      const data = savedAuthSchema.parse(JSON.parse(raw));
      if (data.storageRevision !== localStorage.getItem(AUTH_REVISION_KEY)) throw NO_SAVED_SESSION;
      if (data.hassUrl !== url || data.clientId !== `${window.location.origin}/`) throw NO_SAVED_SESSION;
      return data as AuthData;
    } catch {
      this.saveTokens(null);
      this.update({ sessionWarning: "The saved browser login could not be read or did not match this instance. Connect again to sign in." });
      return null;
    }
  }
  private saveTokens(data: AuthData | null, revision = this.storageRevision) {
    // ponytail: persistent browser storage is JS-readable; isolating tokens requires a backend.
    try {
      // Check before writing, even if another tab's storage event has not arrived yet.
      if (localStorage.getItem(AUTH_REVISION_KEY) !== revision) return;
      if (data) {
        const parsed = authDataSchema.parse(data);
        if (parsed.hassUrl !== this.snapshot.url || parsed.clientId !== `${window.location.origin}/`) throw NO_SAVED_SESSION;
        localStorage.setItem(TOKEN_KEY, JSON.stringify({ ...parsed, storageRevision: revision }));
      } else localStorage.removeItem(TOKEN_KEY);
      this.update({ sessionWarning: "" });
    } catch {
      try { localStorage.removeItem(TOKEN_KEY); } catch { /* Report failure without exposing credentials. */ }
      this.update({ sessionWarning: "This browser could not update the saved login. Reopening or refreshing may require signing in again. If logging out, also clear this site's browser data." });
    }
  }
  private forgetAuth(clearSaved = true) {
    this.authVersion++;
    this.auth = undefined;
    this.authPromise = undefined;
    if (clearSaved) {
      // A non-secret revision also prevents a delayed write from becoming valid after logout.
      try {
        // An old tab's auth failure must not clear a newer browser login.
        if (localStorage.getItem(AUTH_REVISION_KEY) !== this.storageRevision) return;
        this.storageRevision = crypto.getRandomValues(new Uint32Array(4)).join("-");
        localStorage.setItem(AUTH_REVISION_KEY, this.storageRevision);
      }
      catch {
        try { localStorage.removeItem(TOKEN_KEY); } catch { /* Report blocked cleanup below. */ }
        this.update({ sessionWarning: "The browser could not synchronize logout. Clear this site's browser data if the saved login cannot be removed." });
      }
      this.saveTokens(null);
    }
  }
  private storageChanged = (event: StorageEvent) => {
    if (event.storageArea !== localStorage || ![null, TOKEN_KEY, AUTH_REVISION_KEY, URL_KEY].includes(event.key)) return;
    try {
      const revision = localStorage.getItem(AUTH_REVISION_KEY);
      const saved = localStorage.getItem(TOKEN_KEY);
      if (revision === this.storageRevision && saved && localStorage.getItem(URL_KEY) === this.snapshot.url
        && (!this.auth || JSON.parse(saved).refresh_token === this.auth.data.refresh_token)) return;
      this.forgetAuth(false);
      this.storageRevision = revision;
      this.close();
      this.update({ status: "disconnected", error: "The Home Assistant login changed in another tab. Connect to use the saved browser login.",
        states: {}, registries: emptyRegistries, config: undefined, user: undefined, services: {}, commands: {}, warnings: [] });
    } catch { /* A storage failure is reported when reconnecting. */ }
  };
  private setPaused(paused: boolean) {
    try { if (paused) sessionStorage.setItem(PAUSED_KEY, "true"); else sessionStorage.removeItem(PAUSED_KEY); }
    catch { this.update({ sessionWarning: "This browser cannot remember Connect/Disconnect across refreshes. Allow session storage for this dashboard." }); }
  }
  start = () => {
    window.addEventListener("storage", this.storageChanged);
    // Retire the earlier tab-only token store; sign in once to establish the browser login.
    try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* No fallback to tab-only credentials. */ }
    if (this.authPromise && this.snapshot.status === "connecting") { void this.connect(this.snapshot.url); return; }
    const callback = new URLSearchParams(window.location.search).has("auth_callback");
    if (!callback) {
      try { if (sessionStorage.getItem(PAUSED_KEY) === "true") return; }
      catch {
        this.update({ sessionWarning: "This browser cannot read the reconnect preference. Allow session storage to reconnect after refresh." });
        return;
      }
      if (!this.snapshot.url || !this.readTokens(this.snapshot.url)) return;
    }
    if (!this.snapshot.url) {
      this.clearCallback();
      this.update({ status: "auth-error", error: "The selected instance is missing. Enter its URL in Home settings and connect again." });
      return;
    }
    void this.connect(this.snapshot.url, !callback);
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
  dispose = () => { this.close(); window.removeEventListener("storage", this.storageChanged); };
  disconnect = () => {
    this.close();
    // Cancel a pending login's storage callback without discarding an established session.
    if (!this.auth) { this.authVersion++; this.authPromise = undefined; }
    this.setPaused(true);
    this.update({ status: "disconnected", error: "", commands: {} });
  };
  logout = async () => {
    const saved = this.auth ? null : this.readTokens(this.snapshot.url);
    const auth = this.auth ?? (saved ? new Auth(saved) : undefined);
    this.forgetAuth();
    this.disconnect();
    const generation = this.generation;
    this.update({ states: {}, registries: emptyRegistries, config: undefined, user: undefined, services: {}, warnings: [] });
    if (auth) {
      try { await bounded(auth.revoke()); }
      catch { if (generation === this.generation) this.update({ error: "Signed out locally, but server token revocation could not be confirmed. Remove this session in your Home Assistant profile when reachable." }); }
    }
  };
  connect = async (input: string, restoreOnly = false) => {
    let url: string;
    try { url = normalizeHaUrl(input); }
    catch (error) { this.update({ error: error instanceof TypeError ? "Enter a valid HTTP or HTTPS Home Assistant URL." : (error as Error).message }); return; }
    this.close();
    const generation = this.generation;
    if (url !== this.snapshot.url) {
      this.forgetAuth();
      this.update({ states: {}, registries: emptyRegistries, config: undefined, user: undefined, services: {} });
    }
    this.update({ url, status: "connecting", error: "", warnings: [], commands: {} });
    const current = () => generation === this.generation;
    try {
      window.addEventListener("storage", this.storageChanged);
      const revision = localStorage.getItem(AUTH_REVISION_KEY);
      if (revision !== this.storageRevision) { this.forgetAuth(false); this.storageRevision = revision; }
      try { localStorage.setItem(URL_KEY, url); } catch { throw new Error("url-storage"); }
      this.setPaused(false);
      if (!this.auth) {
        if (!this.authPromise && new URLSearchParams(window.location.search).has("auth_callback")) this.forgetAuth();
        const version = this.authVersion;
        const revision = this.storageRevision;
        this.authPromise ??= getAuth({
          hassUrl: url, clientId: `${window.location.origin}/`, redirectUrl: `${window.location.origin}/settings`, limitHassInstance: true,
          loadTokens: async () => {
            const data = this.readTokens(url);
            // A refresh with missing/corrupt credentials must not navigate away from the planner.
            if (restoreOnly && !data) throw NO_SAVED_SESSION;
            return data;
          },
          saveTokens: data => { if (version === this.authVersion) this.saveTokens(data, revision); },
        });
        this.clearCallback();
        const auth = await bounded(this.authPromise);
        if (!current() || localStorage.getItem(AUTH_REVISION_KEY) !== revision) return;
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
        this.forgetAuth();
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
      if (error === ERR_INVALID_AUTH || error === ERR_INVALID_AUTH_CALLBACK) this.forgetAuth();
      else if (!this.auth) this.authVersion++; // Ignore late saves from a timed-out login.
      this.close();
      this.clearCallback();
      this.update({ status: error === ERR_INVALID_AUTH || error === ERR_INVALID_AUTH_CALLBACK ? "auth-error" : "disconnected",
        error: error === NO_SAVED_SESSION ? "" : error instanceof Error && error.message === "unsupported-version" ? "Home Assistant 2023.9 or newer is required." : error instanceof Error && error.message === "url-storage" ? "This browser cannot save the instance URL needed for the login callback. Enable local storage for this dashboard and connect again." : connectionError(error) });
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
      const entity = mapHome(this.snapshot.states, this.snapshot.registries, this.snapshot.url).entities.find(e => e.entityId === entityId);
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
    const auth = this.auth;
    const generation = this.generation;
    if (!auth || this.snapshot.status !== "connected") throw new Error("Connect to Home Assistant to use shared storage.");
    const controller = new AbortController();
    this.requests.add(controller);
    const timer = setTimeout(() => controller.abort(), options.method === "POST" ? 45000 : 15000);
    try {
      if (auth.expired) await bounded(auth.refreshAccessToken());
      if (generation !== this.generation || controller.signal.aborted) throw new Error();
      const response = await fetch(path, { ...options, credentials: "omit", redirect: "error", signal: controller.signal,
        headers: { ...Object.fromEntries(new Headers(options.headers)), Authorization: `Bearer ${auth.accessToken}` } });
      // Consume the response before removing its cancellation guard.
      const contents = await response.arrayBuffer();
      if (generation !== this.generation || controller.signal.aborted) throw new Error();
      return new Response(contents, { status: response.status, headers: response.headers });
    } catch { throw new Error("Shared storage could not be reached. A save may have completed; check the dashboard before retrying. Your unsaved settings are still on this screen."); }
    finally { clearTimeout(timer); this.requests.delete(controller); }
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
        this.forgetAuth(); this.close(); this.update({ status: "auth-error", user: undefined, error: connectionError(error) });
      }
      // Do not expose API responses, which can contain sensitive details.
      throw new Error("Calendar events could not be read. Check the connection, calendar integration, permissions and CORS settings.");
    } finally { clearTimeout(timer); signal.removeEventListener("abort", abort); this.requests.delete(controller); }
  };
}
