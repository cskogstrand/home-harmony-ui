import { z } from "zod";

const name = z.string().trim().regex(/^[a-zA-Z0-9_-][a-zA-Z0-9_.-]{0,127}$/);
const serverUrl = z.string().trim().max(2048).refine(value => {
  if (!value) return true;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password && !url.search && !url.hash && !value.includes("\\");
  } catch { return false; }
}, "Use an HTTP or HTTPS server URL without credentials, query or fragment.").transform(value => value.replace(/\/+$/, ""));

export function go2rtcStreamName(value: string): string {
  if (!/^rtsps?:\/\//i.test(value)) return value;
  try {
    const url = new URL(value);
    if (url.username || url.password || url.search || url.hash) return value;
    return url.pathname.length > 1 ? decodeURIComponent(url.pathname.slice(1)) : value;
  } catch { return value; }
}

export const cameraSourceSchema = z.object({
  stream: z.string().trim().transform(go2rtcStreamName).pipe(z.union([z.literal(""), name])).default(""),
  personSnapshot: z.discriminatedUnion("type", [
    z.object({ type: z.literal("none") }).strict(),
    z.object({ type: z.literal("home-assistant"), entity: z.string().regex(/^(image|camera|sensor|binary_sensor)\.[a-z0-9_]+$/) }).strict(),
    z.object({ type: z.literal("frigate"), camera: name }).strict(),
  ]).default({ type: "none" }),
}).strict();
export const cameraSettingsSchema = z.object({
  go2rtcUrl: serverUrl.default(""),
  frigateUrl: serverUrl.default(""),
  sources: z.record(z.string().regex(/^camera\.[a-z0-9_]+$/), cameraSourceSchema).default({})
    .refine(sources => Object.keys(sources).length <= 100, "Choose up to 100 cameras."),
}).strict().superRefine((settings, ctx) => {
  if (Object.values(settings.sources).some(source => source.stream) && !settings.go2rtcUrl)
    ctx.addIssue({ code: "custom", path: ["go2rtcUrl"], message: "Enter the go2rtc HTTP server URL." });
  if (Object.values(settings.sources).some(source => source.personSnapshot.type === "frigate") && !settings.frigateUrl)
    ctx.addIssue({ code: "custom", path: ["frigateUrl"], message: "Enter the Frigate HTTP server URL." });
});
export type CameraSettings = z.infer<typeof cameraSettingsSchema>;
export type CameraSource = z.infer<typeof cameraSourceSchema>;

// Sensor pictures may refer only to HA's authenticated image endpoints, never arbitrary URLs.
export function homeAssistantPicturePath(value: unknown): string | undefined {
  if (typeof value !== "string") return;
  const path = value.split("?")[0];
  if (/^\/api\/(image_proxy\/image|camera_proxy\/camera)\.[a-z0-9_]+$/.test(path)) return path;
}
