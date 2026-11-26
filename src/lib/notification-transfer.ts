import type { ZodIssue } from "zod";
import { nb } from "@/locales/nb";
import { msg, type Message } from "@/lib/i18n";
import { MAX_CONFIG_BYTES } from "../../shared/configuration";
import { notificationRuleSchema, notificationTriggers, widgetLineFields, type NotificationRule } from "../../shared/notifications";

/** The file format that copies notification rules between installations. Bump the version only for incompatible changes. */
export const NOTIFICATION_RULES_TYPE = "afterglow.notification-rules";
export const NOTIFICATION_RULES_VERSION = 1;
export const MAX_NOTIFICATION_RULES = 100;
const envelopeKeys = ["type", "version", "app", "rules"];

export interface NotificationRulesFile {
  type: typeof NOTIFICATION_RULES_TYPE;
  version: typeof NOTIFICATION_RULES_VERSION;
  /** The Afterglow version that wrote the file. */
  app: string;
  rules: NotificationRule[];
}

/** Rules only: no cameras, connections, people or other settings travel with them. */
export const exportNotificationRules = (rules: NotificationRule[], app: string): NotificationRulesFile =>
  ({ type: NOTIFICATION_RULES_TYPE, version: NOTIFICATION_RULES_VERSION, app, rules });
export const serializeNotificationRules = (rules: NotificationRule[], app: string) => `${JSON.stringify(exportNotificationRules(rules, app), null, 2)}\n`;
export function notificationRulesFileName(rules: NotificationRule[], date: string) {
  if (rules.length !== 1) return `afterglow-notification-rules-${date}.json`;
  const slug = rules[0].title.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 40).replace(/-+$/, "");
  return `afterglow-notification-${slug || "rule"}-${date}.json`;
}

export interface ImportedRule { index: number; rule: NotificationRule }
export interface RejectedRule { index: number; title: string; reasons: Message[] }
export interface NotificationRulesImport { app?: string; rules: ImportedRule[]; rejected: RejectedRule[] }
export type NotificationRulesParse = { value: NotificationRulesImport } | { error: Message };

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const fieldList = (keys: string[]) => [...new Set(keys)].slice(0, 5).join(", ");
const update = (fields: string) => msg("Uses settings this version of Afterglow doesn’t recognise ({fields}). Update Afterglow on this installation, then import again.", { fields });
const issuePath = (issue: ZodIssue) => issue.path.map(String).join(".") || "rule";

// Unknown keys can sit inside a union option, such as a trigger written by a newer release.
const unknownKeys = (issues: ZodIssue[], base: PropertyKey[] = []): string[] => issues.flatMap(issue => {
  const path = [...base, ...issue.path];
  if (issue.code === "unrecognized_keys") return issue.keys.map(key => [...path.map(String), key].join("."));
  return issue.code === "invalid_union" ? issue.errors.flatMap(errors => unknownKeys(errors as ZodIssue[], path)) : [];
});

function issueReasons(issues: ZodIssue[]): Message[] {
  const unknown = unknownKeys(issues);
  if (unknown.length) return [update(fieldList(unknown))];
  return issues.slice(0, 3).map(issue => msg("{field}: {problem}", {
    field: issuePath(issue),
    problem: Object.prototype.hasOwnProperty.call(nb, issue.message) ? { key: issue.message as keyof typeof nb } : issue.message,
  }));
}

/** Reads an export without saving anything. Valid rules come back even when others in the same file fail. */
export function parseNotificationRules(text: string): NotificationRulesParse {
  if (!text.trim()) return { error: "Paste exported rules or choose a file." };
  if (new Blob([text]).size > MAX_CONFIG_BYTES) return { error: "The file exceeds the 2 MB limit." };
  let data: unknown;
  try { data = JSON.parse(text); }
  catch { return { error: "This isn’t valid JSON. Use the text or file exactly as Afterglow exported it." }; }
  if (!isObject(data) || data.type !== NOTIFICATION_RULES_TYPE) {
    if (isObject(data) && "settings" in data && "version" in data) return { error: "This is a full configuration backup. Restore it under Storage and backups instead." };
    return { error: "This isn’t an Afterglow notification rules export." };
  }
  if (typeof data.version !== "number" || !Number.isInteger(data.version)) return { error: "This isn’t an Afterglow notification rules export." };
  if (data.version > NOTIFICATION_RULES_VERSION) return { error: msg("This file uses export format {version} from a newer version of Afterglow. Update Afterglow on this installation, then import again.", { version: data.version }) };
  if (data.version !== NOTIFICATION_RULES_VERSION) return { error: msg("Export format {version} isn’t supported.", { version: data.version }) };
  const extra = Object.keys(data).filter(key => !envelopeKeys.includes(key));
  if (extra.length) return { error: update(fieldList(extra)) };
  if (!Array.isArray(data.rules)) return { error: "This isn’t an Afterglow notification rules export." };
  if (!data.rules.length) return { error: "The file contains no notification rules." };
  if (data.rules.length > MAX_NOTIFICATION_RULES) return { error: msg("A file can contain up to {count} rules.", { count: MAX_NOTIFICATION_RULES }) };
  const app = typeof data.app === "string" ? data.app.slice(0, 40) : undefined;
  const rules: ImportedRule[] = [], rejected: RejectedRule[] = [];
  const ids = new Set<string>();
  data.rules.forEach((raw: unknown, index) => {
    const rawTitle = isObject(raw) && typeof raw.title === "string" && raw.title.trim() ? raw.title.trim().slice(0, 100) : "";
    const title = rawTitle || `#${index + 1}`;
    if (!isObject(raw)) { rejected.push({ index, title, reasons: ["This entry isn’t a notification rule."] }); return; }
    const result = notificationRuleSchema.safeParse(raw);
    if (!result.success) { rejected.push({ index, title, reasons: issueReasons(result.error.issues) }); return; }
    if (ids.has(result.data.id)) { rejected.push({ index, title, reasons: ["This rule appears more than once in the file."] }); return; }
    ids.add(result.data.id);
    rules.push({ index, rule: result.data });
  });
  return { value: { app, rules, rejected } };
}

/** Compares dotted release numbers; undefined when either is not one. */
export function compareVersions(a: string, b: string) {
  const parse = (value: string) => /^\d+(\.\d+)*$/.test(value) ? value.split(".").map(Number) : undefined;
  const left = parse(a), right = parse(b);
  if (!left || !right) return undefined;
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const difference = (left[i] ?? 0) - (right[i] ?? 0);
    if (difference) return Math.sign(difference);
  }
  return 0;
}

/** Every Home Assistant entity and configured camera a rule refers to, in a stable order. */
export function notificationRuleReferences(rule: NotificationRule) {
  const entities: string[] = [], cameras: string[] = [];
  const entity = (id?: string) => { if (id && !entities.includes(id)) entities.push(id); };
  const camera = (id?: string) => { if (id && !cameras.includes(id)) cameras.push(id); };
  for (const trigger of notificationTriggers(rule)) if ("entity" in trigger) entity(trigger.entity);
  entity(rule.hideTrigger?.entity);
  rule.detailEntities.forEach(entity);
  if (rule.progress) for (const source of [rule.progress.current, rule.progress.start, rule.progress.end]) if (source.type === "entity") entity(source.entity);
  entity(rule.timeLeftEntity);
  entity(rule.imageEntity);
  entity(rule.shoppingAction?.list);
  rule.entityDisplay?.forEach(item => entity(item.entity));
  rule.widget?.slots?.forEach(line => widgetLineFields(line).forEach(slot => "entity" in slot && entity(slot.entity)));
  const media = rule.widget?.media;
  if (media?.type === "image") entity(media.entity);
  if (media && "cameraId" in media) camera(media.cameraId);
  camera(rule.cameraEntity);
  return { entities, cameras };
}

export type ImportChoice = "replace" | "keep-both" | "skip";
const sameTitle = (a: string, b: string) => a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();
/** The saved rule an imported rule would collide with: the same ID first, then the same name. */
export const importConflict = (rule: NotificationRule, existing: NotificationRule[]) =>
  existing.find(item => item.id === rule.id) ?? existing.find(item => sameTitle(item.title, rule.title));
/** The same rule copied again is most likely an update; a different rule with the same name most likely is not. */
export const defaultImportChoice = (rule: NotificationRule, conflict: NotificationRule): ImportChoice => conflict.id === rule.id ? "replace" : "keep-both";

/** "Name (2)", "Name (3)" … within the 100-character title limit. */
export function uniqueRuleTitle(title: string, taken: string[]) {
  for (let number = 2; ; number++) {
    const suffix = ` (${number})`;
    const candidate = `${title.trim().slice(0, 100 - suffix.length).trimEnd()}${suffix}`;
    if (!taken.some(other => sameTitle(other, candidate))) return candidate;
  }
}

export interface ImportOutcome { rules: NotificationRule[]; added: number; replaced: number; kept: number; skipped: number }
/** Merges the chosen rules into the saved list without saving it; saved rules keep their order. */
export function applyNotificationImport(existing: NotificationRule[], items: { rule: NotificationRule; choice?: ImportChoice }[], newId: () => string): ImportOutcome {
  const rules = [...existing];
  const outcome = { added: 0, replaced: 0, kept: 0, skipped: 0 };
  const replacedIds = new Set<string>();
  for (const { rule, choice } of items) {
    const conflict = importConflict(rule, existing);
    if (!conflict) { rules.push(rule); outcome.added++; continue; }
    const resolved = choice ?? defaultImportChoice(rule, conflict);
    if (resolved === "skip") { outcome.skipped++; continue; }
    // A second rule aimed at the same saved rule keeps both rather than overwriting the first replacement.
    if (resolved === "replace" && !replacedIds.has(conflict.id)) {
      replacedIds.add(conflict.id);
      rules[rules.findIndex(item => item.id === conflict.id)] = rule;
      outcome.replaced++;
      continue;
    }
    rules.push({ ...rule, id: newId(), title: uniqueRuleTitle(rule.title, rules.map(item => item.title)) });
    outcome.kept++;
  }
  return { rules, ...outcome };
}
