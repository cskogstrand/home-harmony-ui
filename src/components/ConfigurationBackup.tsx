import { Database } from "lucide-react";
import { useI18n } from "@/hooks/use-i18n";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useFamily } from "@/contexts/FamilyContext";
import { useSharedConfiguration } from "@/contexts/SharedConfigurationContext";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { PanelHeading } from "@/components/FamilyPlanner";
import { MAX_CONFIG_BYTES, parseConfiguration, type Configuration } from "../../shared/configuration";

export function ConfigurationBackup() {
  const { t, message } = useI18n();
  const { exportConfiguration, importConfiguration } = useFamily();
  const shared = useSharedConfiguration();
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Configuration>();
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(false);
  const blocked = reading || (!shared.state.loaded || shared.state.saving || shared.state.dirty);
  const download = () => {
    try {
      const configuration = exportConfiguration();
      const url = URL.createObjectURL(new Blob([JSON.stringify(configuration, null, 2)], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `home-harmony-config-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.append(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setError("");
    } catch { setError("Could not export the configuration. Try again before closing this screen."); }
  };
  return <section className="glow-panel space-y-4">
    <PanelHeading icon={Database} title={t("Storage and backups")} />
    <p className="page-note">{t("Backups include shared app settings and timetable links. They exclude uploaded files, Home Assistant data, passwords and alarm codes.")}</p>
      <p role="status">{shared.state.saving ? t("Saving shared configuration…") : shared.state.dirty ? t("Unsaved changes on this screen.") : shared.state.loaded ? t("Shared configuration saved.") : t("Loading shared configuration…")}</p>
      {shared.state.error && <p role="alert" className="text-destructive">{message(shared.state.error)}</p>}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={shared.state.saving} onClick={() => { void shared.store.retry().catch(() => {}); }}>{t("Retry storage")}</Button>
        <Button variant="outline" disabled={shared.state.saving} onClick={() => setReload(true)}>{t("Load shared version")}</Button>
      </div>
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" disabled={!shared.state.loaded} onClick={download}>{shared?.state.dirty ? t("Export unsaved configuration") : t("Export configuration")}</Button>
      <Button variant="outline" disabled={blocked} onClick={() => fileInput.current?.click()}>{reading ? t("Reading backup…") : t("Import configuration")}</Button>
      <input ref={fileInput} type="file" accept=".json,application/json" className="sr-only" aria-label={t("Configuration backup file")} disabled={blocked} onChange={async event => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        setReading(true); setError("");
        try {
          if (file.size > MAX_CONFIG_BYTES) throw new Error("The backup exceeds the 2 MB limit.");
          setPending(parseConfiguration(await file.text()));
        } catch (error) { setError(error instanceof Error ? error.message : "Cannot read this backup."); }
        finally { setReading(false); }
      }} />
    </div>
    {error && <p role="alert" className="text-destructive">{message(error)}</p>}
    {pending && <ConfirmDialog open onOpenChange={open => { if (!open) setPending(undefined); }} title={t("Restore configuration?")} confirmLabel={t("Restore configuration")} destructive disabled={blocked}
      description={t("This replaces the entire shared configuration for every screen. Export the current configuration first if you need to keep it. Home Assistant data and server credentials stay unchanged.")}
      onConfirm={async () => { await importConfiguration(pending); toast.success(t("Configuration restored")); }} />}
    {reload && <ConfirmDialog open onOpenChange={setReload} title={t("Load shared configuration?")} confirmLabel={t("Load shared version")} destructive
      description={t("Discard unsaved changes on this screen and load the last saved shared configuration? Export unsaved changes first if you need to keep them.")}
      onConfirm={() => shared.store.refresh(true)} />}
  </section>;
}
