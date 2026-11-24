import { PanelTitle } from "@/components/PanelTitle";
import { Wifi, Users, CalendarDays, ListChecks, BookOpen, Palette, CheckCircle2, ChevronDown } from "lucide-react";
import { useI18n } from "@/hooks/use-i18n";
import { Link } from "react-router-dom";
import { householdSetup, setupSteps } from "@/lib/household-setup";
import { useFamily } from "@/contexts/FamilyContext";
import { useApp } from "@/contexts/AppContext";
import { PageHeading } from "@/components/FamilyPlanner";
import { Button } from "@/components/ui/button";

export default function Onboarding() {
  const { t } = useI18n();
  const { haUrl, homeOnline, currentHome } = useApp();
  const family = useFamily();
  const { members, hasTimetable, timetables, timetableSettings } = family;
  const complete = householdSetup(homeOnline, currentHome.entities, family);
  const timetableComplete = members.some(person => hasTimetable(person.id) && (timetables[person.id]?.length || timetableSettings[person.id]?.type === "calendar"));
  const next = setupSteps.find(step => !complete[step.id]);
  return <div className="planner-page mx-auto max-w-4xl">
    <PageHeading title={t("Get started")} description={t("Connect your home, then choose what your household shares.")} />
    <div className="setup-next"><p>{t("{done} of {total} setup steps complete", { done: setupSteps.filter(step => complete[step.id]).length, total: setupSteps.length })}</p>
      {next ? <><p className="page-note">{t(next.title)}</p><Button asChild><Link to={next.to}>{t("Continue setup")}</Link></Button></> : <p>{t("Your household basics are ready. Timetables are optional.")}</p>}
    </div>
    <ol className="space-y-5" aria-label={t("Household setup")}>
      <li className="glow-panel setup-step" id="connection"><details open={!complete.connection}>
        <summary><PanelTitle icon={Wifi}>{t("1. Connect Home Assistant")}</PanelTitle><span className="setup-step-state">{complete.connection ? <><CheckCircle2 size={18} aria-hidden="true" />{t("Complete")}</> : <ChevronDown size={18} aria-hidden="true" />}</span></summary><div className="space-y-3">
        <p className="page-note">{t("Set your Home Assistant address and token in the HAOS app’s Configuration tab, or the dashboard server’s .env file. The token stays on the server.")}</p>
        <p className="page-note">{t("Every screen uses that account’s permissions. Unless dashboard login is disabled, sign in as “dashboard” with your shared password.")}</p>
        <p role="status">{homeOnline ? t("Home Assistant connected") : t("Home Assistant not connected")}</p>
        <Link className="text-link" to="/settings/connection">{t("Connection settings")}</Link>
      </div>
      </details></li>
      <li className="glow-panel setup-step" id="people"><details open={!complete.people}>
        <summary><PanelTitle icon={Users}>{t("2. Add your people")}</PanelTitle><span className="setup-step-state">{complete.people ? <><CheckCircle2 size={18} aria-hidden="true" />{t("Complete")}</> : <ChevronDown size={18} aria-hidden="true" />}</span></summary><div className="space-y-3">
        <p className="page-note">{t("Create people in Home Assistant, then choose their order and visibility in Home settings. Hiding someone keeps their saved settings.")}</p>
        <div className="flex flex-wrap gap-4">
          {haUrl && <a className="text-link" href={`${haUrl}/config/person`} target="_blank" rel="noreferrer">{t("Add people in Home Assistant")}</a>}
          <Link className="text-link" to="/settings/people">{t("Choose people")}</Link>
        </div>
      </div>
      </details></li>
      <li className="glow-panel setup-step" id="calendars"><details open={!complete.calendars}>
        <summary><PanelTitle icon={CalendarDays}>{t("3. Choose calendars")}</PanelTitle><span className="setup-step-state">{complete.calendars ? <><CheckCircle2 size={18} aria-hidden="true" />{t("Complete")}</> : <ChevronDown size={18} aria-hidden="true" />}</span></summary><div className="space-y-3">
        <p className="page-note">{t("Add a calendar integration in Home Assistant and assign calendars to your Home Assistant people. Plans and edits are saved to the source calendar when it supports them.")}</p>
        <div className="flex flex-wrap gap-4">
          {haUrl && <a className="text-link" href={`${haUrl}/config/integrations`} target="_blank" rel="noreferrer">{t("Add a calendar integration")}</a>}
          <Link className="text-link" to="/settings/calendars">{t("Choose calendars")}</Link>
        </div>
      </div>
      </details></li>
      <li className="glow-panel setup-step" id="lists"><details open={!complete.lists}>
        <summary><PanelTitle icon={ListChecks}>{t("4. Choose lists")}</PanelTitle><span className="setup-step-state">{complete.lists ? <><CheckCircle2 size={18} aria-hidden="true" />{t("Complete")}</> : <ChevronDown size={18} aria-hidden="true" />}</span></summary><div className="space-y-3">
        <p className="page-note">{t("Add Local to-do or Shopping list integrations in Home Assistant. Choose task and daily lists for each person, plus a shared shopping list. Changes update Home Assistant.")}</p>
        <p className="page-note">{t("Daily lists need a Home Assistant automation to reset them each morning.")}</p>
        <div className="flex flex-wrap gap-4">
          {haUrl && <a className="text-link" href={`${haUrl}/config/integrations`} target="_blank" rel="noreferrer">{t("Add a to-do integration")}</a>}
          <Link className="text-link" to="/settings/lists">{t("Choose lists")}</Link>
        </div>
      </div>
      </details></li>
      <li className="glow-panel setup-step" id="timetables"><details open={!timetableComplete}>
        <summary><PanelTitle icon={BookOpen}>{t("5. Add school timetables ")}<span className="text-sm text-muted-foreground">{t("Optional")}</span></PanelTitle><span className="setup-step-state">{timetableComplete ? <><CheckCircle2 size={18} aria-hidden="true" />{t("Complete")}</> : <ChevronDown size={18} aria-hidden="true" />}</span></summary><div className="space-y-3">
        <p className="page-note">{t("Enable Timetable for the people who need it, then choose PDF / images or Calendars in Settings → Timetables. Read the result on School or the dashboard.")}</p>
        <div className="flex flex-wrap gap-4">
          <Link className="text-link" to="/settings/timetables">{t("Configure timetables")}</Link>
          <Link className="text-link" to="/school">{t("Open School board")}</Link>
        </div>
      </div>
      </details></li>
    </ol>
    <section className="glow-panel space-y-3">
      <PanelTitle icon={Palette}>{t("Make it yours")}</PanelTitle>
      <p className="page-note">{t("Use the settings cog beside Home favorites on Today to pick favorite devices and scenes. App preferences holds appearance settings, dark timetables and backups. Settings are shared across your household’s screens.")}</p>
      <Link className="text-link" to="/settings/appearance">{t("App preferences")}</Link>
    </section>
    <div className="flex flex-wrap items-center gap-4">
      <Button asChild><Link to="/">{t("Go to Today")}</Link></Button>
      <span className="text-sm text-muted-foreground">{t("Return here anytime from the settings menu.")}</span>
    </div>
  </div>;
}
