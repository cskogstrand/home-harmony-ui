import { LayoutGroup } from "framer-motion";
import { useApp } from "@/contexts/AppContext";
import { useFamily, type MemberId } from "@/contexts/FamilyContext";
import { HomeAssistantList } from "./FamilyLists";

export function HomeworkList({ member }: { member: MemberId }) {
  const { todoLists } = useFamily();
  const { haUrl } = useApp();
  const list = Object.entries(todoLists).find(([, assigned]) => assigned.kind === "homework" && assigned.member === member);
  return list ? <LayoutGroup><HomeAssistantList key={`${haUrl}|${list[0]}`} preferenceId={list[0]} member={member} kind="homework" school /></LayoutGroup> : null;
}
