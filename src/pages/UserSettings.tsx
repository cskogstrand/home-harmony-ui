import { useApp } from "@/contexts/AppContext";
import { useFamily } from "@/contexts/FamilyContext";
import { PageHeading, PanelHeading } from "@/components/FamilyPlanner";
import { Switch } from "@/components/ui/switch";
import { ConfigurationBackup } from "@/components/ConfigurationBackup";
export default function UserSettings() {
  const { currentUser } = useApp();
  const { appearance, setAppearance } = useFamily();
  return <div className="planner-page">
    <PageHeading eyebrow="MAKE YOURSELF AT HOME" title="Settings" />
    <section className="glow-panel"><PanelHeading title="Home Assistant account" /><p>{currentUser?.name ?? "Not signed in"}</p></section>
    <section className="glow-panel space-y-4"><PanelHeading title="Appearance" /><label className="flex justify-between">Dark mode<Switch checked={appearance.theme === "dark"} onCheckedChange={v => setAppearance({ theme: v ? "dark" : "light" })} aria-label="Toggle dark mode" /></label><label className="flex justify-between">Dark timetables<Switch checked={appearance.darkTimetables} onCheckedChange={v => setAppearance({ darkTimetables: v })} aria-label="Toggle dark timetables" aria-describedby="dark-timetables-description" /></label><p id="dark-timetables-description" className="page-note">Dark backgrounds for PDF timetables. Linked images keep their colors.</p><label className="flex justify-between">Compact mode<Switch checked={appearance.compactMode} onCheckedChange={v => setAppearance({ compactMode: v })} aria-label="Toggle compact mode" /></label></section>
    <ConfigurationBackup />
  </div>;
}
