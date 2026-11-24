import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useApp } from "@/contexts/AppContext";
import { useI18n } from "@/hooks/use-i18n";
import { maintenanceItems } from "@/lib/ha-health";
import { HaHealthContext, type HaHealth, type HealthRead } from "./HaHealthContext";

/** Repairs and backup status are read on connect and then every 15 minutes while the screen is visible. */
export const HEALTH_REFRESH_MS = 15 * 60000;

const settle = <T,>(result: PromiseSettledResult<T | undefined>): HealthRead<T> => result.status === "rejected" ? { status: "unavailable" }
  : result.value === undefined ? { status: "hidden" } : { status: "ready", value: result.value };

export function HaHealthProvider({ children }: { children: ReactNode }) {
  const { language } = useI18n();
  const homeOnline = useApp(app => app.homeOnline);
  const listRepairs = useApp(app => app.listRepairs);
  const backupInfo = useApp(app => app.backupInfo);
  const [reads, setReads] = useState<Pick<HaHealth, "repairs" | "backup" | "checkedAt">>({ repairs: { status: "loading" }, backup: { status: "loading" } });
  const [request, setRequest] = useState(0);
  useEffect(() => {
    // Screens without these reads (isolated tests, older clients) have nothing to show.
    if (!homeOnline || !listRepairs || !backupInfo) return;
    let active = true, last = 0;
    const read = () => {
      last = Date.now();
      void Promise.allSettled([listRepairs(language), backupInfo()]).then(([repairs, backup]) => {
        if (active) setReads({ repairs: settle(repairs), backup: settle(backup), checkedAt: Date.now() });
      });
    };
    const visible = () => document.visibilityState === "visible";
    const timer = setInterval(() => { if (visible()) read(); }, HEALTH_REFRESH_MS);
    const shown = () => { if (visible() && Date.now() - last >= HEALTH_REFRESH_MS) read(); };
    document.addEventListener("visibilitychange", shown);
    read();
    return () => { active = false; clearInterval(timer); document.removeEventListener("visibilitychange", shown); };
  }, [homeOnline, listRepairs, backupInfo, language, request]);
  const refresh = useCallback(() => setRequest(count => count + 1), []);
  const value = useMemo<HaHealth>(() => ({
    ...reads,
    items: reads.checkedAt === undefined ? [] : maintenanceItems({
      repairs: reads.repairs.status === "ready" ? reads.repairs.value : undefined,
      backup: reads.backup.status === "ready" ? reads.backup.value : undefined,
    }, reads.checkedAt),
    refresh,
  }), [reads, refresh]);
  return <HaHealthContext.Provider value={value}>{children}</HaHealthContext.Provider>;
}
