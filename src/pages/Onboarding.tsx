import { useI18n } from "@/hooks/use-i18n";
import { Link } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import { PageHeading } from "@/components/FamilyPlanner";
import { Button } from "@/components/ui/button";

export default function Onboarding() {
  const { t } = useI18n();
  const { haUrl, homeOnline } = useApp();
  return <div className="planner-page mx-auto max-w-4xl">
    <PageHeading title={t("Get started")} description={t("Connect your home, then choose what your household shares.")} />
    <ol className="space-y-5" aria-label={t("Household setup")}>
      <li className="glow-panel space-y-3" id="connection">
        <h2>{t("1. Connect Home Assistant")}</h2>
        <p className="page-note">{t("Set your Home Assistant address and token in the HAOS app’s Configuration tab, or the dashboard server’s .env file. The token stays on the server.")}</p>
        <p className="page-note">{t("Every screen uses that account’s permissions. Unless dashboard login is disabled, sign in as “dashboard” with your shared password.")}</p>
        <p role="status">{homeOnline ? t("Home Assistant connected") : t("Home Assistant not connected")}</p>
        <Link className="text-link" to="/settings#connection">{t("Connection settings")}</Link>
      </li>
      <li className="glow-panel space-y-3" id="people">
        <h2>{t("2. Add your people")}</h2>
        <p className="page-note">{t("Create people in Home Assistant, then choose their order and visibility in Home settings. Hiding someone keeps their saved settings.")}</p>
        <div className="flex flex-wrap gap-4">
          {haUrl && <a className="text-link" href={`${haUrl}/config/person`} target="_blank" rel="noreferrer">{t("Add people in Home Assistant")}</a>}
          <Link className="text-link" to="/settings#people-order">{t("Choose people")}</Link>
        </div>
      </li>
      <li className="glow-panel space-y-3" id="calendars">
        <h2>{t("3. Choose calendars")}</h2>
        <p className="page-note">{t("Add a calendar integration in Home Assistant and assign calendars to your Home Assistant people. Plans and edits are saved to the source calendar when it supports them.")}</p>
        <div className="flex flex-wrap gap-4">
          {haUrl && <a className="text-link" href={`${haUrl}/config/integrations`} target="_blank" rel="noreferrer">{t("Add a calendar integration")}</a>}
          <Link className="text-link" to="/settings#family-calendar">{t("Choose calendars")}</Link>
        </div>
      </li>
      <li className="glow-panel space-y-3" id="lists">
        <h2>{t("4. Choose lists")}</h2>
        <p className="page-note">{t("Add Local to-do or Shopping list integrations in Home Assistant. Choose task and daily lists for each person, plus a shared shopping list. Changes update Home Assistant.")}</p>
        <p className="page-note">{t("Daily lists need a Home Assistant automation to reset them each morning.")}</p>
        <div className="flex flex-wrap gap-4">
          {haUrl && <a className="text-link" href={`${haUrl}/config/integrations`} target="_blank" rel="noreferrer">{t("Add a to-do integration")}</a>}
          <Link className="text-link" to="/settings#family-lists">{t("Choose lists")}</Link>
        </div>
      </li>
      <li className="glow-panel space-y-3" id="timetables">
        <h2>{t("5. Add school timetables ")}<span className="text-sm text-muted-foreground">{t("Optional")}</span></h2>
        <p className="page-note">{t("Enable Timetable for the people who need it, then choose PDF / images or Calendars in Settings → Timetables. Read the result on School or the dashboard.")}</p>
        <div className="flex flex-wrap gap-4">
          <Link className="text-link" to="/settings#timetables">{t("Configure timetables")}</Link>
          <Link className="text-link" to="/school">{t("Open School board")}</Link>
        </div>
      </li>
    </ol>
    <section className="glow-panel space-y-3">
      <h2>{t("Make it yours")}</h2>
      <p className="page-note">{t("Use the settings cog beside Home favorites on Today to pick favorite devices and scenes. App preferences holds appearance settings, dark timetables and backups. Settings are shared across your household’s screens.")}</p>
      <Link className="text-link" to="/user-settings">{t("App preferences")}</Link>
    </section>
    <div className="flex flex-wrap items-center gap-4">
      <Button asChild><Link to="/">{t("Go to Today")}</Link></Button>
      <span className="text-sm text-muted-foreground">{t("Return here anytime from the settings menu.")}</span>
    </div>
  </div>;
}
