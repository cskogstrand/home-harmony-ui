import { z } from "zod";

/** A Home Assistant repair issue, with its title in the dashboard language when Home Assistant has one. */
export interface RepairIssue {
  domain: string;
  issueId: string;
  severity: "warning" | "error" | "critical";
  ignored: boolean;
  translationKey?: string;
  placeholders: Record<string, string>;
  learnMoreUrl?: string;
  title?: string;
}

/** Automatic backup status from `backup/info`. Times are epoch milliseconds. */
export interface BackupHealth {
  lastCompleted?: number;
  lastAttempted?: number;
  next?: number;
  /** Backup locations (agents) that reported an error, with Home Assistant's message. */
  agentErrors: { agent: string; message: string }[];
  /** Dates of retained backups made with the automatic settings, newest first. */
  automaticBackups: number[];
}

export interface PersistentNotification { id: string; title?: string; message: string; created?: number }

const time = (value: unknown) => {
  const parsed = typeof value === "string" ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
};
const text = z.string().nullish().transform(value => value?.trim() || undefined);

const issueSchema = z.object({
  domain: z.string().min(1), issue_id: z.string().min(1), severity: z.enum(["warning", "error", "critical"]),
  ignored: z.boolean().nullish(), translation_key: text, translation_domain: text,
  translation_placeholders: z.record(z.string(), z.unknown()).nullish(), learn_more_url: text,
});
/** Valid issues from `repairs/list_issues`; malformed entries are skipped. Throws when the response itself is not a list. */
export function parseRepairs(result: unknown): RepairIssue[] {
  const { issues } = z.object({ issues: z.array(z.unknown()) }).parse(result);
  return issues.flatMap(item => {
    const parsed = issueSchema.safeParse(item);
    if (!parsed.success) return [];
    const issue = parsed.data;
    return [{
      domain: issue.translation_domain ?? issue.domain, issueId: issue.issue_id, severity: issue.severity, ignored: !!issue.ignored,
      translationKey: issue.translation_key,
      placeholders: Object.fromEntries(Object.entries(issue.translation_placeholders ?? {}).flatMap(([key, value]) =>
        typeof value === "string" || typeof value === "number" ? [[key, String(value)]] : [])),
      learnMoreUrl: issue.learn_more_url && /^https:\/\//i.test(issue.learn_more_url) ? issue.learn_more_url : undefined,
    }];
  });
}

/** The translation key holding an issue's title in Home Assistant's `issues` category. */
export const repairTitleKey = (issue: Pick<RepairIssue, "domain" | "issueId" | "translationKey">) =>
  `component.${issue.domain}.issues.${issue.translationKey ?? issue.issueId}.title`;

/** Fills an issue title from Home Assistant's translations and the issue's placeholders. */
export function repairTitle(issue: RepairIssue, resources: Record<string, unknown>) {
  const template = resources[repairTitleKey(issue)];
  if (typeof template !== "string" || !template.trim()) return undefined;
  return template.replace(/\{(\w+)\}/g, (placeholder, name: string) => issue.placeholders[name] ?? placeholder).trim();
}

const backupSchema = z.object({
  last_completed_automatic_backup: z.string().nullish(), last_attempted_automatic_backup: z.string().nullish(),
  next_automatic_backup: z.string().nullish(), agent_errors: z.record(z.string(), z.unknown()).nullish(),
  backups: z.array(z.unknown()).nullish(),
});
const backupEntry = z.object({ date: z.string(), with_automatic_settings: z.boolean().nullish() });
/** Backup status from `backup/info`. Throws when the response is not backup information. */
export function parseBackupInfo(result: unknown): BackupHealth {
  const info = backupSchema.parse(result);
  const automaticBackups = (info.backups ?? []).flatMap(item => {
    const parsed = backupEntry.safeParse(item);
    const date = parsed.success && parsed.data.with_automatic_settings ? time(parsed.data.date) : undefined;
    return date === undefined ? [] : [date];
  }).sort((a, b) => b - a);
  return {
    lastCompleted: time(info.last_completed_automatic_backup), lastAttempted: time(info.last_attempted_automatic_backup),
    next: time(info.next_automatic_backup), automaticBackups,
    agentErrors: Object.entries(info.agent_errors ?? {}).map(([agent, message]) => ({ agent, message: typeof message === "string" ? message.slice(0, 500) : "" })),
  };
}

const notificationSchema = z.object({ notification_id: z.string().min(1), title: text, message: z.string(), created_at: z.string().nullish() });
const notificationEvent = z.object({ type: z.enum(["current", "added", "updated", "removed"]), notifications: z.record(z.string(), z.unknown()) });
/**
 * Applies one `persistent_notification/subscribe` message: `current` replaces the list, `added`/`updated` merge and
 * `removed` deletes. Returns the next list, newest first, or undefined when the message is not a notification update.
 */
export function applyNotificationEvent(current: readonly PersistentNotification[], message: unknown): PersistentNotification[] | undefined {
  const parsed = notificationEvent.safeParse(message);
  if (!parsed.success) return undefined;
  const { type, notifications } = parsed.data;
  const next = new Map(type === "current" ? [] : current.map(item => [item.id, item]));
  for (const [id, value] of Object.entries(notifications)) {
    if (type === "removed") { next.delete(id); continue; }
    const item = notificationSchema.safeParse(value);
    if (item.success) next.set(item.data.notification_id, { id: item.data.notification_id, title: item.data.title, message: item.data.message, created: time(item.data.created_at) });
  }
  return [...next.values()].sort((a, b) => (b.created ?? 0) - (a.created ?? 0));
}

const HOUR = 3600000;
/** A daily schedule must have produced a backup within this window. */
export const STALE_BACKUP_MS = 48 * HOUR;
/** Repairs that need the owner: errors and critical issues that are not ignored. Warnings stay in Settings. */
export const actionableRepairs = (issues: readonly RepairIssue[]) => issues.filter(issue => !issue.ignored && issue.severity !== "warning");

export type BackupProblem = "failed" | "stale" | "agent-errors";
/**
 * What is wrong with automatic backups. `failed`: the last attempt did not complete. `stale`: the last completed automatic
 * backup is older than 48 hours, or older than the spacing of the two latest automatic backups plus a day when the schedule
 * is less frequent than daily. `agent-errors`: a backup location reported an error. Without automatic backups there is nothing to flag.
 */
export function backupProblems(backup: BackupHealth | undefined, now: number): BackupProblem[] {
  if (!backup) return [];
  const problems: BackupProblem[] = [];
  const { lastCompleted, lastAttempted, automaticBackups: [latest, previous] } = backup;
  if (lastAttempted !== undefined && (lastCompleted === undefined || lastAttempted > lastCompleted)) problems.push("failed");
  if (lastCompleted !== undefined) {
    const interval = latest !== undefined && previous !== undefined ? latest - previous : 0;
    if (now - lastCompleted > Math.max(STALE_BACKUP_MS, interval + 24 * HOUR)) problems.push("stale");
  }
  if (backup.agentErrors.length) problems.push("agent-errors");
  return problems;
}

/** One actionable Home Assistant maintenance item for Home status and the Settings badge. */
export type MaintenanceItem = { id: string; kind: "repair"; issue: RepairIssue } | { id: string; kind: BackupProblem };
/** Actionable items only: error and critical repairs, then backup problems. Warnings and notifications are not counted. */
export function maintenanceItems(health: { repairs?: readonly RepairIssue[]; backup?: BackupHealth }, now: number): MaintenanceItem[] {
  return [
    ...actionableRepairs(health.repairs ?? []).sort((a, b) => (a.severity === "critical" ? 0 : 1) - (b.severity === "critical" ? 0 : 1))
      .map(issue => ({ id: `repair:${issue.domain}:${issue.issueId}`, kind: "repair" as const, issue })),
    ...backupProblems(health.backup, now).map(kind => ({ id: `backup:${kind}`, kind })),
  ];
}

/** A readable fallback when Home Assistant has no title for an issue: "integration_not_found" → "Integration not found". */
export function fallbackRepairTitle(issue: Pick<RepairIssue, "issueId" | "translationKey">) {
  const words = (issue.translationKey ?? issue.issueId).replace(/[_-]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
