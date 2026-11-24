import { useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { PanelTitle } from "@/components/PanelTitle";
import { SharedSettingsStatus } from "@/components/common/SharedSettingsStatus";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/hooks/use-i18n";
import { setupSteps } from "@/lib/household-setup";
import HomeSettings from "./HomeSettings";
import "./settings.css";

export default function Onboarding() {
  const { t } = useI18n();
  const [params] = useSearchParams();
  const index = Math.max(0, setupSteps.findIndex(step => step.id === params.get("step")));
  const step = setupSteps[index];
  const previous = setupSteps[index - 1];
  const next = setupSteps[index + 1];
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, [step]);
  return <div className="settings-page settings-wizard">
    <header className="settings-intro">
      <Link className="settings-back" to="/settings"><ArrowLeft size={18} aria-hidden="true" />{t("All settings")}</Link>
      <PanelTitle as="h1" icon={step.icon} ref={heading} tabIndex={-1}>{t(step.title)}</PanelTitle>
      <p className="page-note">{t("Step {current} of {total}", { current: index + 1, total: setupSteps.length })}</p>
    </header>
    <div className="settings-content">
      <SharedSettingsStatus showRecovery />
      <HomeSettings key={step.id} section={step.id} guided />
    </div>
    <nav className="settings-step-actions" aria-label={t("Household setup")}>
      {previous && <Link className="text-link" to={`/onboarding?step=${previous.id}`}><ArrowLeft size={17} aria-hidden="true" />{t("Back")}</Link>}
      <Button asChild><Link to={next ? `/onboarding?step=${next.id}` : "/"}>{next ? t(next.title) : t("Go to Today")}<ArrowRight size={17} aria-hidden="true" /></Link></Button>
    </nav>
  </div>;
}
