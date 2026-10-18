import { Link } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import { PageHeading } from "@/components/FamilyPlanner";
import { Button } from "@/components/ui/button";

export default function Onboarding() {
  const { haUrl, homeOnline } = useApp();
  return <div className="planner-page mx-auto max-w-4xl">
    <PageHeading eyebrow="WELCOME TO AFTERGLOW" title="Get started" description="Connect your home, then choose what your household shares." />
    <ol className="space-y-5" aria-label="Household setup">
      <li className="glow-panel space-y-3" id="connection">
        <h2>1. Connect Home Assistant</h2>
        <p className="page-note">Set your Home Assistant address and token in the HAOS app’s Configuration tab, or the dashboard server’s .env file. The token stays on the server.</p>
        <p className="page-note">Every screen uses that account’s permissions. Unless dashboard login is disabled, sign in as “dashboard” with your shared password.</p>
        <p role="status">{homeOnline ? "Home Assistant connected" : "Home Assistant not connected"}</p>
        <Link className="text-link" to="/settings#connection">Connection settings</Link>
      </li>
      <li className="glow-panel space-y-3" id="people">
        <h2>2. Add your people</h2>
        <p className="page-note">Create people in Home Assistant, then choose their order and visibility in Home settings. Hiding someone keeps their saved settings. Everyone is the shared household row.</p>
        <div className="flex flex-wrap gap-4">
          {haUrl && <a className="text-link" href={`${haUrl}/config/person`} target="_blank" rel="noreferrer">Add people in Home Assistant</a>}
          <Link className="text-link" to="/settings#people-order">Choose people</Link>
        </div>
      </li>
      <li className="glow-panel space-y-3" id="calendars">
        <h2>3. Choose calendars</h2>
        <p className="page-note">Add a calendar integration in Home Assistant. Assign calendars to each person, or to Everyone for shared plans. Plans and edits are saved to the source calendar when it supports them.</p>
        <div className="flex flex-wrap gap-4">
          {haUrl && <a className="text-link" href={`${haUrl}/config/integrations`} target="_blank" rel="noreferrer">Add a calendar integration</a>}
          <Link className="text-link" to="/settings#family-calendar">Choose calendars</Link>
        </div>
      </li>
      <li className="glow-panel space-y-3" id="lists">
        <h2>4. Choose lists</h2>
        <p className="page-note">Add Local to-do or Shopping list integrations in Home Assistant. Choose task and daily lists for each person, plus a shared shopping list. Changes update Home Assistant.</p>
        <p className="page-note">Daily lists need a Home Assistant automation to reset them each morning.</p>
        <div className="flex flex-wrap gap-4">
          {haUrl && <a className="text-link" href={`${haUrl}/config/integrations`} target="_blank" rel="noreferrer">Add a to-do integration</a>}
          <Link className="text-link" to="/settings#family-lists">Choose lists</Link>
        </div>
      </li>
      <li className="glow-panel space-y-3" id="timetables">
        <h2>5. Add school timetables <span className="text-sm text-muted-foreground">Optional</span></h2>
        <p className="page-note">Enable Timetable for the people who need it, then upload a PDF or add image links on the School board. Swipe between pages and tap to enlarge.</p>
        <div className="flex flex-wrap gap-4">
          <Link className="text-link" to="/settings#people-order">Enable timetables</Link>
          <Link className="text-link" to="/school">Open School board</Link>
        </div>
      </li>
    </ol>
    <section className="glow-panel space-y-3">
      <h2>Make it yours</h2>
      <p className="page-note">Use Customize on Today to pick favorite devices and scenes. App preferences holds appearance settings, dark timetables and backups. Settings are shared across your household’s screens.</p>
      <Link className="text-link" to="/user-settings">App preferences</Link>
    </section>
    <div className="flex flex-wrap items-center gap-4">
      <Button asChild><Link to="/">Go to Today</Link></Button>
      <span className="text-sm text-muted-foreground">Return here anytime from the settings menu.</span>
    </div>
  </div>;
}
