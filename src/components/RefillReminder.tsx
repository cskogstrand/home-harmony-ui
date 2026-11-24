import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { ShoppingBasket } from "lucide-react";
import { notificationRuleSchema } from "../../shared/notifications";
import { newPlannerId, useFamily } from "@/contexts/FamilyContext";
import { useApp } from "@/contexts/AppContext";
import { useI18n } from "@/hooks/use-i18n";
import { available, entityStateLabel, stringValues, supportsAction } from "@/lib/ha-model";
import { EntityPicker } from "./EntityPicker";
import { Button } from "./ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";

export function RefillReminder({ disabled }: { disabled: boolean }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button variant="outline" className="justify-self-start" disabled={disabled}><ShoppingBasket aria-hidden="true" />{t("Create refill alert")}</Button></DialogTrigger>
    <DialogContent className="refill-dialog">
      <DialogHeader><DialogTitle>{t("Create refill alert")}</DialogTitle><DialogDescription>{t("When the sensor reports a refill is needed, the alert lets you add the item to your shopping list.")}</DialogDescription></DialogHeader>
      <RefillForm disabled={disabled} onSaved={() => setOpen(false)} />
    </DialogContent>
  </Dialog>;
}

function RefillForm({ disabled, onSaved }: { disabled: boolean; onSaved: () => void }) {
  const { t, language } = useI18n();
  const { currentHome, homeOnline, services } = useApp();
  const { todoLists, notifications, setNotifications } = useFamily();
  const sensors = currentHome.entities.filter(entity => entity.domain === "binary_sensor" || entity.domain === "sensor");
  const lists = currentHome.entities.filter(entity => entity.domain === "todo" && todoLists[entity.preferenceId]?.kind === "shopping");
  const writable = lists.filter(entity => available(entity) && supportsAction(entity, "add_item", services));
  const readingHint = useId();
  const [sourceId, setSource] = useState("");
  const [value, setValue] = useState("");
  const [item, setItem] = useState("");
  const [listId, setList] = useState(writable.length === 1 ? writable[0].preferenceId : "");
  const [failed, setFailed] = useState(false);
  const source = sensors.find(entity => entity.preferenceId === sourceId);
  const choices = source?.domain === "binary_sensor" ? ["on", "off"] : stringValues(source?.attributes.options);
  const numeric = source && !choices.length && (typeof source.attributes.unit_of_measurement === "string" || source.state.trim() !== "" && Number.isFinite(Number(source.state)));
  const triggerValue = numeric ? value.trim().replace(",", ".") : value.trim();
  const ready = !disabled && homeOnline && source && triggerValue && (!choices.length || choices.includes(value))
    && (!numeric || Number.isFinite(Number(triggerValue))) && item.trim() && writable.some(list => list.preferenceId === listId);
  const save = () => {
    if (!ready) return;
    const result = notificationRuleSchema.safeParse({ id: newPlannerId(), kind: "current", title: t("Refill {item}", { item: item.trim() }).slice(0, 100),
      trigger: { type: "state", entity: sourceId, operator: numeric ? "lt" : "eq", value: triggerValue }, shoppingAction: { list: listId, item } });
    if (result.success && setNotifications({ rules: [...notifications.rules, result.data] })) onSaved();
    else setFailed(true);
  };
  if (!homeOnline) return <p className="page-note">{t("Reconnect Home Assistant to choose a refill sensor and shopping list.")}</p>;
  if (!writable.length) return <div className="grid justify-items-start gap-2"><p>{t("A refill alert needs a shopping list that accepts new items.")}</p><Link className="text-link min-h-11" to="/settings/lists">{t("Set up shopping lists")}</Link></div>;
  return <form onSubmit={event => { event.preventDefault(); save(); }}>
    <div className="planner-form dialog-form-body">
      <div>
        <EntityPicker label={t("Refill sensor")} placeholder={t("Choose a sensor")} describedBy={source ? readingHint : undefined} entities={sensors} value={sourceId} onChange={id => { setSource(id); setValue(""); }} />
        {source && <small id={readingHint} className="mt-1 block text-muted-foreground">{t("Reported state: {state}", { state: source.state })}</small>}
      </div>
      {source && <label>{numeric ? [t("Alert below"), source.attributes.unit_of_measurement].filter(Boolean).join(" · ") : t("Value that triggers the alert")}{choices.length
          ? <select required value={value} onChange={event => setValue(event.target.value)}><option value="">{t("Choose a state")}</option>{choices.map(option => <option key={option} value={option}>{entityStateLabel({ ...source, state: option }, language)}</option>)}</select>
          : <input required inputMode={numeric ? "decimal" : "text"} maxLength={256} value={value} onChange={event => setValue(event.target.value)} />}</label>}
      <label>{t("Item")}<input required maxLength={120} placeholder={t("For example, rinse aid")} value={item} onChange={event => setItem(event.target.value)} /></label>
      <EntityPicker label={t("Shopping list")} entities={writable} value={listId} onChange={setList} />
    </div>
    {failed && <p role="alert">{t("Configuration could not be saved.")}</p>}
    <div className="form-actions"><DialogClose asChild><Button type="button" variant="ghost">{t("Cancel")}</Button></DialogClose><Button type="submit" disabled={!ready}>{t("Save notification")}</Button></div>
  </form>;
}
