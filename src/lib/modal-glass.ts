import type { Planner } from "../../shared/configuration";

export function modalGlassProperties(settings: Planner["appearance"]) {
  return {
    "--modal-glass-opacity": String((100 - settings.modalTransparency) / 100),
    "--modal-glass-blur": `${settings.modalBlur}px`,
    "--modal-glass-saturation": String(settings.modalSaturation / 100),
    "--modal-backdrop-opacity": String(settings.modalDimming / 100),
  };
}
