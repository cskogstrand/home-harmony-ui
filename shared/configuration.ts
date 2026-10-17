import { z } from "zod";

export const MAX_CONFIG_BYTES = 2 * 1024 * 1024;
export function isPlannerDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
export const memberSchema = z.string().min(1).max(512);
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
export const plannerSchema = z.object({
  events: z.array(eventSchema).max(10000).refine(items => new Set(items.map(item => item.id)).size === items.length),
  items: z.array(itemSchema).max(10000).refine(items => new Set(items.map(item => item.id)).size === items.length),
  timetables: z.record(keySchema, z.array(imageUrl).max(100)),
  timetableEnabled: z.record(keySchema, z.boolean()).default({}),
  calendar: calendarSettingsSchema.default({ view: "week", startDay: "today" }),
  homeEntities: z.record(keySchema, z.array(memberSchema)).default({}),
  memberOrder: z.array(memberSchema).default([]),
  calendarMembers: z.record(keySchema, memberSchema).default({}),
  todoLists: z.record(keySchema, z.object({ kind: z.enum(["daily", "shopping", "tasks"]), member: memberSchema }).strict()).default({}),
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
  format: z.literal("home-harmony-config"), version: z.literal(1),
  planners: z.record(keySchema, z.object({ instanceUrl: instanceUrlSchema, planner: plannerSchema }).strict()),
}).strict();
export type Configuration = z.infer<typeof configurationSchema>;
export const emptyConfiguration = (): Configuration => ({ format: "home-harmony-config", version: 1, planners: {} });
export const emptyPlanner = (): Planner => plannerSchema.parse({ events: [], items: [], timetables: {} });
export function parseConfiguration(text: string): Configuration {
  if (new TextEncoder().encode(text).length > MAX_CONFIG_BYTES) throw new Error("The backup exceeds the 2 MB limit.");
  try { return configurationSchema.parse(JSON.parse(text)); }
  catch { throw new Error("This is not a valid Home Harmony configuration backup (version 1)."); }
}

// Only reference fields are remapped; text and timetable URLs must stay exactly as saved.
export function remapPlanner(planner: Planner, from: string, to: string): Planner {
  if (!from || from === to) return planner;
  const reference = (value: string) => value.startsWith(`${from}|`) ? `${to}${value.slice(from.length)}` : value;
  const keys = <T>(values: Record<string, T>, map: (value: T) => T = value => value) => Object.fromEntries(Object.entries(values).map(([key, value]) => [reference(key), map(value)]));
  return { ...planner,
    events: planner.events.map(event => ({ ...event, member: reference(event.member) })),
    items: planner.items.map(item => ({ ...item, member: reference(item.member) })),
    timetables: keys(planner.timetables), timetableEnabled: keys(planner.timetableEnabled),
    memberOrder: planner.memberOrder.map(reference), calendarMembers: keys(planner.calendarMembers, reference),
    todoLists: keys(planner.todoLists, value => ({ ...value, member: reference(value.member) })),
    homeEntities: Object.fromEntries(Object.entries(planner.homeEntities).map(([instance, values]) => [instance === from ? to : instance, values.map(reference)])),
  };
}
