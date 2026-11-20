import { NotificationList } from "@/components/NotificationCenter";
import { PlannerCardBackdrop, PlannerCardIcon } from "@/components/CardArtwork";
import { HomeworkList } from "@/components/HomeworkList";
import { ListPanel } from "@/components/FamilyLists";
import { Link, useSearchParams } from "react-router-dom";
import { BookOpen } from "lucide-react";
import { useI18n } from "@/hooks/use-i18n";
import { useFamily } from "@/contexts/FamilyContext";
import { PageHeading, SchoolPreview, MemberAvatar } from "@/components/FamilyPlanner";

export default function School() {
  const { t } = useI18n();
  const { members, hasTimetable, timetableSettings } = useFamily();
  const [params] = useSearchParams();
  if (params.get("tab") === "homework") return <div className="planner-page">
    <PageHeading title={t("School")}><Link className="text-link" to="/school">{t("Timetables")}</Link></PageHeading>
    <NotificationList compact />
    <section className="glow-panel list-viewport"><ListPanel kind="homework" /></section>
  </div>;
  const people = members.filter(member => hasTimetable(member.id));
  return <div className="planner-page"><PageHeading title={t("School")} />
    <NotificationList compact />
    {!people.length && <section className="glow-panel"><p>{t("No timetables enabled.")}</p><Link className="text-link" to="/settings/people">{t("Enable timetables")}</Link></section>}
    <div className="school-cards">{people.map(person => <article key={person.id} className={`glow-panel school-card${timetableSettings[person.id]?.type === "calendar" ? " glass-surface" : ""}`}>
      <PlannerCardBackdrop kind="school" />
      <div className="panel-heading"><div className="school-child"><MemberAvatar member={person.id} /><h2>{timetableSettings[person.id]?.type === "calendar" ? t("Activities for {name}", { name: person.name }) : t(timetableSettings[person.id]?.education === "kindergarten" ? "{value1}’s kindergarten week" : "{value1}’s school week", { value1: person.name })}</h2></div><PlannerCardIcon kind="school"><BookOpen size={24} aria-hidden="true" /></PlannerCardIcon></div>
      <SchoolPreview child={person.id} dayView />
      <HomeworkList member={person.id} />
    </article>)}</div>
  </div>;
}
