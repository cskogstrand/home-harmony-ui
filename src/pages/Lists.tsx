import { useI18n } from "@/hooks/use-i18n";
import { useLayoutEffect, useRef } from "react";
import { useRevealSelection } from "@/hooks/use-reveal-selection";
import { useSearchParams } from "react-router-dom";
import { PageHeading } from "@/components/FamilyPlanner";
import { ListPanel } from "@/components/FamilyLists";
import { useFamily, itemIsDone, type TodoListKind } from "@/contexts/FamilyContext";
import { useApp } from "@/contexts/AppContext";
import { available } from "@/lib/ha-model";
const tabs: { id: TodoListKind; name: string }[] = [{ id: "daily", name: "Daily rhythm" }, { id: "shopping", name: "Shopping" }, { id: "tasks", name: "Family tasks" }, { id: "homework", name: "Homework" }];
export default function Lists() {
  const { t, message } = useI18n();
  const [params, setParams] = useSearchParams();
  const { items, today, connectedPlanner, todoLists, isMemberVisible } = useFamily();
  const { currentHome, homeOnline } = useApp();
  const count = (kind: TodoListKind) => {
    if (!connectedPlanner) return items.filter(i => i.kind === kind && (kind === "shopping" || isMemberVisible(i.member)) && !itemIsDone(i, today)).length;
    const lists = Object.entries(todoLists).filter(([, assigned]) => assigned.kind === kind && (kind === "shopping" || isMemberVisible(assigned.member))).map(([id]) => currentHome.entities.find(e => e.domain === "todo" && e.preferenceId === id));
    return homeOnline && lists.length && lists.every(e => e && available(e) && /^\d+$/.test(e.state)) ? lists.reduce((sum, e) => sum + Number(e.state), 0) : "—";
  };
  const selected = tabs.find(t => t.id === params.get("tab"))?.id ?? "shopping";
  const list = params.get("list");
  const viewport = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const frame = viewport.current;
    const panel = frame?.firstElementChild;
    if (!frame || !panel || !window.ResizeObserver) return;
    let switching = true;
    const observer = new ResizeObserver(([entry]) => {
      const height = entry.borderBoxSize?.[0]?.blockSize ?? panel.getBoundingClientRect().height;
      if (!height) return;
      if (frame.style.height !== `${height}px`) {
        frame.dataset.resize = switching ? "switch" : "items";
        frame.style.height = `${height}px`;
      }
      // A newly opened tab can render its loading state before the rows arrive.
      if (!panel.querySelector('.household-list:not([hidden])[aria-busy="true"]')) switching = false;
    });
    observer.observe(panel, { box: "border-box" });
    return () => observer.disconnect();
  }, [selected, list]);
  // A connected home only offers list kinds that have lists; Settings → To-do lists adds the rest.
  const shown = tabs.filter(tab => tab.id === selected || !connectedPlanner || !homeOnline || Object.values(todoLists).some(list => list.kind === tab.id));
  const tabList = useRevealSelection<HTMLDivElement>(selected, shown.length);
  return <div className="planner-page lists-page"><PageHeading title={t("Lists")} />
    <div ref={tabList} className="list-tabs" role="group" aria-label={t("Family lists")}>{shown.map(tab => <button aria-pressed={tab.id === selected} aria-controls={`list-${tab.id}`} id={`tab-${tab.id}`} key={tab.id} onClick={() => setParams({ tab: tab.id })}>{message(tab.name)} <span>{count(tab.id)}</span></button>)}</div>
    <section ref={viewport} className="glow-panel list-viewport" aria-labelledby={`tab-${selected}`} id={`list-${selected}`}><ListPanel key={selected} kind={selected} /></section>
  </div>;
}
