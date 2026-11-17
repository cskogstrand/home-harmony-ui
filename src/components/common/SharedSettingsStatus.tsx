import { useSharedConfiguration } from "@/contexts/SharedConfigurationContext";
import { useI18n } from "@/hooks/use-i18n";

export function SharedSettingsStatus() {
  const shared = useSharedConfiguration();
  const { t, message } = useI18n();
  if (!shared) return null;
  const { state } = shared;
  return <div className="shared-settings-status">
    <p>{t("Applies to every screen connected to this server.")}</p>
    <p role="status">{state.error ? message(state.error) : state.saving ? t("Saving shared settings…") : !state.loaded ? t("Loading shared settings…") : state.dirty ? t("Shared settings are not saved yet.") : t("Shared settings saved.")}</p>
  </div>;
}
