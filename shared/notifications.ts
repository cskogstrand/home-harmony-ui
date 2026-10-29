import { z } from "zod";

const reference = z.string().min(1).max(512);
const field = z.string().trim().min(1).max(100).refine(value => !["__proto__", "constructor", "prototype"].includes(value));
const progressEntitySchema = z.object({ type: z.literal("entity"), entity: reference, attribute: z.string().trim().max(100).default("") }).strict();
const progressBoundSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("value"), value: z.number().finite() }).strict(), progressEntitySchema,
]);
const notificationProgressSchema = z.object({
  current: progressEntitySchema, start: progressBoundSchema, end: progressBoundSchema,
  text: z.enum(["percentage", "none"]).optional(),
}).strict().superRefine(({ start, end }, ctx) => {
  if ((start.type === "value" && end.type === "value" && start.value === end.value) ||
    (start.type === "entity" && end.type === "entity" && start.entity === end.entity && start.attribute === end.attribute)) {
    ctx.addIssue({ code: "custom", path: ["end"], message: "Progress start and end must be different." });
  }
});
export const notificationIcons = [
  "default", "washing", "dishes", "cleaning", "cooking", "charging", "timer",
  "vacuum", "lawn_mower", "dryer", "oven", "refrigerator", "freezer",
  "light", "climate", "cover", "media_player", "lock", "switch", "fan", "humidifier", "water_heater",
  "alarm_control_panel", "siren", "valve", "camera", "remote", "image", "sensor", "air_quality", "binary_sensor",
  "weather", "event", "presence", "scene", "script", "automation", "counter", "number", "select", "text",
  "datetime", "button", "calendar", "todo", "update", "voice", "ai_task", "notify",
  "air_purifier", "dehumidifier", "heat_pump", "radiator", "air_conditioner", "sprinkler", "ev_charger", "solar",
  "blind", "curtain", "awning", "damper", "door", "garage", "gate", "shade", "shutter", "window",
  "temperature", "humidity", "battery", "power", "energy", "water", "moisture", "smoke", "carbon_monoxide",
  "gas", "motion", "occupancy", "connectivity", "vibration", "problem", "tamper", "sound", "illuminance",
  "tv", "speaker", "router", "doorbell",
] as const;
const notificationPresentationSchema = z.enum(["banner", "section", "activity", "activity-compact"]);
export type NotificationPresentation = z.infer<typeof notificationPresentationSchema>;
export type NotificationProgress = z.infer<typeof notificationProgressSchema>;
export type NotificationProgressSource = NotificationProgress["start"];
const notificationEntityDisplaySchema = z.object({
  entity: reference, attribute: z.string().trim().max(100).default(""),
  name: z.string().trim().max(100).default(""),
  hideName: z.boolean().optional(),
  placement: z.enum(["auto", "subtitle", "left", "right", "footer", "hidden"]).default("auto"),
}).strict();
export type NotificationEntityDisplay = z.infer<typeof notificationEntityDisplaySchema>;
export const notificationTriggerSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("state"), entity: reference, attribute: z.string().max(100).default(""),
    operator: z.enum(["eq", "neq", "gt", "lt"]), value: z.string().trim().min(1).max(256) }).strict(),
  z.object({ type: z.literal("entity-event"), entity: reference, eventType: z.string().trim().max(100).default("") }).strict(),
  z.object({ type: z.literal("ha-event"), eventType: z.string().trim().regex(/^[a-zA-Z0-9_]+$/).max(100),
    filters: z.record(field, z.union([z.string().max(512), z.number().finite(), z.boolean()])).refine(value => Object.keys(value).length <= 10).default({}) }).strict(),
  z.object({ type: z.literal("calendar"), entity: reference, leadMinutes: z.number().int().min(0).max(1440).default(0) }).strict(),
]);
export const notificationRuleSchema = z.object({
  id: reference, title: z.string().trim().min(1).max(100), message: z.string().trim().max(300).default(""),
  enabled: z.boolean().default(true), kind: z.enum(["ongoing", "current", "camera"]), trigger: notificationTriggerSchema,
  pages: z.enum(["today", "main"]).optional(),
  presentation: notificationPresentationSchema.optional(),
  detailEntity: z.string().max(512).optional(),
  detailEntities: z.array(reference).max(100).refine(ids => new Set(ids).size === ids.length).optional(),
  entityDisplay: z.array(notificationEntityDisplaySchema).max(105)
    .refine(items => new Set(items.map(item => JSON.stringify([item.entity, item.attribute]))).size === items.length).optional(),
  progress: notificationProgressSchema.optional(),
  icon: z.enum(notificationIcons).optional(),
  animateIcon: z.boolean().optional(),
  cameraEntity: z.string().max(512).default(""),
  durationSeconds: z.number().int().min(10).max(3600).default(60),
  cooldownSeconds: z.number().int().min(0).max(3600).default(10),
}).strict().transform(({ detailEntity, detailEntities, ...rule }) => ({
  ...rule, detailEntities: detailEntities ?? (detailEntity ? [detailEntity] : []),
})).superRefine((rule, ctx) => {
  if (rule.kind === "ongoing" && rule.trigger.type !== "state") ctx.addIssue({ code: "custom", path: ["trigger"], message: "Ongoing tasks require a state condition." });
  if (rule.progress && rule.kind !== "ongoing") ctx.addIssue({ code: "custom", path: ["progress"], message: "Progress is only available for ongoing tasks." });
  if (rule.kind === "camera" && !rule.cameraEntity) ctx.addIssue({ code: "custom", path: ["cameraEntity"], message: "Choose a camera." });
  if (rule.trigger.type === "calendar" && rule.kind !== "current") ctx.addIssue({ code: "custom", path: ["kind"], message: "Calendar events use current notifications." });
  if (rule.trigger.type === "state" && ["gt", "lt"].includes(rule.trigger.operator) && !Number.isFinite(Number(rule.trigger.value))) ctx.addIssue({ code: "custom", path: ["trigger", "value"], message: "Enter a numeric threshold." });
});
export const notificationSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  presentation: notificationPresentationSchema.default("section"),
  // Keep the previous global choice for rules without their own page setting.
  pages: z.enum(["today", "main"]).default("main"),
  rules: z.array(notificationRuleSchema).max(100).default([]).refine(rules => new Set(rules.map(rule => rule.id)).size === rules.length),
}).strict();
export type NotificationRule = z.infer<typeof notificationRuleSchema>;
export type NotificationTrigger = NotificationRule["trigger"];
