import type { AlarmAction } from "@/types/api";
import { alarmModes } from "./ha-model";

/** The command whose result the panel already reports. Offering it again would change nothing. */
export function alarmStateAction(state: string): AlarmAction | undefined {
  if (state === "disarmed") return "alarm_disarm";
  if (state === "triggered") return "alarm_trigger";
  if (!state.startsWith("armed_")) return undefined;
  return alarmModes.find(mode => mode.action === `alarm_arm_${state.slice("armed_".length)}`)?.action;
}
