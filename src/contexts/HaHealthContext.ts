import { createContext, useContext } from "react";
import type { BackupHealth, MaintenanceItem, RepairIssue } from "@/lib/ha-health";

/** `hidden`: Home Assistant refused the read (no administrator token) or lacks the feature; show nothing. */
export type HealthRead<T> = { status: "loading" | "hidden" | "unavailable" } | { status: "ready"; value: T };
export interface HaHealth {
  repairs: HealthRead<RepairIssue[]>;
  backup: HealthRead<BackupHealth>;
  /** When repairs and backup status were last read, in epoch milliseconds. */
  checkedAt?: number;
  /** Actionable items only (error and critical repairs, backup problems), for Home status and the Settings badge. */
  items: MaintenanceItem[];
  /** Reads repairs and backup status again now. */
  refresh: () => void;
}

export const noHealth: HaHealth = { repairs: { status: "hidden" }, backup: { status: "hidden" }, items: [], refresh: () => {} };
export const HaHealthContext = createContext<HaHealth>(noHealth);
export const useHaHealth = () => useContext(HaHealthContext);
