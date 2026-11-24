import { msg, type Message } from "@/lib/i18n";
import { useI18n } from "@/hooks/use-i18n";
import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowUp, X, CloudSun, Wifi, Users, BookOpen, CalendarDays, ListChecks, House, Trash2, Eye, SlidersHorizontal } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useFamily, type TodoListKind } from "@/contexts/FamilyContext";
import { SettingsPanels } from "@/components/SettingsPanels";
import { PanelTitle } from "@/components/PanelTitle";
import { MemberAvatar, PanelHeading } from "@/components/FamilyPlanner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { MemberColorPicker } from "@/components/MemberColorPicker";
import { ShoppingListIconPicker } from "@/components/ShoppingListIcon";
import { TimetableAdministration } from "@/components/TimetableAdministration";
import { EntityPicker } from "@/components/EntityPicker";
import { Checkbox } from "@/components/ui/checkbox";
import { isTemperatureEntity } from "@/lib/ha-model";
import { defaultTodoDisplay, type TodoDisplay } from "../../shared/configuration";
import { useSharedConfiguration } from "@/contexts/SharedConfigurationContext";
function ShoppingShortcuts({ items, save }: { items: string[]; save: (items: string[]) => boolean }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState("");
  const name = draft.trim();
  const duplicate = items.some(item => item.toLowerCase() === name.toLowerCase());
  return <form className="planner-form grid gap-2" onSubmit={event => {
    event.preventDefault();
    if (name && !duplicate && items.length < 30 && save([...items, name])) setDraft("");
  }}>
    <label>{t("Frequent items")}<input maxLength={120} value={draft} placeholder={t("Item name")} onChange={event => setDraft(event.target.value)} /></label>
    <Button className="justify-self-start" variant="outline" type="submit" disabled={!name || duplicate || items.length >= 30}>{t("Add shortcut")}</Button>
    {duplicate && <p className="page-note" role="status">{t("This shortcut already exists.")}</p>}
    {items.length >= 30 && <p className="page-note">{t("All 30 shortcuts are in use.")}</p>}
    {!!items.length && <ul className="flex flex-wrap gap-2">{items.map(item => <li className="min-w-0 max-w-full" key={item}><Button className="h-auto min-h-11 max-w-full whitespace-normal" type="button" variant="secondary" aria-label={t("Remove shortcut for {item}", { item })} onClick={() => save(items.filter(value => value !== item))}><span className="break-all">{item}</span><X size={16} aria-hidden="true" /></Button></li>)}</ul>}
  </form>;
}

export default function HomeSettings({ section, guided = false }: { guided?: boolean; section: "connection" | "people" | "timetables" | "calendars" | "lists" | "weather" }) {
  const { t, message } = useI18n();
  const { haUrl, connect, disconnect, connectionStatus, connectionError, currentHome, currentUser, metadataWarnings, homeOnline } = useApp();
  const { allMembers: members, memberName, moveMember, compareMembers, isMemberVisible, setMemberVisible, hasTimetable, setTimetableEnabled, calendarMembers, setCalendarMember, wasteCalendarEntity, todoLists, setTodoList, setTodoListDisplay, weatherEntity, setWeatherEntity, weatherTemperatureEntity, setWeatherTemperatureEntity, weatherPlacement, setWeatherPlacement } = useFamily();
  const shared = useSharedConfiguration();
  const sharedUnavailable = !shared?.state.loaded || !!shared.state.error;
  const assignmentsDisabled = !homeOnline || sharedUnavailable;
  const calendars = currentHome.entities.filter(e => e.domain === "calendar");
  const wasteCalendar = calendars.find(calendar => calendar.preferenceId === wasteCalendarEntity);
  const wasteMember = calendarMembers[wasteCalendarEntity] ?? "";
  const activeMembers = members.filter(person => isMemberVisible(person.id));
  const calendarPeople = guided ? activeMembers : members;
  const lists = currentHome.entities.filter(e => e.domain === "todo");
  const listPeople = [...members, ...[...new Set(Object.values(todoLists).filter(assigned => assigned.kind !== "shopping").map(assigned => assigned.member))]
    .filter(id => id !== "everyone" && !members.some(person => person.id === id)).map(id => ({ id, name: t("Person unavailable") }))].sort((a, b) => compareMembers(a.id, b.id));
  const [confirmation, setConfirmation] = useState<{ title: Message; description: Message; confirmLabel: Message; onConfirm: () => void | Promise<void>; requiresConnection?: boolean }>();
  const busy = ["connecting", "syncing"].includes(connectionStatus);
  const listLabels = { tasks: "Tasks", daily: "Daily tasks", shopping: "Shared shopping list", homework: "Homework" } as const;
  const memberMessage = (id: string, kind?: TodoListKind) => kind === "shopping" ? msg("Household") : members.find(person => person.id === id)?.name ?? msg("Person unavailable");
  const changeList = (kind: TodoListKind, person: { id: string; name: string }, list: string, selected: string) => {
    if (list === selected) return;
    const assigned = todoLists[list];
    const onConfirm = () => setTodoList(kind, person.id, list, selected);
    if (!selected && !assigned) { onConfirm(); return; }
    const listName = (id: string) => lists.find(item => item.preferenceId === id)?.name ?? msg("Unavailable list");
    setConfirmation({ title: list ? msg("Change to-do list?") : msg("Unlink to-do list?"), confirmLabel: list ? msg("Change list") : msg("Unlink list"), requiresConnection: true, onConfirm,
      description: msg("{value1}{value2}Items stay in Home Assistant.", { value1: selected ? msg("Unlink “{value1}” from {value2} ({value3}). ", { value1: listName(selected), value2: memberMessage(person.id, kind), value3: msg(listLabels[kind]) }) : "", value2: assigned ? msg("Move “{value1}” from {value2} ({value3}) to {value4} ({value5}). ", { value1: listName(list), value2: memberMessage(assigned.member, assigned.kind), value3: msg(listLabels[assigned.kind]), value4: memberMessage(person.id, kind), value5: msg(listLabels[kind]) }) : list ? msg("Use “{value1}” for {value2} ({value3}). ", { value1: listName(list), value2: memberMessage(person.id, kind), value3: msg(listLabels[kind]) }) : "" }) });
  };
  const changeCalendar = (id: string, member: string) => {
    const previous = calendarMembers[id];
    if (!previous) { setCalendarMember(id, member); return; }
    const name = calendars.find(calendar => calendar.preferenceId === id)?.name ?? msg("Calendar");
    setConfirmation({ title: member ? msg("Move calendar?") : msg("Unlink calendar?"), confirmLabel: member ? msg("Move calendar") : msg("Unlink calendar"), requiresConnection: true,
      description: msg("{value1} “{value2}” from {value3}{value4}? Events stay in the source calendar.", { value1: member ? msg("Move") : msg("Unlink"), value2: name, value3: memberMessage(previous), value4: member ? msg(" to {name}", { name: memberMessage(member) }) : "" }), onConfirm: () => setCalendarMember(id, member) });
  };
  const shoppingLists = Object.keys(todoLists).filter(id => todoLists[id].kind === "shopping");
  const household = { id: "everyone", name: t("Household") };
  const listSelector = (kind: TodoListKind, person: { id: string; name: string }, selected = Object.keys(todoLists).find(id => todoLists[id].kind === kind && todoLists[id].member === person.id) ?? "") => {
    const display = todoLists[selected]?.display ?? defaultTodoDisplay;
    const label = kind !== "shopping" ? t("{list} for {name}", { list: msg(listLabels[kind]), name: person.name })
      : selected ? lists.find(list => list.preferenceId === selected)?.name ?? t("Unavailable list") : t("Add shopping list");
    return <div className="min-w-0 flex-[1_1_12rem]" key={selected || kind}>
      <div className="flex flex-wrap items-center gap-2">
        <EntityPicker className="min-w-0 flex-[1_1_12rem]" label={kind === "shopping" ? label : t(listLabels[kind])} hideLabel={kind === "shopping"} ariaLabel={label}
          entities={kind === "shopping" ? lists.filter(entity => entity.preferenceId === selected || !shoppingLists.includes(entity.preferenceId)) : lists} value={selected} groupByDevice={false} disabled={assignmentsDisabled}
          emptyActionLabel={t(kind === "shopping" ? "Add shopping list" : "Add list")} placeholder={t("No list selected")} clearLabel={t("No list selected")} onChange={value => changeList(kind, person, value, selected)}
          getDescription={list => { const assigned = todoLists[list.preferenceId]; return assigned && list.preferenceId !== selected ? t(" — move from {value1} ({value2})", { value1: memberMessage(assigned.member, assigned.kind), value2: msg(listLabels[assigned.kind]) }) : ""; }} />
        {kind === "shopping" && selected && !guided && <ShoppingListIconPicker list={label} value={display.shoppingIcon} disabled={sharedUnavailable}
          onChange={shoppingIcon => setTodoListDisplay(selected, { shoppingIcon })} />}
      </div>
      {selected && !guided && <details className="todo-display-settings" key={selected}>
        <summary aria-label={t("Display settings for {list}", { list: label })}><span className="panel-title"><SlidersHorizontal className="panel-title-icon" strokeWidth={1.8} aria-hidden="true" /><span>{t("Display settings")}</span></span></summary>
        <fieldset disabled={sharedUnavailable} className="grid gap-3 py-3">
          {kind === "shopping" && <ShoppingShortcuts items={display.quickItems ?? []} save={quickItems => setTodoListDisplay(selected, { quickItems })} />}
          <label className="grid gap-2 text-sm">{t("Completed items")}
            <select className="w-full rounded-lg border border-input bg-background p-2" value={display.completed} onChange={event => setTodoListDisplay(selected, { completed: event.target.value as TodoDisplay["completed"] })}>
              <option value="inline">{t("Show finished inline")}</option><option value="under">{t("Show finished underneath")}</option><option value="collapsed">{t("Hide finished underneath")}</option><option value="hide">{t("Hide finished")}</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm">{t("Sort order")}
            <select className="w-full rounded-lg border border-input bg-background p-2" value={display.sort} onChange={event => setTodoListDisplay(selected, { sort: event.target.value as TodoDisplay["sort"] })}>
              <option value="home-assistant">{t("Home Assistant order")}</option><option value="alphabetical">{t("Alphabetical")}</option><option value="due-date">{t("Due date")}</option>
            </select>
          </label>
          {([["showDetails", "Show details"], ["showDueDate", "Show due date"], ["celebrate", "Celebrate completion"], ["celebrateFinal", "Celebrate finishing the list"]] as const).map(([key, title]) =>
            <label key={key} className="flex min-h-11 items-center justify-between gap-3 text-sm"><span>{t(title)}</span><Switch checked={display[key]} onCheckedChange={value => setTodoListDisplay(selected, { [key]: value })} /></label>)}
        </fieldset>
      </details>}
    </div>;
  };
  return <>
    {section === "weather" && <section className="settings-stack">
      <section className="settings-card">
        <PanelHeading icon={CloudSun} title={t("Weather source")} />
        <p className="page-note" id="weather-source-help">{t("Choose a Home Assistant weather entity for current conditions and forecasts.")}</p>
        <EntityPicker label={t("Weather entity")} entities={currentHome.entities.filter(entity => entity.domain === "weather")} value={weatherEntity} onChange={setWeatherEntity} groupByDevice={false} placeholder={t("No weather selected")} clearLabel={t("Hide weather widget")} describedBy="weather-source-help" />
        <div className="mt-6">
          <EntityPicker label={t("Temperature entity (optional)")} entities={currentHome.entities.filter(isTemperatureEntity)} value={weatherTemperatureEntity} onChange={setWeatherTemperatureEntity} placeholder={t("Use weather entity")} clearLabel={t("Use weather entity")} describedBy="weather-temperature-help" />
          <p id="weather-temperature-help" className="mt-2 text-sm text-muted-foreground">{t("Use a separate sensor for the current temperature. Leave empty to use the weather entity.")}</p>
        </div>
      </section>
      <section className="weather-placement settings-card" aria-labelledby="weather-placement-heading">
        <PanelTitle id="weather-placement-heading" icon={Eye}>{t("Show weather")}</PanelTitle>
        <label><Checkbox checked={weatherPlacement.today} onCheckedChange={checked => setWeatherPlacement({ today: checked === true })} aria-label={t("Beside the clock on Today")} /><span><strong>{t("Beside the clock on Today")}</strong><small>{t("A larger weather display on your daily overview.")}</small></span></label>
        <label><Checkbox checked={weatherPlacement.header} onCheckedChange={checked => setWeatherPlacement({ header: checked === true })} aria-label={t("In the header")} /><span><strong>{t("In the header")}</strong><small>{t("A compact widget on every page.")}</small></span></label>
      </section>
      {!weatherPlacement.today && !weatherPlacement.header && <p role="status" className="page-note">{t("Weather is hidden. Your selected source is kept.")}</p>}
      {!homeOnline && <p role="status" className="page-note">{t("Weather updates resume when Home Assistant reconnects.")}</p>}
    </section>}
    {section === "connection" && <div className="settings-stack">
      <section className="glow-panel grid gap-3" id="connection">
        {!guided && <PanelHeading icon={Wifi} title={t("Home Assistant connection")} />}
        {(!guided || !homeOnline) && <p className="break-all">{t("Home Assistant: {value1}", { value1: haUrl || t(busy ? "Loading server configuration…" : "Server address unavailable") })}</p>}
        {(!guided || !homeOnline) && <div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={() => void connect()}>{busy ? t("Connecting…") : t("Reconnect")}</Button>{!guided && <Button variant="outline" onClick={() => setConfirmation({ title: msg("Disconnect Home Assistant?"), description: msg("Pause live controls in this tab until you reconnect or reload? Shared settings remain available."), confirmLabel: msg("Disconnect"), onConfirm: disconnect })}>{t("Disconnect")}</Button>}</div>}
        <p role="status" className="page-note">{homeOnline && guided ? t("Home Assistant connected") : t("Connection: {value1}", { value1: message(connectionStatus) })}</p>
        {!homeOnline && !busy && <p className="page-note">{t("Set your Home Assistant address and token in the HAOS app’s Configuration tab, or the dashboard server’s .env file. The token stays on the server.")}</p>}
        {connectionError && <p role="alert" className="text-destructive">{message(connectionError)}</p>}
        {metadataWarnings.map(warning => <p key={warning} role="alert">{message(warning)}</p>)}
      </section>
      {!guided && <section className="glow-panel">
        <PanelHeading icon={House} title={t("Your instance")} />
        <dl className="device-readings">
          <div><dt>{t("Name")}</dt><dd>{currentHome.name}</dd></div>
          <div><dt>{t("Signed in as")}</dt><dd>{currentUser?.name ?? t("Not signed in")}</dd></div>
          <div><dt>{t("HA access")}</dt><dd>{currentUser ? currentUser.is_owner ? t("Owner") : currentUser.is_admin ? t("Administrator") : t("User") : "—"}</dd></div>
          <div><dt>{t("Physical devices")}</dt><dd>{currentHome.devices.length}</dd></div>
          <div><dt>{t("Entities")}</dt><dd>{currentHome.entities.length}</dd></div>
        </dl>
        {haUrl && <a className="text-link" href={`${haUrl}/config`} target="_blank" rel="noreferrer">{t("Open Home Assistant settings")}</a>}
      </section>}
    </div>}
    {section === "people" && <section className="settings-stack" id="people-order">{!guided && <PanelHeading icon={Users} title={t("People, colors and timetables")} />}
      <p className="page-note">{t(guided ? "Choose who appears on the family board." : "Person colors appear in calendars, lists and timetables on every screen.")}</p>
      {!members.length && <p className="empty-note">{t("No people available.")} {homeOnline && haUrl && <a className="text-link" href={`${haUrl}/config/person`} target="_blank" rel="noreferrer">{t("Add people in Home Assistant")}</a>}</p>}
      <ol className="settings-stack" aria-label={t("People order")}>{members.map((person, index) => <li key={person.id} className="settings-card flex flex-wrap items-center gap-3">
        <MemberAvatar member={person.id} small /><span className="min-w-0 flex-1 break-words font-medium">{person.name}</span>
        <div className={guided ? "ms-auto" : "flex w-full flex-wrap items-center justify-end gap-3 sm:w-auto"}>
          <label className="flex items-center gap-2 text-sm">{t("Visible")}<Switch disabled={sharedUnavailable} aria-label={t("Show {value1} in family planner", { value1: person.name })} checked={isMemberVisible(person.id)} onCheckedChange={visible => setMemberVisible(person.id, visible)} /></label>
          {!guided && <><label className="mr-auto flex items-center gap-2 text-sm sm:mr-0">{t("Timetable")}<Switch disabled={sharedUnavailable} aria-label={t("Timetable for {value1}", { value1: person.name })} checked={hasTimetable(person.id)} onCheckedChange={enabled => enabled ? setTimetableEnabled(person.id, true) : setConfirmation({ title: msg("Hide timetable?"), description: msg("Hide {name}’s timetable from School and the dashboard? Saved pages and calendar choices will be kept.", { name: person.name }), confirmLabel: msg("Hide timetable"), onConfirm: () => setTimetableEnabled(person.id, false) })} /></label>
          <Button type="button" variant="outline" size="icon" disabled={sharedUnavailable || index === 0} aria-label={t("Move {value1} up", { value1: person.name })} onClick={() => moveMember(person.id, -1)}><ArrowUp size={18} aria-hidden="true" /></Button>
          <Button type="button" variant="outline" size="icon" disabled={sharedUnavailable || index === members.length - 1} aria-label={t("Move {value1} down", { value1: person.name })} onClick={() => moveMember(person.id, 1)}><ArrowDown size={18} aria-hidden="true" /></Button>
          <MemberColorPicker person={person} /></>}
        </div>
      </li>)}</ol>
      {guided && !!members.length && haUrl && homeOnline && <a className="text-link justify-self-start" href={`${haUrl}/config/person`} target="_blank" rel="noreferrer">{t("Add people in Home Assistant")}</a>}
    </section>}
    {section === "timetables" && <section className="settings-stack" id="timetables"><PanelHeading icon={BookOpen} title={t("Timetables")} />
      <p className="page-note">{t("Choose timetable types and sources here. School and the dashboard display the result.")}</p>
      {!members.some(person => hasTimetable(person.id)) && <p className="empty-note">{t("Enable Timetable in People to configure it here.")} <Link to="/settings/people" className="text-link">{t("Choose people")}</Link></p>}
      <SettingsPanels panels={members.filter(person => hasTimetable(person.id)).map(person => ({
        id: person.id, label: person.name, icon: BookOpen, content: <TimetableAdministration child={person.id} />,
      }))} />
    </section>}
    {section === "calendars" && <SettingsPanels panels={[
      { id: "assignments", label: t("People and calendars"), icon: CalendarDays, content: <section className="settings-stack" id="family-calendar">{guided ? <p className="page-note">{t("Choose the calendars to show for each person.")}</p> : <PanelHeading icon={CalendarDays} title={t("People and calendars")} />}
      {!homeOnline && <p role="status">{t("Calendars unavailable while offline.")}</p>}
      {homeOnline && !calendars.length && <p className="empty-note">{t("No calendars available.")} {haUrl && <a className="text-link" href={`${haUrl}/config/integrations`} target="_blank" rel="noreferrer">{t("Add a calendar integration")}</a>}</p>}
      {homeOnline && !calendarPeople.length && !!calendars.length && <p className="empty-note">{t("Choose people before assigning calendars.")} <Link className="text-link" to={guided ? "/onboarding?step=people" : "/settings/people"}>{t("Choose people")}</Link></p>}
      {!!calendars.length && <div className="settings-stack">{calendarPeople.map(person => {
        const selected = calendars.filter(calendar => calendarMembers[calendar.preferenceId] === person.id);
        const available = calendars.filter(calendar => calendarMembers[calendar.preferenceId] !== person.id);
        return <div key={person.id} role="group" aria-label={person.name} className="settings-card flex flex-wrap items-center gap-3">
          <PanelTitle as="h3" icon={Users} className="w-full">{person.name}</PanelTitle>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            {selected.map(calendar => <span key={calendar.preferenceId} className="inline-flex max-w-full items-center gap-1 rounded-full bg-secondary py-1 pl-3 pr-1 text-sm">
              <span className="min-w-0 break-words">{calendar.name}</span>
              <Button type="button" variant="ghost" size="icon" className="shrink-0" disabled={assignmentsDisabled} aria-label={t("Remove {value1} from {value2}", { value1: calendar.name, value2: memberMessage(person.id) })} onClick={() => changeCalendar(calendar.preferenceId, "")}><X aria-hidden="true" /></Button>
            </span>)}
            {!selected.length && <span className="text-sm text-muted-foreground">{t("No calendars selected")}</span>}
          </div>
          <EntityPicker label={t("Add calendar for {value1}", { value1: person.name })} hideLabel className="sm:w-56" entities={available} groupByDevice={false} value="" disabled={assignmentsDisabled || !available.length} placeholder={available.length ? t("Add calendar…") : t("All calendars selected")} onChange={value => changeCalendar(value, person.id)}
            getDescription={calendar => calendarMembers[calendar.preferenceId] ? t(" — move from {value1}", { value1: memberName(calendarMembers[calendar.preferenceId]) }) : ""} />
        </div>;
      })}</div>}
      {guided && homeOnline && haUrl && !!calendars.length && <a className="text-link justify-self-start" href={`${haUrl}/config/integrations`} target="_blank" rel="noreferrer">{t("Add a calendar integration")}</a>}
      </section> },
      ...(guided ? [] : [{ id: "waste", label: t("Waste collection"), icon: Trash2, content: <section className="settings-card space-y-3">
        <PanelTitle icon={Trash2}>{t("Waste collection")}</PanelTitle>
        <div className="space-y-3">
          <p id="waste-person-help" className="text-sm text-muted-foreground">{t("Show waste collections for this person in Calendar and Everyone’s day, using the same dates as Waste collection on Today.")}</p>
          <label className="planner-form">{t("Show waste collections for")}
            <select value={wasteMember} aria-describedby="waste-person-help" disabled={assignmentsDisabled || !wasteCalendar}
              onChange={event => changeCalendar(wasteCalendarEntity, event.target.value)}>
              <option value="">{t("No person selected")}</option>
              {activeMembers.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
              {wasteMember && !activeMembers.some(person => person.id === wasteMember) && <option value={wasteMember} disabled>{memberName(wasteMember)} · {t("Hidden")}</option>}
            </select>
          </label>
          <p className="text-sm text-muted-foreground">{wasteCalendar ? t("Calendar: {value1}", { value1: wasteCalendar.name }) : t(wasteCalendarEntity ? "Waste collection calendar unavailable. Check the calendar or choose another in Customize Today." : "Choose a waste collection calendar in Customize Today.")}</p>
        </div>
      </section> }]),
    ]} />}
    {section === "lists" && <section className="settings-stack" id="family-lists">{guided ? <p className="page-note">{t("Choose a shared shopping list or open a person to add their tasks.")}</p> : <PanelHeading icon={ListChecks} title={t("People and to-do lists")} />}
      {!homeOnline && <p role="status">{t("Lists unavailable while offline.")}</p>}
      {homeOnline && !lists.length && <p className="empty-note">{t("No to-do lists available.")} {haUrl && <a className="text-link" href={`${haUrl}/config/integrations`} target="_blank" rel="noreferrer">{t("Add a to-do integration")}</a>}</p>}
      {(!guided || (homeOnline && lists.length > 0)) && <SettingsPanels stacked={guided} panels={[
        { id: "shopping", label: t("Shopping lists"), icon: ListChecks, content: <section className="settings-card grid gap-3" aria-label={t("Shopping lists")}>
          <PanelTitle as="h3" icon={ListChecks}>{t("Shopping lists")}</PanelTitle>
          {shoppingLists.map(id => listSelector("shopping", household, id))}
          {listSelector("shopping", household, "")}
        </section> },
        ...(guided ? activeMembers : listPeople).map(person => {
          const fields = <div className="flex min-w-0 flex-wrap gap-3">{listSelector("tasks", person)}{listSelector("daily", person)}{listSelector("homework", person)}</div>;
          const label = t("To-do lists for {value1}", { value1: person.name });
          return { id: person.id, label: person.name, icon: Users, content: guided
            ? <details aria-label={label} className="settings-card optional-fields"><summary>{person.name}</summary>{fields}
                <p className="page-note">{t("Daily lists need a Home Assistant automation to reset them each morning.")}</p>
              </details>
            : <section className="settings-card grid gap-3" role="group" aria-label={label}>
                <PanelTitle icon={Users}>{person.name}</PanelTitle>{fields}
              </section> };
        }),
      ]} />}
      {guided && homeOnline && haUrl && !!lists.length && <a className="text-link justify-self-start" href={`${haUrl}/config/integrations`} target="_blank" rel="noreferrer">{t("Add a to-do integration")}</a>}
    </section>}

    {confirmation && <ConfirmDialog open onOpenChange={open => { if (!open) setConfirmation(undefined); }} {...confirmation} destructive disabled={confirmation.requiresConnection && assignmentsDisabled} />}
  </>;
}
