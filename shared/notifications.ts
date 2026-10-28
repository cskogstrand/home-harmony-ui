import { z } from "zod";

const reference = z.string().min(1).max(512);
const field = z.string().trim().min(1).max(100).refine(value => !["__proto__", "constructor", "prototype"].includes(value));
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
  detailEntity: z.string().max(512).optional(),
  detailEntities: z.array(reference).max(100).refine(ids => new Set(ids).size === ids.length).optional(),
  cameraEntity: z.string().max(512).default(""),
  durationSeconds: z.number().int().min(10).max(3600).default(60),
  cooldownSeconds: z.number().int().min(0).max(3600).default(10),
}).strict().transform(({ detailEntity, detailEntities, ...rule }) => ({
  ...rule, detailEntities: detailEntities ?? (detailEntity ? [detailEntity] : []),
})).superRefine((rule, ctx) => {
  if (rule.kind === "ongoing" && rule.trigger.type !== "state") ctx.addIssue({ code: "custom", path: ["trigger"], message: "Ongoing tasks require a state condition." });
  if (rule.kind === "camera" && !rule.cameraEntity) ctx.addIssue({ code: "custom", path: ["cameraEntity"], message: "Choose a camera." });
  if (rule.trigger.type === "calendar" && rule.kind !== "current") ctx.addIssue({ code: "custom", path: ["kind"], message: "Calendar events use current notifications." });
  if (rule.trigger.type === "state" && ["gt", "lt"].includes(rule.trigger.operator) && !Number.isFinite(Number(rule.trigger.value))) ctx.addIssue({ code: "custom", path: ["trigger", "value"], message: "Enter a numeric threshold." });
});
export const notificationSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  presentation: z.enum(["banner", "section"]).default("section"),
  pages: z.enum(["today", "main"]).default("main"),
  rules: z.array(notificationRuleSchema).max(100).default([]).refine(rules => new Set(rules.map(rule => rule.id)).size === rules.length),
}).strict();
export type NotificationRule = z.infer<typeof notificationRuleSchema>;
export type NotificationTrigger = NotificationRule["trigger"];
