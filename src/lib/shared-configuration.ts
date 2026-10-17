import { z } from "zod";
import { configurationSchema, emptyConfiguration, parseConfiguration, type Configuration, type Planner } from "../../shared/configuration";

type Request = (method: "GET" | "PUT", body?: string, revision?: string) => Promise<Response>;
const responseSchema = z.object({ revision: z.string().regex(/^[a-f0-9]{64}$/), config: configurationSchema });
export class SharedConfiguration {
  private snapshot = { config: emptyConfiguration(), loaded: false, dirty: false, saving: false, error: "" };
  private listeners = new Set<() => void>();
  private revision = "";
  private reading = false;
  private reloading = false;
  private active = false;
  private generation = 0;
  private timer?: ReturnType<typeof setInterval>;
  private request: Request;
  constructor(request: Request) { this.request = request; }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.snapshot;
  private update(patch: Partial<typeof this.snapshot>) { this.snapshot = { ...this.snapshot, ...patch }; this.listeners.forEach(listener => listener()); }
  private async response(method: "GET" | "PUT", config?: Configuration) {
    const response = await this.request(method, config ? JSON.stringify(config) : undefined, this.revision);
    if (!response.ok) {
      if (response.status === 409) throw new Error("Another screen changed the configuration. Export your unsaved changes, then load the shared version before editing again.");
      if (response.status === 401) throw new Error("Dashboard access expired. Reload and enter the dashboard password.");
      throw new Error("Shared storage is unavailable. Check the dashboard server, then retry. Your unsaved changes are still on this screen.");
    }
    return responseSchema.parse(await response.json());
  }
  start = () => {
    this.active = true;
    void this.refresh();
    this.timer = setInterval(() => { if (!this.snapshot.dirty) void this.refresh(); }, 5000);
  };
  stop = () => { this.active = false; this.generation++; clearInterval(this.timer); this.reading = false; this.reloading = false; this.update({ saving: false }); };
  refresh = async (discard = false) => {
    if (discard && (!this.active || this.reading || this.snapshot.saving)) throw new Error("Wait for the current request to finish, then load the shared version again.");
    if (!this.active || this.reading || this.snapshot.saving || (this.snapshot.dirty && !discard)) return;
    const generation = this.generation;
    const before = this.snapshot.config;
    this.reading = true;
    this.reloading = discard;
    try {
      const result = await this.response("GET");
      if (generation !== this.generation || (!discard && (this.snapshot.dirty || this.snapshot.config !== before))) return;
      this.revision = result.revision;
      this.update({ config: result.config, loaded: true, dirty: false, error: "" });
    } catch (error) {
      if (generation === this.generation) this.update({ error: error instanceof Error ? error.message : "Cannot load shared configuration." });
      if (discard) throw error;
    } finally { if (generation === this.generation) { this.reading = false; this.reloading = false; } }
  };
  updateSettings = (change: (planner: Planner) => Planner) => {
    if (!this.active || this.reloading || !this.snapshot.loaded || this.snapshot.error) throw new Error("Shared settings are not ready. Open App preferences to reconnect or resolve unsaved changes.");
    const config = parseConfiguration(JSON.stringify({ ...this.snapshot.config, settings: change(this.snapshot.config.settings) }));
    this.update({ config, dirty: true });
    void this.save().catch(() => {});
  };
  replace = async (config: Configuration) => {
    if (!this.active || !this.snapshot.loaded || this.snapshot.saving || this.snapshot.dirty) throw new Error("Resolve unsaved changes before importing a backup.");
    this.update({ config: parseConfiguration(JSON.stringify(config)), dirty: true, error: "" });
    await this.save();
  };
  retry = async () => { if (this.snapshot.dirty) await this.save(); else await this.refresh(); };
  private save = async () => {
    if (!this.active || this.snapshot.saving) return;
    const generation = this.generation;
    this.update({ saving: true, error: "" });
    try {
      while (this.snapshot.dirty && this.active && generation === this.generation) {
        const config = this.snapshot.config;
        const result = await this.response("PUT", config);
        if (generation !== this.generation) return;
        this.revision = result.revision;
        if (config === this.snapshot.config) this.update({ config: result.config, dirty: false });
      }
    } catch (error) {
      if (generation === this.generation) this.update({ error: error instanceof Error ? error.message : "Configuration was not saved." });
      throw error;
    } finally { if (generation === this.generation) this.update({ saving: false }); }
  };
}
