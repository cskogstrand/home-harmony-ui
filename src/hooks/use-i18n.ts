import { useContext, useEffect, useMemo } from "react";
import { AppStoreContext } from "@/contexts/AppContext";
import { useSharedConfiguration } from "@/contexts/SharedConfigurationContext";
import { createI18n, type Language } from "@/lib/i18n";

// Shared settings arrive after the first paint; this screen's last language avoids an English flash until then.
const storageKey = "afterglow-language";
const remembered = (): Language => { try { return localStorage.getItem(storageKey) === "nb" ? "nb" : "en"; } catch { return "en"; } };
// The store holds placeholder settings until the server answers; isolated test contexts omit the flag and are trusted.
const useLoadedLanguage = () => {
  const state = useSharedConfiguration()?.state;
  return state?.loaded === false ? undefined : state?.config?.settings.language;
};

export function useI18n() {
  const language = useLoadedLanguage() ?? remembered();
  return useMemo(() => createI18n(language), [language]);
}

/** Call once near the root: remembers the shared language for the next load on this screen and loads Home Assistant's labels for it. */
export function useRememberLanguage() {
  const configured = useLoadedLanguage();
  const language = configured ?? remembered();
  const store = useContext(AppStoreContext);
  useEffect(() => { if (configured) try { localStorage.setItem(storageKey, configured); } catch { /* storage unavailable: next load falls back to English until settings arrive */ } }, [configured]);
  useEffect(() => { store?.setLanguage(language); }, [store, language]);
}
