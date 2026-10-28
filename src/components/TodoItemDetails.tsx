import { differenceInCalendarDays, parseISO } from "date-fns";
import { useI18n } from "@/hooks/use-i18n";
import { useFamily } from "@/contexts/FamilyContext";
import { useApp } from "@/contexts/AppContext";
import { feature } from "@/lib/ha-model";
import { todoDueInput, type TodoDetails } from "@/lib/todo-items";
import type { Entity, TodoItem } from "@/types/api";

export function TodoDueLabel({ due, complete }: { due: TodoItem["due"]; complete: boolean }) {
  const { t, dateLabel } = useI18n();
  const { today } = useFamily();
  const { currentHome } = useApp();
  const date = todoDueInput(due, currentHome.timeZone).slice(0, 10);
  if (!date) return null;
  const days = differenceInCalendarDays(parseISO(date), parseISO(today));
  const label = days === 0 ? t("Today") : days === 1 ? t("Tomorrow") : days > 1 && days <= 6 ? dateLabel(date, { weekday: "long" })
    : dateLabel(date, { day: "numeric", month: "short", ...(date.slice(0, 4) !== today.slice(0, 4) ? { year: "numeric" } : {}) });
  const overdue = !complete && days < 0;
  const full = dateLabel(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return <time className="todo-due" dateTime={due} data-state={overdue ? "overdue" : days === 0 ? "today" : days === 1 ? "tomorrow" : "upcoming"}
    aria-label={t(overdue ? "Overdue: {date}" : "Due: {date}", { date: full })} title={full}>{overdue && <span className="sr-only">{t("Overdue")}: </span>}{label}</time>;
}

export function TodoItemFields({ value, onChange, entity, disabled }: { value: TodoDetails; onChange: (value: TodoDetails) => void; entity: Entity; disabled?: boolean }) {
  const { t } = useI18n();
  const dateSupported = feature(entity, 16), timeSupported = feature(entity, 32), descriptionSupported = feature(entity, 64);
  const date = value.due.slice(0, 10), time = value.due.split("T")[1] ?? "";
  return <div className="todo-item-fields planner-form">
    <label>{t("Due date")}<input type="date" value={date} disabled={disabled || !dateSupported && !timeSupported}
      onChange={event => onChange({ ...value, due: event.target.value ? `${event.target.value}${time ? `T${time}` : dateSupported ? "" : "T00:00:00"}` : "" })} />
      {!dateSupported && !timeSupported && <span className="muted">{t("This list does not support due dates.")}</span>}
    </label>
    {timeSupported && date && <label>{t(dateSupported ? "Time (optional)" : "Time")}<input type="time" step="1" value={time} disabled={disabled} required={!dateSupported}
      onChange={event => onChange({ ...value, due: `${date}${event.target.value ? `T${event.target.value}` : dateSupported ? "" : "T00:00:00"}` })} /></label>}
    <label className="todo-description-field">{t("Description")}<textarea rows={3} value={value.description} disabled={disabled || !descriptionSupported}
      onChange={event => onChange({ ...value, description: event.target.value })} />
      {!descriptionSupported && <span className="muted">{t("This list does not support descriptions.")}</span>}
    </label>
  </div>;
}
