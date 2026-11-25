import { Activity, AppWindow, BellRing, Bot, Cctv, DoorOpen, Lock, Power, ShieldCheck, Tractor, UserRound, WashingMachine, Warehouse, type LucideIcon } from "lucide-react";
import type { ActivityIcon } from "@/lib/activity";

/** One outline glyph per kind of activity, shared by activity rows and the chosen sources in settings. */
export const activityIcons: Record<ActivityIcon, LucideIcon> = {
  door: DoorOpen, garage: Warehouse, window: AppWindow, lock: Lock, alarm: ShieldCheck, appliance: WashingMachine, robot: Bot, mower: Tractor,
  camera: Cctv, doorbell: BellRing, person: UserRound, power: Power, activity: Activity,
};
