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
  return <article id={id} tabIndex={tabIndex} className={`device-card-designs dg-card dg-${design.tint}${variant !== "Original" ? " dg-compact" : ""}${variant === "Super compact" ? " dg-supercompact" : ""}`} aria-label={title} data-card-kind={design.id} data-demo-card={demo ? design.id : undefined} data-variant={variant}>
    <header className="dg-card-header"><div className="dg-card-icon"><Icon size={22} strokeWidth={1.7} aria-hidden="true" /></div><div><h2>{to ? <Link to={to} aria-label={t("{name} details", { name: title })}>{title}</Link> : title}</h2>{subtitle && <p>{subtitle}</p>}</div></header>
    <CardPresentation.Provider value={{ variant, visible, title, tint: design.tint }}><CardDisabled.Provider value={disabled}>{children}</CardDisabled.Provider></CardPresentation.Provider>
    {footer && <footer className="dg-card-footer">{footer}</footer>}
  </article>;
}
