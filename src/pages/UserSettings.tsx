import { useApp } from "@/contexts/AppContext";
import { useFamily } from "@/contexts/FamilyContext";
import { PageHeading, PanelHeading } from "@/components/FamilyPlanner";
import { Switch } from "@/components/ui/switch";
import { ConfigurationBackup } from "@/components/ConfigurationBackup";
import { useSharedConfiguration } from "@/contexts/SharedConfigurationContext";
export default function UserSettings() {
  const { currentUser } = useApp();
  const { plannerId, plannerIds, selectPlanner, appearance, setAppearance } = useFamily();
  const shared = useSharedConfiguration();
  return <div className="planner-page">
    <PageHeading eyebrow="MAKE YOURSELF AT HOME" title="Settings" description="Account and app preferences" />
    <section className="glow-panel"><PanelHeading title="Home Assistant account" /><p>{currentUser?.name ?? "Not signed in"}</p><p className="page-note">Home Assistant verifies access. Each screen keeps its own login.</p></section>
    <section className="glow-panel space-y-4"><PanelHeading title="Appearance" /><p className="page-note">Appearance is saved with your app settings.</p><label className="flex justify-between">Dark mode<Switch checked={appearance.theme === "dark"} onCheckedChange={v => setAppearance({ theme: v ? "dark" : "light" })} aria-label="Toggle dark mode" /></label><label className="flex justify-between">Compact mode<Switch checked={appearance.compactMode} onCheckedChange={v => setAppearance({ compactMode: v })} aria-label="Toggle compact mode" /></label></section>
    <section className="glow-panel"><PanelHeading title={shared?.enabled ? "Shared app settings" : "Local family planner"} /><label>Saved planner <select aria-label="Saved local planner" className="rounded border bg-background p-2" value={plannerId} onChange={e => selectPlanner(e.target.value)}>{plannerIds.map(id => <option key={id} value={id}>{id}</option>)}</select></label><p className="page-note">{shared?.enabled ? "Every screen on this app server uses these settings. Home Assistant owns the calendars, lists, people and device state." : "Each Home Assistant instance has a separate local planner. Previous demo planners remain saved separately; their entries are not copied into the connected household. Selecting a planner does not upload its contents."}</p></section>
    <ConfigurationBackup />
  </div>;
}
