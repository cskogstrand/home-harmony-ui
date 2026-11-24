import { useRef } from "react";
import type { Entity } from "@/types/api";
import { useApp } from "@/contexts/AppContext";
import { useI18n } from "@/hooks/use-i18n";
import { available, entityStateLabel } from "@/lib/ha-model";
import { entityPrinter, type PrinterModel, type PrinterTemperature } from "@/lib/printer-model";
import { Readout } from "./CardControls";
import { PrinterCard } from "./CardLayouts";
import { EntityMedia } from "./EntityMedia";

// Re-render only when one of the printer's own entities changes, not on every state update in the home.
function usePrinter(entity: Entity) {
  const cache = useRef<{ entity?: Entity; entities?: Entity[]; model?: PrinterModel }>({});
  return useApp(app => {
    const entities = app.currentHome.entities;
    const cached = cache.current;
    if (cached.entity === entity && cached.entities === entities) return cached.model;
    const model = entityPrinter(entity, entities);
    const same = cached.entity === entity && cached.model && model && cached.model.entities.length === model.entities.length
      && cached.model.entities.every((item, index) => item === model.entities[index]);
    cache.current = { entity, entities, model: same ? cached.model : model };
    return cache.current.model;
  });
}

/** The live printer card for a card saved against one of the printer's progress, status or stage sensors. */
export function PrinterCardContent({ entity }: { entity: Entity }) {
  const { t, language, locale, reading } = useI18n();
  const homeOnline = useApp(app => app.homeOnline);
  const timeZone = useApp(app => app.currentHome.timeZone);
  const model = usePrinter(entity);
  if (!model) return <Readout value={entityStateLabel(entity, language)} caption="" />;
  const phase = homeOnline ? model.phase : "unavailable";
  const running = phase === "printing" || phase === "paused";
  const duration = (minutes?: number) => minutes === undefined ? "—"
    : minutes < 60 ? t("{minutes} min", { minutes }) : t("{hours} h {minutes} min", { hours: Math.floor(minutes / 60), minutes: minutes % 60 });
  const finishedAt = model.endTime ?? model.status?.lastChanged;
  const clock = finishedAt && Number.isFinite(Date.parse(finishedAt))
    ? new Intl.DateTimeFormat(locale, { timeZone, hour: "2-digit", minute: "2-digit" }).format(Date.parse(finishedAt)) : undefined;
  const stage = model.stage && available(model.stage) ? entityStateLabel(model.stage, language) : undefined;
  const hero = {
    printing: { label: t("Time left"), time: duration(model.remainingMinutes), status: stage ?? t("Printing") },
    paused: { label: t("Time left"), time: duration(model.remainingMinutes), status: stage && stage !== t("Paused") ? `${t("Paused")} · ${stage}` : t("Paused") },
    finished: { label: t("Finished"), time: clock ? t("Done at {time}", { time: clock }) : t("Done") },
    failed: { label: t("Printer"), time: t("Print failed") },
    idle: { label: t("Printer"), time: t("Ready") },
    unavailable: { label: t("Printer"), time: t("Unavailable") },
  }[phase];
  const temperature = (label: string, value: PrinterTemperature) => value.current === undefined ? [] : [{
    label, value: reading(value.current, { unit: value.unit, deviceClass: "temperature" }),
    target: running && value.target ? reading(value.target, { unit: value.unit, deviceClass: "temperature" }) : undefined,
  }];
  const trays = model.trays.map(tray => ({
    id: tray.entity.entityId, color: tray.color, type: tray.type, active: tray.active, empty: tray.empty,
    label: `${tray.name}: ${(tray.empty ? [t("Empty")] : [tray.entity.state, tray.type !== tray.entity.state && tray.type, tray.active && t("In use")]).filter(Boolean).join(", ")}`,
  }));
  const offline = phase === "unavailable";
  return <PrinterCard phase={phase} progress={phase === "idle" || offline ? undefined : model.progress} label={hero.label} time={hero.time}
    status={"status" in hero ? hero.status : undefined} error={offline ? undefined : model.error}
    notice={offline ? t("Printer unavailable. Readings return when it reconnects.") : undefined}
    temperatures={offline ? [] : [...temperature(t("Nozzle"), model.nozzle), ...temperature(t("Bed"), model.bed)]}
    trays={offline ? [] : trays} media={!offline && model.media ? <EntityMedia key={model.media.entityId} entity={model.media} /> : undefined} />;
}
