import { useMemo } from "react";
import { useSharedConfiguration } from "@/contexts/SharedConfigurationContext";
import { createI18n } from "@/lib/i18n";

export function useI18n() {
  const language = useSharedConfiguration()?.state.config?.settings.language ?? "en";
  return useMemo(() => createI18n(language), [language]);
}
