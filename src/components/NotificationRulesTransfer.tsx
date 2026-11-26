import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Check, Copy, Download, FileUp, TriangleAlert, Upload, type LucideIcon } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { newPlannerId, useFamily } from "@/contexts/FamilyContext";
import { useSharedConfiguration } from "@/contexts/SharedConfigurationContext";
import { useI18n } from "@/hooks/use-i18n";
import { appVersion } from "@/hooks/use-app-update";
import { msg, type Message } from "@/lib/i18n";
import { notificationEntity, notificationKindIcons, notificationKinds } from "@/lib/notifications";
import {
  applyNotificationImport, compareVersions, defaultImportChoice, importConflict, notificationRuleReferences, notificationRulesFileName,
  parseNotificationRules, serializeNotificationRules, uniqueRuleTitle, MAX_NOTIFICATION_RULES,
  type ImportChoice, type ImportOutcome, type NotificationRulesImport,
} from "@/lib/notification-transfer";
import { configuredCamera } from "../../shared/cameras";
import { MAX_CONFIG_BYTES } from "../../shared/configuration";
import { notificationTriggers, type NotificationRule, type NotificationTrigger } from "../../shared/notifications";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { ConfirmDialog } from "./common/ConfirmDialog";
import { UnsavedChangesGuard } from "./common/UnsavedChangesGuard";
import { PanelTitle } from "./PanelTitle";


/** Copies text with the Clipboard API, or the selection fallback that local HTTP dashboards still allow. */
async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); return; }
  catch {
    const focused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const area = document.createElement("textarea");
    area.value = text; area.readOnly = true; area.setAttribute("aria-hidden", "true");
    area.style.position = "fixed"; area.style.opacity = "0"; area.style.inset = "0 auto auto 0";
    document.body.append(area); area.select();
    const copied = document.execCommand?.("copy") ?? false;
    area.remove(); focused?.focus();
    if (!copied) throw new Error("Copy failed");
  }
}

interface ExportMenuProps {
  rules: NotificationRule[];
  /** The visible trigger text; without it the trigger is an icon button named by `label`. */
  text?: Message;
  label: Message;
  note?: Message;
  icon?: LucideIcon;
  disabled?: boolean;
  children?: ReactNode;
}

/** Download or copy rules as an `afterglow.notification-rules` file. Copying is confirmed in a polite live region. */
export function NotificationExportMenu({ rules, text, label, note, icon = Download, disabled, children }: ExportMenuProps) {
  const { message } = useI18n();
  const [status, setStatus] = useState("");
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const announce = (value: string, done = false) => {
    window.clearTimeout(timer.current);
    setStatus(""); setCopied(done);
    // A fresh node text lets a repeated copy be announced again.
    requestAnimationFrame(() => setStatus(value));
    timer.current = window.setTimeout(() => { setStatus(""); setCopied(false); }, 4000);
  };
  const contents = () => serializeNotificationRules(rules, appVersion);
  const one = rules.length === 1;
  const download = () => {
    try {
      const url = URL.createObjectURL(new Blob([contents()], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = notificationRulesFileName(rules, new Date().toISOString().slice(0, 10));
      document.body.append(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { toast.error(message("Could not create the file. Try copying instead.")); }
  };
  const copy = async () => {
    try {
      await copyText(contents());
      announce(message(one ? msg("Copied “{name}” to the clipboard.", { name: rules[0].title }) : msg("Copied {count} rules to the clipboard.", { count: rules.length })), true);
    } catch {
      const failed = message("Could not copy. Download the file instead.");
      announce(failed); toast.error(failed);
    }
  };
  const Icon = copied ? Check : icon;
  return <>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant={text ? "outline" : "ghost"} size={text ? "default" : "icon"} disabled={disabled || !rules.length} aria-label={message(label)}>
          <Icon size={18} aria-hidden="true" />{text && message(text)}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="notification-export-menu">
        {note && <DropdownMenuLabel className="notification-export-note">{message(note)}</DropdownMenuLabel>}
        <DropdownMenuItem onSelect={download}><Download size={16} aria-hidden="true" />{message("Download file")}</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => { void copy(); }}><Copy size={16} aria-hidden="true" />{message("Copy to clipboard")}</DropdownMenuItem>
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
    <span role="status" className="sr-only">{status}</span>
  </>;
}

type Step = "input" | "preview" | "done";
const choiceLabels = { replace: "Replace", "keep-both": "Keep both", skip: "Skip" } as const;

/** Import rules from a file or pasted text: validate, preview with a choice per conflict, then save once. */
export function NotificationImportDialog() {
  const { t, message } = useI18n();
  const { notifications, setNotifications } = useFamily();
  const { currentHome, homeOnline } = useApp();
  const shared = useSharedConfiguration();
  const disabled = !shared?.state.loaded || !!shared.state.error;
  const cameras = shared?.state.config.settings.cameras;
  const entities = currentHome.entities;
  const checkEntities = homeOnline && entities.length > 0;
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("input");
  const [text, setText] = useState("");
  const [inputError, setInputError] = useState<Message>("");
  const [draft, setDraft] = useState<NotificationRulesImport>();
  const [choices, setChoices] = useState<Record<number, ImportChoice>>({});
  const [saveError, setSaveError] = useState<Message>("");
  const [outcome, setOutcome] = useState<ImportOutcome & { failed: number }>();
  const [askDiscard, setAskDiscard] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const textArea = useRef<HTMLTextAreaElement>(null);
  const summary = useRef<HTMLParagraphElement>(null);
  const result = useRef<HTMLParagraphElement>(null);
  const ids = useId();
  useEffect(() => {
    if (step === "preview") summary.current?.focus();
    if (step === "done") result.current?.focus();
  }, [step]);
  const reset = () => {
    setStep("input"); setText(""); setInputError(""); setDraft(undefined); setChoices({}); setSaveError(""); setOutcome(undefined);
  };
  const close = () => { setOpen(false); reset(); };
  const read = (value: string) => {
    const parsed = parseNotificationRules(value);
    if ("error" in parsed) { setInputError(parsed.error); return; }
    setInputError(""); setSaveError(""); setDraft(parsed.value); setChoices({}); setStep("preview");
  };
  const triggerText = (trigger: NotificationTrigger) => {
    const entity = "entity" in trigger ? notificationEntity(entities, trigger.entity) : undefined;
    const name = "entity" in trigger ? entity?.name ?? referenceName(trigger.entity) : "";
    if (trigger.type === "state") return [name, trigger.attribute, { eq: "=", neq: "≠", gt: ">", lt: "<" }[trigger.operator], entity?.attributes.mode === "password" ? "••••••" : trigger.value].filter(Boolean).join(" ");
    if (trigger.type === "calendar") return `${t("Calendar event")}: ${name}`;
    if (trigger.type === "entity-event") return `${t("Event entity")}: ${[name, trigger.eventType].filter(Boolean).join(" · ")}`;
    return `${t("Home Assistant event")}: ${trigger.eventType}`;
  };
  const rows = draft?.rules.map(({ index, rule }) => {
    const conflict = importConflict(rule, notifications.rules);
    const choice = conflict ? choices[index] ?? defaultImportChoice(rule, conflict) : undefined;
    const references = notificationRuleReferences(rule);
    const items = [
      ...references.entities.map(id => {
        const entity = notificationEntity(entities, id);
        return { id, name: entity?.name ?? referenceName(id), missing: checkEntities && !entity, camera: false };
      }),
      ...references.cameras.map(id => {
        const camera = configuredCamera(cameras, id);
        return { id, name: camera?.name ?? t("Camera"), missing: !camera, camera: true };
      }),
    ];
    return { index, rule, conflict, choice, items, missing: items.filter(item => item.missing).length };
  }) ?? [];
  const importing = rows.filter(row => row.choice !== "skip");
  const taken = notifications.rules.map(rule => rule.title);
  const confirm = () => {
    if (!draft) return;
    setSaveError("");
    const merged = applyNotificationImport(notifications.rules, rows.map(row => ({ rule: row.rule, choice: row.choice })), newPlannerId);
    if (merged.rules.length > MAX_NOTIFICATION_RULES) {
      setSaveError(msg("Afterglow keeps up to {count} rules. Skip {extra} or delete saved rules first.", { count: MAX_NOTIFICATION_RULES, extra: merged.rules.length - MAX_NOTIFICATION_RULES }));
      return;
    }
    if (!setNotifications({ rules: merged.rules })) {
      setSaveError("The rules could not be saved. Your import is still here. Check settings storage and retry.");
      return;
    }
    setOutcome({ ...merged, failed: draft.rejected.length });
    setStep("done");
  };
  const newer = draft?.app && compareVersions(draft.app, appVersion) === 1;
  const missingRules = rows.filter(row => row.missing).length;
  return <>
    <Dialog open={open} onOpenChange={next => {
      if (next) { reset(); setOpen(true); }
      else if (step === "preview") setAskDiscard(true);
      else close();
    }}>
      <DialogTrigger asChild><Button variant="outline" disabled={disabled}><Upload size={18} aria-hidden="true" />{t("Import notifications")}</Button></DialogTrigger>
      <DialogContent className="notification-import-dialog" aria-describedby={`${ids}-description`}>
        <DialogHeader>
          <DialogTitle asChild><PanelTitle icon={Upload}>{t("Import notifications")}</PanelTitle></DialogTitle>
          <DialogDescription id={`${ids}-description`}>{t(step === "done" ? "The rules are shared with every screen." : "Rules exported from another Afterglow installation. Nothing is saved until you confirm.")}</DialogDescription>
        </DialogHeader>
        {step === "input" && <form className="notification-import-body planner-form" noValidate onSubmit={event => { event.preventDefault(); read(text); }}>
          <div className="notification-import-file">
            <Button type="button" variant="outline" onClick={() => fileInput.current?.click()}><FileUp size={18} aria-hidden="true" />{t("Choose file")}</Button>
            <span className="page-note">{t("A .json file from Export.")}</span>
            <input ref={fileInput} type="file" accept=".json,application/json" className="sr-only" tabIndex={-1} aria-label={t("Exported rules file")} onChange={async event => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              if (file.size > MAX_CONFIG_BYTES) { setInputError("The file exceeds the 2 MB limit."); return; }
              try { read(await file.text()); } catch { setInputError("The file could not be read. Try again or paste its text."); }
            }} />
          </div>
          <label>{t("Or paste exported rules")}
            <textarea ref={textArea} name="rules" rows={6} spellCheck={false} className="notification-import-text" value={text}
              aria-invalid={!!inputError || undefined} aria-describedby={inputError ? `${ids}-error` : undefined}
              onChange={event => { setText(event.target.value); setInputError(""); }} />
          </label>
          {inputError && <p id={`${ids}-error`} role="alert" className="text-destructive">{message(inputError)}</p>}
          <div className="form-actions">
            <Button type="button" variant="outline" onClick={close}>{t("Cancel")}</Button>
            <Button type="submit" disabled={!text.trim()}>{t("Preview import")}</Button>
          </div>
        </form>}
        {step === "preview" && draft && <div className="notification-import-body">
          <div className="notification-import-scroll">
            <p ref={summary} tabIndex={-1} className="notification-import-summary">
              {draft.rejected.length ? t("{ready} ready to import · {failed} can’t be imported", { ready: rows.length, failed: draft.rejected.length }) : t("{count} ready to import", { count: rows.length })}
            </p>
            {newer && <p className="page-note">{t("Exported from Afterglow {version}. This installation runs {current}.", { version: draft.app!, current: appVersion })}</p>}
            {!checkEntities && <p className="page-note">{t("Home Assistant isn’t connected, so entities can’t be checked yet.")}</p>}
            {checkEntities && missingRules > 0 && <p className="notification-import-warning"><TriangleAlert size={16} aria-hidden="true" />{t("Some rules use entities or cameras this installation doesn’t have. They import, but show a warning until you choose replacements.")}</p>}
            {rows.length > 0 && <ul className="notification-import-list" aria-label={t("Rules to import")}>{rows.map(row => {
              const Icon = notificationKindIcons[row.rule.kind];
              const triggers = notificationTriggers(row.rule);
              const hint = `${ids}-hint-${row.index}`;
              return <li key={row.index} className="notification-import-rule" data-choice={row.choice}>
                <div className="notification-import-heading">
                  <Icon size={20} aria-hidden="true" />
                  <div className="min-w-0">
                    <strong>{row.rule.title}</strong>
                    <p className="page-note">{t(notificationKinds[row.rule.kind])} · {triggerText(triggers[0])}{triggers.length > 1 && <> · {t("{count} triggers", { count: triggers.length })}</>}</p>
                  </div>
                </div>
                {row.items.length > 0 && <ul className="notification-import-entities" aria-label={t("Entities in {name}", { name: row.rule.title })}>
                  {row.items.map(item => <li key={`${item.camera}-${item.id}`} data-missing={item.missing || undefined}>
                    {item.missing && <TriangleAlert size={14} aria-hidden="true" />}
                    <span className="notification-import-entity-name">{item.name}</span>
                    {item.missing && <span className="notification-import-missing">{t(item.camera ? "Camera not set up here" : "Not found in Home Assistant")}</span>}
                  </li>)}
                </ul>}
                {row.conflict && <fieldset className="notification-import-conflict" aria-describedby={hint}>
                  <legend>{t(row.conflict.id === row.rule.id ? "This rule is already saved here as “{name}”." : "A saved rule is also called “{name}”.", { name: row.conflict.title })}</legend>
                  <div className="notification-import-choices">
                    {(["replace", "keep-both", "skip"] as const).map(choice => <label key={choice}>
                      <input type="radio" name={`${ids}-choice-${row.index}`} value={choice} checked={row.choice === choice}
                        onChange={() => setChoices(values => ({ ...values, [row.index]: choice }))} />
                      <span>{t(choiceLabels[choice])}</span>
                    </label>)}
                  </div>
                  <p id={hint} className="page-note">{row.choice === "replace" ? t("Overwrites the saved rule “{name}”.", { name: row.conflict.title })
                    : row.choice === "keep-both" ? t("Adds this rule as “{name}”.", { name: uniqueRuleTitle(row.rule.title, taken) })
                      : t("Leaves the saved rule as it is.")}</p>
                </fieldset>}
              </li>;
            })}</ul>}
            {draft.rejected.length > 0 && <section className="notification-import-rejected" aria-labelledby={`${ids}-rejected`}>
              <h3 id={`${ids}-rejected`}>{t("Can’t be imported")}</h3>
              <ul>{draft.rejected.map(item => <li key={item.index}>
                <strong>{item.title}</strong>
                {item.reasons.map((reason, index) => <p key={index}>{message(reason)}</p>)}
              </li>)}</ul>
            </section>}
          </div>
          {saveError && <p role="alert" className="text-destructive">{message(saveError)}</p>}
          {!importing.length && rows.length > 0 && <p className="page-note">{t("Every rule is skipped. Choose Replace or Keep both to import one.")}</p>}
          <div className="form-actions">
            <Button type="button" variant="ghost" className="mr-auto" onClick={() => { setStep("input"); setSaveError(""); requestAnimationFrame(() => textArea.current?.focus()); }}>{t("Back")}</Button>
            <Button type="button" variant="outline" onClick={close}>{t("Cancel")}</Button>
            <Button type="button" disabled={disabled || !importing.length} onClick={confirm}>{t("Import rules")}</Button>
          </div>
        </div>}
        {step === "done" && outcome && <div className="notification-import-body">
          <p ref={result} tabIndex={-1} className="notification-import-summary" role="status">
            {[
              outcome.added && t("Added: {count}", { count: outcome.added }),
              outcome.replaced && t("Replaced: {count}", { count: outcome.replaced }),
              outcome.kept && t("Kept both: {count}", { count: outcome.kept }),
              outcome.skipped && t("Skipped: {count}", { count: outcome.skipped }),
              outcome.failed && t("Couldn’t be imported: {count}", { count: outcome.failed }),
            ].filter(Boolean).join(" · ") || t("No rules changed.")}
          </p>
          <div className="form-actions"><Button type="button" onClick={close}>{t("Done")}</Button></div>
        </div>}
      </DialogContent>
    </Dialog>
    <ConfirmDialog open={askDiscard} onOpenChange={setAskDiscard} title="Discard this import?" description="None of the rules have been saved yet."
      cancelLabel="Keep editing" confirmLabel="Discard import" destructive onConfirm={close} />
    <UnsavedChangesGuard dirty={open && step === "preview"} title="Discard this import?" description="None of the rules have been saved yet." onDiscard={close} />
  </>;
}

// An entity missing here can only be named by its reference: the entity ID, or a registry ID.
const referenceName = (reference: string) => reference.slice(reference.indexOf("|") + 1) || reference;
