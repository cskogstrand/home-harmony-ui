import { z } from "zod";

const name = z.string().trim().regex(/^[a-zA-Z0-9_-][a-zA-Z0-9_.-]{0,127}$/);
const id = name.refine(value => !["__proto__", "constructor", "prototype", "home-assistant"].includes(value));
const serverUrl = z.string().trim().min(1).max(2048).refine(value => {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password && !url.search && !url.hash && !value.includes("\\");
  } catch { return false; }
}, "Use an HTTP or HTTPS server URL without credentials, query or fragment.").transform(value => value.replace(/\/+$/, ""));

export function go2rtcLink(value: string): { serverUrl: string; stream: string } | undefined {
  try {
    const url = new URL(value.trim());
    const stream = url.searchParams.get("src");
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.hash || value.includes("\\")
      || !/\/(stream|webrtc)\.html$/.test(url.pathname) || url.searchParams.getAll("src").length !== 1 || !name.safeParse(stream).success
      || [...url.searchParams.keys()].some(key => !["src", "media", "mode", "width"].includes(key))) return;
    return { serverUrl: `${url.origin}${url.pathname.replace(/\/(stream|webrtc)\.html$/, "")}`, stream };
  } catch { return; }
}

export function go2rtcStreamName(value: string): string {
  const link = go2rtcLink(value);
  if (link) return link.stream;
  if (!/^rtsps?:\/\//i.test(value)) return value;
  try {
    const url = new URL(value);
    if (url.username || url.password || url.search || url.hash) return value;
    return url.pathname.length > 1 ? decodeURIComponent(url.pathname.slice(1)) : value;
  } catch { return value; }
}
const imageEntity = z.string().regex(/^(image|camera|sensor|binary_sensor)\.[a-z0-9_]+$/);
const connectionSchema = z.object({
  id, name: z.string().trim().min(1).max(100), type: z.enum(["go2rtc", "frigate"]), url: z.string().trim().max(2048),
}).strict();
export const cameraConnectionSchema = connectionSchema.transform(connection => ({ ...connection,
  url: connection.type === "go2rtc" ? go2rtcLink(connection.url)?.serverUrl ?? connection.url : connection.url,
})).pipe(connectionSchema.extend({ url: serverUrl }));

export function go2rtcPlayerUrl(connection: CameraConnection | undefined, source: string): string | undefined {
  const stream = go2rtcStreamName(source.trim());
  if (connection?.type === "go2rtc" && name.safeParse(stream).success) return `${connection.url}/stream.html?${new URLSearchParams({ src: stream })}`;
}

export const go2rtcErrors = {
  unreachable: "Home Harmony could not reach go2rtc. Check the connection address.",
  rejected: "go2rtc could not open this stream. Check the stream name and camera.",
  invalid: "The server did not return a WebRTC answer. Check the go2rtc address.",
  connection: "WebRTC could not connect. Check go2rtc's WebRTC port and network settings.",
  unsupported: "This browser does not support WebRTC.",
  playback: "The browser could not play this stream. Check its video codec.",
  signaling: "Could not contact Home Harmony. Check your connection and sign-in.",
} as const;
export const configuredCameraSchema = z.object({
  id, name: z.string().trim().min(1).max(100), connectionId: z.string().min(1).max(128),
  source: z.string().trim().max(2048).transform(go2rtcStreamName).pipe(name),
  frigatePreview: z.object({ connectionId: id, camera: name }).strict().optional(),
  personPipSize: z.enum(["small", "medium", "large", "xlarge"]).optional(),
  personSnapshot: z.discriminatedUnion("type", [
    z.object({ type: z.literal("none") }).strict(),
    z.object({ type: z.literal("home-assistant"), entity: imageEntity }).strict(),
    z.object({ type: z.literal("frigate"), connectionId: id, camera: name }).strict(),
  ]).default({ type: "none" }),
}).strict();
const settingsSchema = z.object({
  connections: z.array(cameraConnectionSchema).max(100).default([]),
  items: z.array(configuredCameraSchema).max(200).default([]),
}).strict().superRefine((settings, ctx) => {
  for (const key of ["connections", "items"] as const) {
    if (new Set(settings[key].map(item => item.id)).size !== settings[key].length) ctx.addIssue({ code: "custom", path: [key], message: "IDs must be unique." });
  }
  settings.items.forEach((camera, index) => {
    const connection = settings.connections.find(item => item.id === camera.connectionId);
    if (camera.connectionId === "home-assistant" ? !/^camera\.[a-z0-9_]+$/.test(camera.source) : connection?.type !== "go2rtc")
      ctx.addIssue({ code: "custom", path: ["items", index, "connectionId"], message: "Choose Home Assistant or a saved go2rtc connection and its camera source." });
    if (camera.frigatePreview && !settings.connections.some(item => item.id === camera.frigatePreview.connectionId && item.type === "frigate"))
      ctx.addIssue({ code: "custom", path: ["items", index, "frigatePreview"], message: "Choose a saved Frigate connection for the preview." });
    const snapshot = camera.personSnapshot;
    if (snapshot.type === "frigate" && !settings.connections.some(item => item.id === snapshot.connectionId && item.type === "frigate"))
      ctx.addIssue({ code: "custom", path: ["items", index, "personSnapshot"], message: "Choose a saved Frigate connection for person snapshots." });
  });
});
const legacySchema = z.object({
  go2rtcUrl: z.union([z.literal(""), serverUrl]).default(""), frigateUrl: z.union([z.literal(""), serverUrl]).default(""),
  sources: z.record(z.string().regex(/^camera\.[a-z0-9_]+$/), z.object({
    stream: z.string().trim().transform(go2rtcStreamName).pipe(z.union([z.literal(""), name])).default(""),
    personSnapshot: z.discriminatedUnion("type", [
      z.object({ type: z.literal("none") }).strict(),
      z.object({ type: z.literal("home-assistant"), entity: imageEntity }).strict(),
      z.object({ type: z.literal("frigate"), camera: name }).strict(),
    ]).default({ type: "none" }),
  }).strict()).refine(sources => Object.keys(sources).length <= 100).default({}),
}).strict().transform(legacy => ({
  connections: [
    ...(legacy.go2rtcUrl ? [{ id: "legacy-go2rtc", name: "go2rtc", type: "go2rtc" as const, url: legacy.go2rtcUrl }] : []),
    ...(legacy.frigateUrl ? [{ id: "legacy-frigate", name: "Frigate", type: "frigate" as const, url: legacy.frigateUrl }] : []),
  ],
  items: Object.entries(legacy.sources).map(([entity, source]) => ({
    id: `legacy-${entity}`, name: entity, connectionId: source.stream ? "legacy-go2rtc" : "home-assistant", source: source.stream || entity,
    personSnapshot: source.personSnapshot.type === "frigate" ? { ...source.personSnapshot, connectionId: "legacy-frigate" } : source.personSnapshot,
  })),
}));
export const cameraSettingsSchema = z.union([settingsSchema, legacySchema.pipe(settingsSchema)]);
export type CameraSettings = z.infer<typeof cameraSettingsSchema>;
export type CameraConnection = z.infer<typeof cameraConnectionSchema>;
export type ConfiguredCamera = z.infer<typeof configuredCameraSchema>;
// Notifications reference only explicitly configured cameras.
export const configuredCamera = (settings: CameraSettings | undefined, reference: string) => settings?.items.find(camera => camera.id === reference);

// Sensor pictures may refer only to HA's authenticated image endpoints, never arbitrary URLs.
export function homeAssistantPicturePath(value: unknown): string | undefined {
  if (typeof value !== "string") return;
  const path = value.split("?")[0];
  if (/^\/api\/(image_proxy\/image|camera_proxy\/camera)\.[a-z0-9_]+$/.test(path)) return path;
}
