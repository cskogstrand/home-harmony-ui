import { useApp } from "@/contexts/AppContext";
import { useFamily } from "@/contexts/FamilyContext";
import { PageHeading, PanelHeading } from "@/components/FamilyPlanner";
import { Switch } from "@/components/ui/switch";
import { ConfigurationBackup } from "@/components/ConfigurationBackup";
import { useSharedConfiguration } from "@/contexts/SharedConfigurationContext";
export default function UserSettings() {
  const { currentUser } = useApp();
  const { appearance, setAppearance } = useFamily();
  const shared = useSharedConfiguration();
  return <div className="planner-page">
    <PageHeading eyebrow="MAKE YOURSELF AT HOME" title="Settings" description="Account and app preferences" />
    <section className="glow-panel"><PanelHeading title="Home Assistant account" /><p>{currentUser?.name ?? "Not signed in"}</p><p className="page-note">Every screen uses the account configured on the dashboard server.</p></section>
    <section className="glow-panel space-y-4"><PanelHeading title="Appearance" /><p className="page-note">Appearance is saved with your app settings.</p><label className="flex justify-between">Dark mode<Switch checked={appearance.theme === "dark"} onCheckedChange={v => setAppearance({ theme: v ? "dark" : "light" })} aria-label="Toggle dark mode" /></label><label className="flex justify-between">Compact mode<Switch checked={appearance.compactMode} onCheckedChange={v => setAppearance({ compactMode: v })} aria-label="Toggle compact mode" /></label></section>
    <section className="glow-panel"><PanelHeading title="Shared app settings" /><p className="page-note">Every screen on this app server uses the same settings. Home Assistant owns the calendars, lists, people and device state.</p></section>
    <ConfigurationBackup />
  </div>;
}
