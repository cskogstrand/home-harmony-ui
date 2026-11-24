import { useState } from "react";
import { CarFront } from "lucide-react";
import { useI18n } from "@/hooks/use-i18n";
import { teslaModelVariant } from "@/lib/vehicles";

export function VehiclePhoto({ model, name, source, compact = false }: { model?: string; name: string; source?: string; compact?: boolean }) {
  const { t } = useI18n();
  const [failed, setFailed] = useState<string>();
  const [failedModel, setFailedModel] = useState<string>();
  const variant = teslaModelVariant(model);
  const photo = source && source !== failed;
  const src = photo ? source : variant && `/vehicles/model-${variant}.webp`;
  if (!src || src === failedModel) return compact ? <CarFront size={22} aria-hidden="true" /> : null;
  return <img key={src} className={`vehicle-photo${photo ? " is-photo" : ""}`} src={src} alt={compact ? "" : photo ? t("Photo of {name}", { name }) : t("Model illustration of {model}", { model })}
    onError={() => { if (photo) setFailed(src); else setFailedModel(src); }} decoding="async" />;
}
