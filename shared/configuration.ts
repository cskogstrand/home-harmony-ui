import { z } from "zod";
import { settingsRecord } from "./settings-record.ts";
import { notificationSettingsSchema } from "./notifications.ts";
import { cameraSettingsSchema } from "./cameras.ts";

export const MAX_CONFIG_BYTES = 2 * 1024 * 1024;
export const defaultModalGlass = { modalTransparency: 70, modalBlur: 20, modalSaturation: 150, modalDimming: 20 };
export const artworkSchema = z.enum(["none", "fjord", "garden", "sunroom", "paper", "aurora", "harbor", "birch", "atlas", "pottery", "meadow", "weave"]);
export type Artwork = z.infer<typeof artworkSchema>;
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
  calendars: settingsRecord(keySchema, timetableRolesSchema).default({}).transform(calendars => {
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
  illustrated: z.boolean().optional(),
}).strict().refine(card => new Set([card.mainEntity, ...card.linkedEntities]).size === card.linkedEntities.length + 1, "Choose each entity only once per card.");
export type DeviceCardSettings = z.infer<typeof deviceCardSchema>;
export const smartHomeSchema = z.object({
  layout: z.array(deviceCardSchema).max(500).default([])
    .refine(cards => new Set(cards.map(card => card.id)).size === cards.length, "Card IDs must be unique."),
// Retired visibility fields are discarded; no old layout is inferred from discovery.
}).strip();
export const shoppingListIcons = [
  "basket", "groceries", "household", "hardware", "clothing", "pharmacy", "pets", "baby",
  "christmas", "gifts", "easter", "birthday", "party", "new-year", "constitution-day", "halloween", "valentine",
  "baking", "bakery", "vegetables", "seafood", "meat", "dairy", "coffee", "drinks", "sweets", "barbecue", "picnic",
  "garden", "plants", "flowers", "renovation", "furniture", "cleaning", "electronics", "moving", "car",
  "cabin", "camping", "travel", "hiking", "boating", "cycling", "winter-sports", "sports", "crafts", "sewing", "school", "gaming", "music",
] as const;
export const todoDisplaySchema = z.object({
  shoppingIcon: z.enum(shoppingListIcons).optional(),
  completed: z.enum(["inline", "under", "collapsed", "hide"]).default("collapsed"),
  sort: z.enum(["home-assistant", "alphabetical", "due-date"]).default("home-assistant"),
  showDetails: z.boolean().default(true),
  showDueDate: z.boolean().default(true),
  celebrate: z.boolean().default(false),
  celebrateFinal: z.boolean().default(false),
}).strict();
export type TodoDisplay = z.infer<typeof todoDisplaySchema>;
export const defaultTodoDisplay = todoDisplaySchema.parse({});
export const dashboardSections = ["morningSummary", "wasteCollection", "nextPlan", "day", "week", "daily", "shopping", "homework", "school", "home"] as const;
export type DashboardSection = typeof dashboardSections[number];
export const plannerArtworkSchema = z.enum([...dashboardSections, "calendar", "tasks"]);
export type PlannerArtwork = z.infer<typeof plannerArtworkSchema>;
const dashboardHomeworkSchema = z.object({
  period: z.enum(["through-today", "through-tomorrow", "today", "tomorrow", "all"]).default("through-today"),
  includeUndated: z.boolean().default(true),
  showCompleted: z.boolean().default(false),
  action: z.enum(["check", "lists", "school"]).default("check"),
}).strict();
export type DashboardHomeworkOptions = z.infer<typeof dashboardHomeworkSchema>;
const plannerObjectSchema = z.object({
  cameras: cameraSettingsSchema.prefault({}),
  notifications: notificationSettingsSchema.prefault({}),
  language: z.enum(["en", "nb"]).default("en"),
  timetables: settingsRecord(keySchema, z.array(imageUrl).max(100)),
  timetableEnabled: settingsRecord(keySchema, z.boolean()).default({}),
  timetableSettings: settingsRecord(keySchema, timetableSettingsSchema).default({}),
  calendar: calendarSettingsSchema.default({ view: "week", startDay: "today" }),
  dashboard: z.object({
    order: z.array(z.enum(dashboardSections)).max(dashboardSections.length).default([])
      .refine(order => new Set(order).size === order.length, "Dashboard sections must be unique.")
      .transform(order => [...order, ...dashboardSections.filter(section => !order.includes(section))]),
    morningSummary: z.boolean().default(true),
    hideMorningSummaryContent: z.boolean().default(false),
    daySummaryPlayback: z.boolean().default(false),
    wasteCollection: z.boolean().default(false),
    nextPlan: z.boolean().default(true),
    hideNextPlanDescription: z.boolean().default(false),
    nextPlanDays: z.union([z.literal("auto"), z.number().int().min(0).max(90)]).default("auto"),
    day: z.boolean().default(true),
    showTomorrow: z.boolean().default(false),
    week: z.boolean().default(true),
    daily: z.boolean().default(true),
    shopping: z.boolean().default(true),
    homework: z.boolean().default(false),
    homeworkOptions: dashboardHomeworkSchema.prefault({}),
    school: z.boolean().default(true),
    home: z.boolean().default(true),
  }).strict().prefault({}),
  homeEntities: z.array(memberSchema).optional(),
  homeEntityGroups: settingsRecord(keySchema, z.string().trim().max(80)).default({}),
  homeGroups: z.array(z.string().trim().min(1).max(80)).default([]),
  smartHome: smartHomeSchema.prefault({}),
  memberOrder: z.array(memberSchema).default([]),
  memberColors: settingsRecord(keySchema, memberColorSchema).default({}),
  hiddenMembers: z.array(memberSchema).default([]),
  appearance: z.object({
    theme: z.enum(["light", "dark"]),
    colorPalette: z.enum(["pearl", "sage", "sand", "dusk", "mist", "rose", "olive", "clay", "lavender", "seafoam", "honey", "slate"]).default("pearl"),
    artwork: artworkSchema.default("none"),
    plannerArtwork: settingsRecord(plannerArtworkSchema, z.boolean()).default({}),
    compactMode: z.boolean(),
    darkTimetables: z.boolean().default(false),
    modalTransparency: z.number().int().min(0).max(85).default(defaultModalGlass.modalTransparency),
    modalBlur: z.number().int().min(8).max(48).default(defaultModalGlass.modalBlur),
    modalSaturation: z.number().int().min(100).max(200).default(defaultModalGlass.modalSaturation),
    modalDimming: z.number().int().min(0).max(60).default(defaultModalGlass.modalDimming),
  }).strict().prefault({ theme: "dark", compactMode: false }),
  selectedAlarm: z.union([memberSchema, z.literal("")]).default(""),
  morningSummaryEntity: z.union([memberSchema, z.literal("")]).default("sensor.afterglow_morning_summary"),
  morningSummaryScript: z.union([memberSchema, z.literal("")]).default("script.morning_summary_voice"),
  morningSummaryPlaybackEntity: z.union([memberSchema, z.literal("")]).default(""),
  vehicles: z.array(z.object({ id: memberSchema, name: memberSchema, imageEntity: memberSchema.optional(), addressEntity: memberSchema.optional(), commandVehicleId: memberSchema.optional() }).strict()).max(100).default([])
    .refine(cars => new Set(cars.map(car => car.id)).size === cars.length, "Choose each vehicle only once."),
  weatherEntity: z.union([memberSchema, z.literal("")]).default(""),
  wasteCalendarEntity: z.union([memberSchema, z.literal("")]).default(""),
  wasteCollectionDays: z.number().int().min(0).max(90).default(7),
  weatherTemperatureEntity: z.union([memberSchema, z.literal("")]).default(""),
  weatherPlacement: z.object({ today: z.boolean().default(true), header: z.boolean().default(false) }).strict().prefault({}),
  calendarMembers: settingsRecord(keySchema, memberSchema).default({}),
  todoLists: settingsRecord(keySchema, z.object({ kind: z.enum(["daily", "shopping", "tasks", "homework"]), member: memberSchema, display: todoDisplaySchema.optional() }).strict()).default({}),
}).strict();
function preserveCameraNotifications(planner: z.infer<typeof plannerObjectSchema>): z.input<typeof plannerObjectSchema> {
  for (const rule of planner.notifications.rules) {
    if (rule.kind !== "camera" || !/^(home\|)?camera\.[a-z0-9_]+$/.test(rule.cameraEntity)) continue;
    const entity = rule.cameraEntity.replace(/^home\|/, "");
    const id = `legacy-${entity}`;
    if (rule.entityDisplay?.some(reading => reading.entity === rule.cameraEntity) && !rule.detailEntities.includes(rule.cameraEntity)) rule.detailEntities.push(rule.cameraEntity);
    rule.cameraEntity = id;
    if (!planner.cameras.items.some(camera => camera.id === id)) planner.cameras.items.push({ id, name: entity, connectionId: "home-assistant", source: entity, personSnapshot: { type: "none" } });
  }
  return planner;
}
export const plannerSchema = plannerObjectSchema.transform(preserveCameraNotifications).pipe(plannerObjectSchema);
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
export const plannerSettings = (planner: unknown): Planner => plannerObjectSchema.strip().transform(preserveCameraNotifications).pipe(plannerObjectSchema).parse(planner);
export function parseConfiguration(text: string): Configuration {
  if (new TextEncoder().encode(text).length > MAX_CONFIG_BYTES) throw new Error("The backup exceeds the 2 MB limit.");
  try { return configurationSchema.parse(JSON.parse(text)); }
  catch { throw new Error("This is not a valid Afterglow settings backup (version 3)."); }
}
