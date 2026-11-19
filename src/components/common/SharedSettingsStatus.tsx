import { useSharedConfiguration } from "@/contexts/SharedConfigurationContext";
import { Link } from "react-router-dom";
import { useI18n } from "@/hooks/use-i18n";

export function SharedSettingsStatus({ showRecovery = false }: { showRecovery?: boolean }) {
  const shared = useSharedConfiguration();
  const { t, message } = useI18n();
  if (!shared) return null;
  const { state } = shared;
  const status = state.error ? message(state.error) : state.saving ? t("Saving shared settings…") : !state.loaded ? t("Loading shared settings…") : state.dirty ? t("Shared settings are not saved yet.") : t("Shared settings saved.");
  return <div className="shared-settings-status">
    <p>{t("Applies to every screen connected to this server.")}</p>
    {showRecovery && (state.error || (state.dirty && !state.saving)) ? <div className="settings-storage-warning" role="alert">
      <p>{status}</p><Link className="text-link" to="/settings/backups">{t("Storage and backups")}</Link>
    </div> : <p role="status">{status}</p>}
  </div>;
}
