import { BookOpen } from "lucide-react";
import { useI18n } from "@/hooks/use-i18n";
import { useFamily } from "@/contexts/FamilyContext";
import { PageHeading, SchoolPreview, MemberAvatar } from "@/components/FamilyPlanner";

export default function School() {
  const { t } = useI18n();
  const { members, hasTimetable, timetableSettings } = useFamily();
  const people = members.filter(member => hasTimetable(member.id));
  return <div className="planner-page"><PageHeading title={t("School")} />
    {!people.length && <section className="glow-panel"><p>{t("No timetables enabled.")}</p><p className="muted">{t("Enable and configure timetables in Settings → Timetables.")}</p></section>}
    <div className="school-cards">{people.map(person => <article key={person.id} className={`glow-panel school-card${timetableSettings[person.id]?.type === "calendar" ? " glass-surface" : ""}`}>
      <div className="panel-heading"><div className="school-child"><MemberAvatar member={person.id} /><h2>{timetableSettings[person.id]?.type === "calendar" ? t("Today's activities for {name}", { name: person.name }) : t(timetableSettings[person.id]?.education === "kindergarten" ? "{value1}’s kindergarten week" : "{value1}’s school week", { value1: person.name })}</h2></div><BookOpen size={24} aria-hidden="true" /></div>
      <SchoolPreview child={person.id} todayOnly />
    </article>)}</div>
  </div>;
}
