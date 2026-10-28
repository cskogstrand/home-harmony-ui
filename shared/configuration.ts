import { z } from "zod";
import { notificationSettingsSchema } from "./notifications.ts";

export const MAX_CONFIG_BYTES = 2 * 1024 * 1024;
export function isPlannerDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
export const memberSchema = z.string().min(1).max(512);
export const memberColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const keySchema = memberSchema.refine(value => !["__proto__", "constructor", "prototype"].includes(value));
const dateSchema = z.string().refine(isPlannerDate);
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const eventSchema = z.object({
  id: memberSchema, title: z.string().trim().min(1).max(100), date: dateSchema,
  time: timeSchema, endTime: timeSchema.optional(), member: memberSchema,
  location: z.string().max(150), note: z.string().max(200),
}).strict().refine(event => !event.endTime || event.endTime > event.time);
export const itemSchema = z.object({
  id: memberSchema, text: z.string().trim().min(1).max(120),
  kind: z.enum(["daily", "shopping", "tasks"]), member: memberSchema,
  done: z.boolean(), completedOn: z.union([dateSchema, z.literal("")]).optional(),
}).strict();
export const calendarSettingsSchema = z.object({
  view: z.enum(["people", "week"]), startDay: z.enum(["today", "monday"]),
}).strict();
const imageUrl = z.string().max(4096).refine(value => {
  if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) return true;
  try { return ["http:", "https:"].includes(new URL(value).protocol); } catch { return false; }
});
const timetableRoleSchema = z.enum(["events", "message", "closures", "hours", "popupActivities", "popupMeetings", "popupHours", "popupClosures", "popupMessages"]);
const timetableWeekRoles = { popupActivities: "events", popupMeetings: "events", popupHours: "hours", popupClosures: "closures", popupMessages: "message" } as const;
const timetableRolesSchema = z.union([
  z.enum(["events", "message", "closures", "hours"]).transform(role => [role]),
  z.array(z.union([timetableRoleSchema, z.literal("popup")])).min(1).max(10).refine(roles => new Set(roles).size === roles.length),
]).transform((roles: (z.infer<typeof timetableRoleSchema> | "popup")[]) => {
  if (!roles.includes("popup")) return roles;
  const popupRole = roles.includes("closures") ? "popupClosures" : roles.includes("hours") ? "popupHours" : roles.includes("message") ? "popupMessages" : "popupActivities";
  return [...new Set([...roles.filter(role => role !== "popup"), popupRole])];
}).pipe(z.array(timetableRoleSchema));
export const timetableSettingsSchema = z.object({
  type: z.enum(["images", "calendar"]).default("images"),
  education: z.enum(["school", "kindergarten"]).default("school"),
  calendars: z.record(keySchema, timetableRolesSchema).default({}).transform(calendars => {
    const hasSections = Object.values(calendars).some(roles => roles.some(role => role in timetableWeekRoles));
    return Object.fromEntries(Object.entries(calendars).flatMap(([id, roles]) => {
      // School selections lead; older week-only configurations inherit matching sections.
      const sections = hasSections ? roles.filter((role): role is keyof typeof timetableWeekRoles => role in timetableWeekRoles)
        : roles.map(role => role === "events" ? "popupActivities" : role === "message" ? "popupMessages" : role === "closures" ? "popupClosures" : "popupHours");
      return sections.length ? [[id, [...new Set(sections.flatMap(role => [timetableWeekRoles[role], role]))]]] : [];
    }));
  }),
}).strict();
export type TimetableSettings = z.infer<typeof timetableSettingsSchema>;
export const cardDensitySchema = z.enum(["supercompact", "compact", "original"]);
export type CardDensity = z.infer<typeof cardDensitySchema>;
export const deviceCardSchema = z.object({
  id: memberSchema,
  type: z.enum(["light", "climate", "cover", "media_player", "lock", "vacuum", "switch", "fan", "humidifier", "water_heater", "alarm_control_panel", "siren", "valve", "camera", "remote", "image", "lawn_mower", "sensor", "air_quality", "binary_sensor", "weather", "event", "presence", "scene", "script", "automation", "timer", "counter", "number", "select", "text", "datetime", "button", "calendar", "todo", "update", "voice", "ai_task", "notify"]),
  title: z.string().trim().max(100).default(""),
  mainEntity: memberSchema,
  linkedEntities: z.array(memberSchema).max(100).default([]),
  group: z.string().trim().max(80).default(""),
  density: cardDensitySchema.default("supercompact"),
}).strict().refine(card => new Set([card.mainEntity, ...card.linkedEntities]).size === card.linkedEntities.length + 1, "Choose each entity only once per card.");
export type DeviceCardSettings = z.infer<typeof deviceCardSchema>;
export const smartHomeSchema = z.object({
  layout: z.array(deviceCardSchema).max(500).default([])
    .refine(cards => new Set(cards.map(card => card.id)).size === cards.length, "Card IDs must be unique."),
// Retired visibility fields are discarded; no old layout is inferred from discovery.
}).strip();
export const plannerSchema = z.object({
  notifications: notificationSettingsSchema.default({}),
  language: z.enum(["en", "nb"]).default("en"),
  timetables: z.record(keySchema, z.array(imageUrl).max(100)),
  timetableEnabled: z.record(keySchema, z.boolean()).default({}),
  timetableSettings: z.record(keySchema, timetableSettingsSchema).default({}),
  calendar: calendarSettingsSchema.default({ view: "week", startDay: "today" }),
  dashboard: z.object({
    morningSummary: z.boolean().default(true),
    wasteCollection: z.boolean().default(false),
    nextPlan: z.boolean().default(true),
    day: z.boolean().default(true),
    showTomorrow: z.boolean().default(false),
    week: z.boolean().default(true),
    daily: z.boolean().default(true),
    shopping: z.boolean().default(true),
    school: z.boolean().default(true),
    home: z.boolean().default(true),
  }).strict().default({}),
  homeEntities: z.array(memberSchema).optional(),
  smartHome: smartHomeSchema.default({}),
  memberOrder: z.array(memberSchema).default([]),
  memberColors: z.record(keySchema, memberColorSchema).default({}),
  hiddenMembers: z.array(memberSchema).default([]),
  appearance: z.object({
    theme: z.enum(["light", "dark"]),
    colorPalette: z.enum(["pearl", "sage", "sand", "dusk", "mist", "rose", "olive", "clay", "lavender", "seafoam", "honey", "slate"]).default("pearl"),
    compactMode: z.boolean(),
    darkTimetables: z.boolean().default(false),
  }).strict().default({ theme: "dark", colorPalette: "pearl", compactMode: false, darkTimetables: false }),
  selectedAlarm: z.union([memberSchema, z.literal("")]).default(""),
  weatherEntity: z.union([memberSchema, z.literal("")]).default(""),
  wasteCalendarEntity: z.union([memberSchema, z.literal("")]).default(""),
  wasteCollectionDays: z.number().int().min(0).max(90).default(7),
  weatherTemperatureEntity: z.union([memberSchema, z.literal("")]).default(""),
  weatherPlacement: z.object({ today: z.boolean().default(true), header: z.boolean().default(false) }).strict().default({}),
  calendarMembers: z.record(keySchema, memberSchema).default({}),
  todoLists: z.record(keySchema, z.object({ kind: z.enum(["daily", "shopping", "tasks", "homework"]), member: memberSchema }).strict()).default({}),
}).strict();
export type Planner = z.infer<typeof plannerSchema>;
export const instanceUrlSchema = z.string().max(2048).refine(value => {
  if (!value) return true;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password && url.origin === value;
  } catch { return false; }
});
export const configurationSchema = z.object({
  format: z.literal("home-harmony-config"), version: z.literal(3), settings: plannerSchema,
}).strict();
export type Configuration = z.infer<typeof configurationSchema>;
export const emptyPlanner = (): Planner => plannerSchema.parse({ timetables: {}, smartHome: { layout: [] } });
export const emptyConfiguration = (): Configuration => ({ format: "home-harmony-config", version: 3, settings: emptyPlanner() });
export const plannerSettings = (planner: unknown): Planner => plannerSchema.strip().parse(planner);
export function parseConfiguration(text: string): Configuration {
  if (new TextEncoder().encode(text).length > MAX_CONFIG_BYTES) throw new Error("The backup exceeds the 2 MB limit.");
  try { return configurationSchema.parse(JSON.parse(text)); }
  catch { throw new Error("This is not a valid Home Harmony settings backup (version 3)."); }
}
