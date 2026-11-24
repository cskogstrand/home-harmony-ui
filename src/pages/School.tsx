import { useId } from "react";
import { NotificationList } from "@/components/NotificationCenter";
import { PlannerCardBackdrop, PlannerCardIcon } from "@/components/CardArtwork";
import { HomeworkList } from "@/components/HomeworkList";
import { ListPanel } from "@/components/FamilyLists";
import { Link, useSearchParams } from "react-router-dom";
import { BookOpen, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/hooks/use-i18n";
import { useFamily } from "@/contexts/FamilyContext";
import { PageHeading, SchoolPreview, MemberAvatar } from "@/components/FamilyPlanner";

export default function School() {
  const { t } = useI18n();
  const { members, hasTimetable, timetableSettings } = useFamily();
  const [params] = useSearchParams();
  const timetableId = useId();
  if (params.get("tab") === "homework") return <div className="planner-page">
    <PageHeading title={t("School")}><Link className="text-link" to="/school">{t("Timetables")}</Link></PageHeading>
    <NotificationList compact />
    <section className="glow-panel list-viewport"><ListPanel kind="homework" /></section>
  </div>;
  const people = members.filter(member => hasTimetable(member.id));
  return <div className="planner-page"><PageHeading title={t("School")}>
    {people.length > 1 && <form className="school-person-jump" onSubmit={event => {
      event.preventDefault();
      const person = new FormData(event.currentTarget).get("person");
      const heading = document.getElementById(`${timetableId}-${person}`);
      heading?.focus({ preventScroll: true });
      heading?.scrollIntoView?.({ block: "start" });
    }}>
      <label htmlFor={timetableId}>{t("Go to person")}</label>
      <div className="flex min-w-0 gap-2"><select id={timetableId} name="person" required defaultValue="">
        <option value="" disabled>{t("Choose a person")}</option>
        {people.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
      </select><Button type="submit" size="icon" variant="outline" aria-label={t("Go to timetable")}><ArrowRight aria-hidden="true" /></Button></div>
    </form>}
  </PageHeading>
    <NotificationList compact />
    {!people.length && <section className="glow-panel"><p>{t("No timetables enabled.")}</p><Link className="text-link" to="/settings/people">{t("Enable timetables")}</Link></section>}
    <div className="school-cards">{people.map(person => <article key={person.id} className={`glow-panel school-card${timetableSettings[person.id]?.type === "calendar" ? " glass-surface" : ""}`}>
      <PlannerCardBackdrop kind="school" />
      <div className="panel-heading"><div className="school-child"><MemberAvatar member={person.id} /><h2 id={`${timetableId}-${person.id}`} tabIndex={-1}>{timetableSettings[person.id]?.type === "calendar" ? t("Activities for {name}", { name: person.name }) : t(timetableSettings[person.id]?.education === "kindergarten" ? "{value1}’s kindergarten week" : "{value1}’s school week", { value1: person.name })}</h2></div><PlannerCardIcon kind="school"><BookOpen size={24} aria-hidden="true" /></PlannerCardIcon></div>
      <SchoolPreview child={person.id} dayView />
      <HomeworkList member={person.id} />
    </article>)}</div>
  </div>;
}
