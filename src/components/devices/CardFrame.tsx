import { ChevronRight } from "lucide-react";
import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "@/hooks/use-i18n";
import type { CardDesign } from "./card-designs";
import { CardDisabled, CardPresentation, type CardVariant } from "./card-presentation";
import "./device-cards.css";

export function CardFrame({ design, title, subtitle, variant = "Super compact", visible = true, disabled = false, demo = false, to, id, tabIndex, children, footer }: {
  design: CardDesign; title: string; subtitle?: string; variant?: CardVariant; visible?: boolean; disabled?: boolean; demo?: boolean;
  to?: string; id?: string; tabIndex?: number; children: ReactNode; footer?: ReactNode;
}) {
  const Icon = design.icon;
  const { t } = useI18n();
  const heading = <>
    <div className="dg-card-icon"><Icon size={22} strokeWidth={1.7} aria-hidden="true" /></div>
    <div className="min-w-0"><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
  </>;
  return <article id={id} tabIndex={tabIndex} className={`device-card-designs dg-card${variant !== "Original" ? " dg-compact" : ""}${variant === "Super compact" ? " dg-supercompact" : ""}`} aria-label={title} data-card-kind={design.id} data-demo-card={demo ? design.id : undefined} data-variant={variant}>
    <header className="dg-card-header">{to
      ? <Link className="dg-card-link" to={to} aria-label={t("{name} details", { name: title })}>{heading}<ChevronRight size={16} aria-hidden="true" /></Link>
      : heading}</header>
    <CardPresentation.Provider value={{ variant, visible, title }}><CardDisabled.Provider value={disabled}>{children}</CardDisabled.Provider></CardPresentation.Provider>
    {footer && <footer className="dg-card-footer">{footer}</footer>}
  </article>;
}
