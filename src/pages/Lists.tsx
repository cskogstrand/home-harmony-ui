import { useI18n } from "@/hooks/use-i18n";
import { useSearchParams } from "react-router-dom";
import { PageHeading } from "@/components/FamilyPlanner";
import { ListPanel } from "@/components/FamilyLists";
import { useFamily, itemIsDone, type ListKind } from "@/contexts/FamilyContext";
import { useApp } from "@/contexts/AppContext";
import { available } from "@/lib/ha-model";
const tabs: { id: ListKind; name: string }[] = [{ id: "daily", name: "Daily rhythm" }, { id: "shopping", name: "Shopping" }, { id: "tasks", name: "Family tasks" }];
export default function Lists() {
  const { t, message } = useI18n();
  const [params, setParams] = useSearchParams();
  const { items, today, connectedPlanner, todoLists, isMemberVisible } = useFamily();
  const { currentHome, homeOnline } = useApp();
  const count = (kind: ListKind) => {
    if (!connectedPlanner) return items.filter(i => i.kind === kind && isMemberVisible(i.member) && !itemIsDone(i, today)).length;
    const lists = Object.entries(todoLists).filter(([, assigned]) => assigned.kind === kind && isMemberVisible(assigned.member)).map(([id]) => currentHome.entities.find(e => e.domain === "todo" && e.preferenceId === id));
    return homeOnline && lists.length && lists.every(e => e && available(e) && /^\d+$/.test(e.state)) ? lists.reduce((sum, e) => sum + Number(e.state), 0) : "—";
  };
  const selected = tabs.find(t => t.id === params.get("tab"))?.id ?? "shopping";
  return <div className="planner-page lists-page"><PageHeading title={t("Lists")} />
    <div className="list-tabs" role="group" aria-label={t("Family lists")}>{tabs.map(tab => <button aria-pressed={tab.id === selected} aria-controls={`list-${tab.id}`} id={`tab-${tab.id}`} key={tab.id} onClick={() => setParams({ tab: tab.id })}>{message(tab.name)}<span>{count(tab.id)}</span></button>)}</div>
    <section aria-labelledby={`tab-${selected}`} id={`list-${selected}`}><ListPanel key={selected} kind={selected} /></section>
  </div>;
}
