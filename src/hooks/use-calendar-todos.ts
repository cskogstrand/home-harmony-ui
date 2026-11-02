import { useEffect, useState } from "react";
import { useApp } from "@/contexts/AppContext";
import { useFamily } from "@/contexts/FamilyContext";
import { available } from "@/lib/ha-model";
import { todoPlans } from "@/lib/family-calendar";
import type { TodoItem } from "@/types/api";
import { useI18n } from "./use-i18n";

export function useCalendarTodos(start: string, end: string, refresh: number) {
  const { t } = useI18n();
  const { currentHome, homeOnline, haUrl, todoItems, commands } = useApp();
  const { todoLists, members } = useFamily();
  const lists = Object.entries(todoLists).filter(([, assigned]) => assigned.kind !== "shopping" && members.some(member => member.id === assigned.member))
    .map(([id]) => ({ id, entity: currentHome.entities.find(entity => entity.domain === "todo" && entity.preferenceId === id) }));
  const sourceKey = JSON.stringify([haUrl, lists.map(({ id, entity }) => [id, entity?.entityId])]);
  const revision = JSON.stringify(lists.map(({ entity }) => [entity?.state, entity?.lastUpdated]));
  const busy = lists.some(({ entity }) => commands[entity?.entityId]?.pending);
  const [poll, setPoll] = useState(0);
  const requestKey = JSON.stringify([sourceKey, revision, refresh, poll, busy]);
  const [result, setResult] = useState<{ source: string; key: string; lists: { id: string; items: TodoItem[]; failed: boolean }[] }>({ source: "", key: "", lists: [] });
  useEffect(() => {
    if (!lists.length) { setResult(previous => previous.source ? { source: "", key: "", lists: [] } : previous); return; }
    if (!homeOnline || busy) return;
    let active = true;
    void Promise.all(lists.map(async ({ id, entity }) => {
      try {
        if (!entity || !available(entity)) throw new Error("Unavailable");
        return { id, items: await todoItems(entity.entityId), failed: false };
      } catch { return { id, items: [], failed: true }; }
    })).then(lists => { if (active) setResult(previous => ({ source: sourceKey, key: requestKey,
      lists: lists.map(list => list.failed && previous.source === sourceKey ? { ...list, items: previous.lists.find(item => item.id === list.id)?.items ?? [] } : list),
    })); });
    return () => { active = false; };
    // The keys capture the selected sources and their reported state without depending on entity object identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeOnline, busy, sourceKey, requestKey, todoItems]);
  const pending = result.key !== requestKey;
  const loading = homeOnline && lists.length > 0 && result.source !== sourceKey;
  useEffect(() => {
    if (!homeOnline || !lists.length || busy || pending) return;
    const timer = setInterval(() => setPoll(value => value + 1), 60000);
    return () => clearInterval(timer);
  }, [homeOnline, lists.length, busy, pending]);
  const current = result.source === sourceKey ? result.lists : [];
  return {
    events: current.flatMap(({ id, items }) => {
      const assigned = todoLists[id];
      const entity = lists.find(list => list.id === id)?.entity;
      return assigned && entity ? todoPlans(items, id, assigned.kind, assigned.member, start, end, currentHome.timeZone) : [];
    }),
    loading,
    errors: current.filter(list => list.failed).map(({ id }) => t("Could not read to-do list {value1}. Check it in Home Assistant.", { value1: lists.find(list => list.id === id)?.entity?.name ?? t("List unavailable") })),
  };
}
