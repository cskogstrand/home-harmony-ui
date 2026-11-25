import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppContext } from "@/contexts/AppContext";
import History from "@/pages/History";
import { emptyRegistries, mapHome } from "@/lib/ha-model";
import { activitySourceRows, buildSourceTree, filterSourceRows, integrationLabel, sortSourceRows, sourceLevels, emptySourceFilters, type SourceTreeNode } from "@/lib/activity-sources";
import type { Entity, PhysicalDevice } from "@/types/api";
import { state } from "./ha-fixtures";
import { sourceFile } from "./source-file.mjs";

// Fictional household: every name, room and device below is invented for these tests.
const shared = vi.hoisted(() => ({ value: { state: { loaded: true, error: "" } } }));
const family = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock("@/contexts/SharedConfigurationContext", () => ({ useSharedConfiguration: () => shared.value }));
vi.mock("@/contexts/FamilyContext", async importOriginal => ({ ...await importOriginal<typeof import("@/contexts/FamilyContext")>(), useFamily: () => family.value }));

const states = {
  "binary_sensor.example_garage": state("binary_sensor.example_garage", "off", { device_class: "garage_door", friendly_name: "Garage door" }),
  "lock.example_front": state("lock.example_front", "locked", { friendly_name: "Front door" }),
  "vacuum.example_robot": state("vacuum.example_robot", "docked", { friendly_name: "Robot vacuum" }),
  "binary_sensor.example_dishwasher": state("binary_sensor.example_dishwasher", "off", { device_class: "running", friendly_name: "Dishwasher" }),
  "sensor.example_washer": state("sensor.example_washer", "run", { device_class: "enum", options: ["ready", "run", "finished"], friendly_name: "Washer" }),
  "sensor.example_temperature": state("sensor.example_temperature", "21.5", { device_class: "temperature", unit_of_measurement: "°C", friendly_name: "Hall temperature" }),
  "automation.example_lights": state("automation.example_lights", "on", { friendly_name: "Evening lights" }),
  "alarm_control_panel.example_house": state("alarm_control_panel.example_house", "disarmed", { friendly_name: "House alarm" }),
  "event.example_doorbell": state("event.example_doorbell", "2026-10-06T10:00:00Z", { device_class: "doorbell", friendly_name: "Front doorbell" }),
  "light.example_lamp": state("light.example_lamp", "off", { friendly_name: "Reading lamp" }),
  "binary_sensor.example_person": state("binary_sensor.example_person", "off", { device_class: "occupancy", friendly_name: "Driveway person occupancy" }),
};
const device = (id: string, name: string): PhysicalDevice => ({ id, name });
// entity → [device, integration, area]
const origins: Record<string, [PhysicalDevice | undefined, string, string]> = {
  "binary_sensor.example_garage": [device("dev-garage", "Garage controller"), "zwave_js", "garage"],
  "lock.example_front": [device("dev-lock", "Front lock"), "zwave_js", "hall"],
  "vacuum.example_robot": [device("dev-robot", "Robot"), "example_robots", "unassigned"],
  "binary_sensor.example_dishwasher": [device("dev-kitchen", "Kitchen appliances"), "home_connect", "kitchen"],
  "sensor.example_washer": [device("dev-kitchen", "Kitchen appliances"), "home_connect", "kitchen"],
  "alarm_control_panel.example_house": [undefined, "", "unassigned"],
  "event.example_doorbell": [device("dev-bell", "Front doorbell unit"), "example_bells", "hall"],
  "light.example_lamp": [device("dev-lamp", "Lamp"), "hue", "hall"],
  "binary_sensor.example_person": [device("dev-camera", "Driveway camera"), "frigate", "unassigned"],
};
const entities: Entity[] = mapHome(states, emptyRegistries, "home").entities.map(entity => {
  const [owner, integration, areaId] = origins[entity.entityId] ?? [undefined, "", "unassigned"];
  return { ...entity, device: owner, integration: integration || undefined, areaId };
});
const areas = [{ id: "garage", name: "Example garage", entities: [] }, { id: "hall", name: "Example hall", entities: [] }, { id: "kitchen", name: "Example kitchen", entities: [] }];
const id = (entityId: string) => `home|${entityId}`;
const camera = { id: "camera-example", name: "Example driveway", connectionId: "home-assistant", source: "camera.example_driveway", personSnapshot: { type: "none" }, personDetectionEntity: id("binary_sensor.example_person") };
const setActivity = vi.fn((_settings: Record<string, unknown>) => true);

const view = (home: { entities: Entity[]; areas: typeof areas } = { entities, areas }) => <AppContext.Provider value={{ homeOnline: true, subscribeLogbook: vi.fn(() => () => {}), haUrl: "", currentHome: { ...home, timeZone: "Europe/Oslo" } } as never}>
  <MemoryRouter initialEntries={["/settings/activity?panel=recent"]}><History /></MemoryRouter></AppContext.Provider>;
const card = () => within(screen.getByRole("region", { name: "Activity sources" }));
const table = () => within(card().getByRole("treegrid", { name: "Activity sources" }));
const bodyRows = () => table().getAllByRole("row").slice(1);
const isGroup = (row: HTMLElement) => row.hasAttribute("aria-expanded");
const names = () => bodyRows().filter(row => !isGroup(row) && row.querySelector("strong")).map(row => row.querySelector("strong")!.textContent);
const groups = () => bodyRows().filter(isGroup).map(row => row.querySelector("th")!.textContent);
const groupName = (row: HTMLElement) => [row.querySelector(".activity-sources-group-name > span")!.textContent,
  ...[...row.querySelectorAll(".activity-sources-merged > span")].map(part => part.textContent!.replace(/^, /, ""))].join(" › ");
// The visible tree, two spaces per level: a group reads "name › merged level (n of m chosen)", "+" when folded.
const outline = () => bodyRows().map(row => "  ".repeat(Number(row.getAttribute("aria-level")) - 1) + (isGroup(row)
  ? `${groupName(row)} (${row.querySelector(".activity-sources-count")!.textContent})${row.getAttribute("aria-expanded") === "true" ? "" : " +"}`
  : row.querySelector("strong")!.textContent));
const groupOutline = () => outline().filter(line => line.includes(" chosen)"));
const row = (name: string) => bodyRows().find(each => isGroup(each) ? groupName(each) === name : each.querySelector("strong")?.textContent === name)!;
const box = (name: string) => card().getByRole("checkbox", { name: `Use ${name} as a source` });
const groupBox = (group: string) => card().getByRole("checkbox", { name: `Use all shown in ${group} as sources` });
const choose = (label: string, value: string) => fireEvent.change(card().getByLabelText(label), { target: { value } });
const results = () => card().getByText(/ shown, /).textContent;
const saved = () => (setActivity.mock.lastCall![0] as { sources?: string[] }).sources;

beforeEach(() => {
  setActivity.mockClear();
  setActivity.mockImplementation(() => true);
  shared.value = { state: { loaded: true, error: "" } };
  family.value = { activity: { panel: true, people: false }, dashboard: { recentActivity: false }, setActivity, now: new Date("2026-10-06T12:00:00Z"), today: "2026-10-06", cameras: { items: [camera] } };
});

describe("Activity sources table", () => {
  it("lists every candidate with the suggestions ticked, its device, integration, area and type, and the camera's own name", () => {
    render(view());
    choose("Group by", "none");
    expect(names()).toEqual(["Dishwasher", "Example driveway", "Front door", "Front doorbell", "Garage door", "House alarm", "Reading lamp", "Robot vacuum", "Washer"]);
    expect(card().getByText("8 sources chosen")).toBeInTheDocument();
    expect(card().getByText("Following the suggestions")).toBeInTheDocument();
    expect(results()).toBe("9 of 9 shown, 8 chosen");
    expect(box("Garage door")).toBeChecked();
    expect(box("Reading lamp")).not.toBeChecked();
    const lock = box("Front door").closest("tr")!;
    expect(within(lock).getAllByRole("gridcell").map(cell => cell.textContent)).toEqual(["Front lock", "Z-Wave JS", "Example hall", "Locks"]);
    expect(lock).toHaveAttribute("aria-level", "1");
    expect(within(lock).getByRole("rowheader")).toHaveTextContent("lock.example_front");
    const alarm = box("House alarm").closest("tr")!;
    expect(alarm.querySelectorAll(".is-empty")).toHaveLength(3);
    expect(card().queryByText("Driveway person occupancy")).toBeNull();
    // Readings and administration are never candidates.
    expect(card().queryByText("Hall temperature")).toBeNull();
    expect(card().queryByText("Evening lights")).toBeNull();
  });

  it("starts as a tree of integration → device → type → source, merging levels with a single group inside", () => {
    render(view());
    expect(card().getByLabelText("Group by")).toHaveValue("integration");
    expect(within(card().getByRole("list", { name: "Tree levels" })).getAllByRole("listitem").map(item => item.textContent)).toEqual(["Integration", "Device", "Type", "Source"]);
    expect(outline()).toEqual([
      "Example Bells › Front doorbell unit › Doorbells (1 of 1 chosen)", "  Front doorbell",
      "Example Robots › Robot › Robot vacuums and mowers (1 of 1 chosen)", "  Robot vacuum",
      "Frigate › Driveway camera › Camera person detection (1 of 1 chosen)", "  Example driveway",
      "Home Connect › Kitchen appliances › Appliances (2 of 2 chosen)", "  Dishwasher", "  Washer",
      "Philips Hue › Lamp › Other changes (0 of 1 chosen)", "  Reading lamp",
      // Two devices keep Z-Wave JS a level of its own; each device has one type, so device and type share a row.
      "Z-Wave JS (2 of 2 chosen)",
      "  Front lock › Locks (1 of 1 chosen)", "    Front door",
      "  Garage controller › Doors and windows (1 of 1 chosen)", "    Garage door",
      "Unknown integration › Without a device › Alarm (1 of 1 chosen)", "  House alarm",
    ]);
    // Tree semantics: level, position among siblings and open state on every row.
    const zwave = row("Z-Wave JS");
    expect(zwave).toHaveAttribute("aria-level", "1");
    expect(zwave).toHaveAttribute("aria-posinset", "6");
    expect(zwave).toHaveAttribute("aria-setsize", "7");
    expect(zwave).toHaveAttribute("aria-expanded", "true");
    expect(row("Garage controller › Doors and windows")).toHaveAttribute("aria-level", "2");
    expect(row("Garage controller › Doors and windows")).toHaveAttribute("aria-posinset", "2");
    expect(row("Garage door")).toHaveAttribute("aria-level", "3");
    expect(row("Garage door")).toHaveAttribute("aria-setsize", "1");
    // The merged names are part of the group's name and its checkbox label.
    expect(groupBox("Front lock, Locks")).toHaveAttribute("aria-checked", "true");
    expect(card().getByRole("button", { name: /^Front lock\W+Locks/ })).toHaveAttribute("aria-expanded", "true");
    // Folding a group hides everything below it.
    fireEvent.click(card().getByRole("button", { name: /^Z-Wave JS/ }));
    expect(outline()).toContain("Z-Wave JS (2 of 2 chosen) +");
    expect(names()).not.toContain("Garage door");
    expect(card().queryByRole("checkbox", { name: "Use Front door as a source" })).toBeNull();
  });

  it("puts area first and then the full path when grouping by area", () => {
    render(view());
    choose("Group by", "area");
    expect(within(card().getByRole("list", { name: "Tree levels" })).getAllByRole("listitem").map(item => item.textContent)).toEqual(["Area", "Integration", "Device", "Type", "Source"]);
    expect(outline()).toEqual([
      "Example garage › Z-Wave JS › Garage controller › Doors and windows (1 of 1 chosen)", "  Garage door",
      "Example hall (2 of 3 chosen)",
      "  Example Bells › Front doorbell unit › Doorbells (1 of 1 chosen)", "    Front doorbell",
      "  Philips Hue › Lamp › Other changes (0 of 1 chosen)", "    Reading lamp",
      "  Z-Wave JS › Front lock › Locks (1 of 1 chosen)", "    Front door",
      "Example kitchen › Home Connect › Kitchen appliances › Appliances (2 of 2 chosen)", "  Dishwasher", "  Washer",
      // The unassigned group and the unknown integration come last at their level.
      "Unassigned (3 of 3 chosen)",
      "  Example Robots › Robot › Robot vacuums and mowers (1 of 1 chosen)", "    Robot vacuum",
      "  Frigate › Driveway camera › Camera person detection (1 of 1 chosen)", "    Example driveway",
      "  Unknown integration › Without a device › Alarm (1 of 1 chosen)", "    House alarm",
    ]);
  });

  it("puts the chosen level first for device and type, then integration → device → type without repeating it, and lists flat for none", () => {
    render(view());
    choose("Group by", "device");
    expect(within(card().getByRole("list", { name: "Tree levels" })).getAllByRole("listitem").map(item => item.textContent)).toEqual(["Device", "Integration", "Type", "Source"]);
    expect(groupOutline()).toEqual([
      "Driveway camera › Frigate › Camera person detection (1 of 1 chosen)", "Front doorbell unit › Example Bells › Doorbells (1 of 1 chosen)",
      "Front lock › Z-Wave JS › Locks (1 of 1 chosen)", "Garage controller › Z-Wave JS › Doors and windows (1 of 1 chosen)",
      "Kitchen appliances › Home Connect › Appliances (2 of 2 chosen)", "Lamp › Philips Hue › Other changes (0 of 1 chosen)",
      "Robot › Example Robots › Robot vacuums and mowers (1 of 1 chosen)", "Without a device › Unknown integration › Alarm (1 of 1 chosen)",
    ]);
    choose("Group by", "type");
    expect(within(card().getByRole("list", { name: "Tree levels" })).getAllByRole("listitem").map(item => item.textContent)).toEqual(["Type", "Integration", "Device", "Source"]);
    // Types keep the Event types order.
    expect(groupOutline()).toEqual([
      "Doors and windows › Z-Wave JS › Garage controller (1 of 1 chosen)", "Locks › Z-Wave JS › Front lock (1 of 1 chosen)",
      "Alarm › Unknown integration › Without a device (1 of 1 chosen)", "Appliances › Home Connect › Kitchen appliances (2 of 2 chosen)",
      "Robot vacuums and mowers › Example Robots › Robot (1 of 1 chosen)", "Doorbells › Example Bells › Front doorbell unit (1 of 1 chosen)",
      "Camera person detection › Frigate › Driveway camera (1 of 1 chosen)", "Other changes › Philips Hue › Lamp (0 of 1 chosen)",
    ]);
    choose("Group by", "none");
    expect(groups()).toEqual([]);
    expect(card().queryByRole("list", { name: "Tree levels" })).toBeNull();
    expect(bodyRows().every(each => each.getAttribute("aria-level") === "1")).toBe(true);
    expect(names()).toHaveLength(9);
  });

  it("chooses or clears a whole level from its checkbox, with a mixed state at every level above", () => {
    // A second fictional lock on the same device gives Z-Wave JS → Front lock two sources.
    const deadbolt = { ...entities.find(entity => entity.entityId === "lock.example_front")!, entityId: "lock.example_deadbolt", preferenceId: id("lock.example_deadbolt"), name: "Deadbolt" };
    render(view({ entities: [...entities, deadbolt], areas }));
    const zwave = groupBox("Z-Wave JS"), lock = groupBox("Front lock, Locks"), garage = groupBox("Garage controller, Doors and windows");
    expect([zwave, lock, garage].map(each => each.getAttribute("aria-checked"))).toEqual(["true", "true", "true"]);
    fireEvent.click(box("Deadbolt"));
    expect([zwave, lock, garage].map(each => each.getAttribute("aria-checked"))).toEqual(["mixed", "mixed", "true"]);
    expect(outline()).toContain("Z-Wave JS (2 of 3 chosen)");
    expect(outline()).toContain("  Front lock › Locks (1 of 2 chosen)");
    // A mixed box chooses everything below it, then clears it all.
    fireEvent.click(zwave);
    expect([zwave, lock, garage].map(each => each.getAttribute("aria-checked"))).toEqual(["true", "true", "true"]);
    expect(box("Deadbolt")).toBeChecked();
    fireEvent.click(zwave);
    expect([zwave, lock, garage].map(each => each.getAttribute("aria-checked"))).toEqual(["false", "false", "false"]);
    expect(card().getByText("6 sources chosen")).toBeInTheDocument();
    fireEvent.click(lock);
    expect([zwave, lock, garage].map(each => each.getAttribute("aria-checked"))).toEqual(["mixed", "true", "false"]);
    expect(box("Front door")).toBeChecked();
    expect(box("Deadbolt")).toBeChecked();
    // Area grouping: the hall mixes a chosen lock and doorbell with an unchosen lamp.
    choose("Group by", "area");
    const hall = groupBox("Example hall");
    expect(hall).toHaveAttribute("aria-checked", "mixed");
    fireEvent.click(hall);
    expect(hall).toHaveAttribute("aria-checked", "true");
    expect(box("Reading lamp")).toBeChecked();
    expect(setActivity).not.toHaveBeenCalled();
  });

  it("opens the paths to every match while searching or filtering, and lets groups fold again", () => {
    const many: Entity[] = Array.from({ length: 30 }, (_, index) => ({
      ...entities.find(entity => entity.entityId === "light.example_lamp")!, entityId: `light.example_${index}`, preferenceId: id(`light.example_${index}`),
      name: `Example light ${index}`, device: device(`dev-${index}`, `Example device ${index}`), integration: "hue",
    }));
    render(view({ entities: [...entities, ...many], areas }));
    // Philips Hue holds 31 devices, more than eight, so they start folded.
    expect(outline()).toContain("  Example device 0 › Other changes (0 of 1 chosen) +");
    expect(names()).not.toContain("Example light 12");
    const search = card().getByRole("searchbox", { name: "Search sources" });
    fireEvent.change(search, { target: { value: "light 12" } });
    expect(outline()).toEqual(["Philips Hue › Example device 12 › Other changes (0 of 1 chosen)", "  Example light 12"]);
    fireEvent.change(search, { target: { value: "example light 1" } });
    // Every word matches somewhere: 1, 10–19 and 21.
    expect(names()).toHaveLength(12);
    expect(names()).toContain("Example light 10");
    // A group folded during a search stays folded until the search changes.
    fireEvent.click(card().getByRole("button", { name: /^Example device 10\W+Other changes/ }));
    expect(names()).not.toContain("Example light 10");
    fireEvent.change(search, { target: { value: "example light 1 " } });
    expect(names()).toContain("Example light 10");
    fireEvent.change(search, { target: { value: "" } });
    choose("Integration", "hue");
    expect(names()).toHaveLength(31);
    choose("Integration", "all");
    expect(names()).not.toContain("Example light 12");
  });

  it("moves through the tree with the arrow keys and ticks with Space, with one tab stop", () => {
    render(view());
    const bells = row("Example Bells › Front doorbell unit › Doorbells");
    expect(bodyRows().filter(each => each.tabIndex === 0)).toEqual([bells]);
    // The checkboxes and fold buttons stay clickable but out of the tab order.
    expect(groupBox("Z-Wave JS")).toHaveAttribute("tabindex", "-1");
    expect(box("Garage door")).toHaveAttribute("tabindex", "-1");
    bells.focus();
    fireEvent.keyDown(bells, { key: "ArrowDown" });
    expect(row("Front doorbell")).toHaveFocus();
    expect(row("Front doorbell").tabIndex).toBe(0);
    expect(bells.tabIndex).toBe(-1);
    fireEvent.keyDown(row("Front doorbell"), { key: "ArrowLeft" });
    expect(bells).toHaveFocus();
    fireEvent.keyDown(bells, { key: "ArrowLeft" });
    expect(bells).toHaveAttribute("aria-expanded", "false");
    expect(names()).not.toContain("Front doorbell");
    fireEvent.keyDown(bells, { key: "ArrowRight" });
    expect(bells).toHaveAttribute("aria-expanded", "true");
    expect(bells).toHaveFocus();
    fireEvent.keyDown(bells, { key: "ArrowRight" });
    expect(row("Front doorbell")).toHaveFocus();
    fireEvent.keyDown(row("Front doorbell"), { key: "End" });
    expect(row("House alarm")).toHaveFocus();
    fireEvent.keyDown(row("House alarm"), { key: "Home" });
    expect(bells).toHaveFocus();
    // Space ticks the focused source or the whole group; Enter folds a group.
    const zwave = row("Z-Wave JS");
    zwave.focus();
    fireEvent.keyDown(zwave, { key: "ArrowDown" });
    fireEvent.keyDown(row("Front lock › Locks"), { key: "ArrowDown" });
    expect(row("Front door")).toHaveFocus();
    fireEvent.keyDown(row("Front door"), { key: " " });
    expect(box("Front door")).not.toBeChecked();
    expect(groupBox("Z-Wave JS")).toHaveAttribute("aria-checked", "mixed");
    fireEvent.keyDown(row("Front door"), { key: "ArrowLeft" });
    fireEvent.keyDown(row("Front lock › Locks"), { key: "ArrowLeft" });
    fireEvent.keyDown(row("Front lock › Locks"), { key: "ArrowLeft" });
    expect(zwave).toHaveFocus();
    fireEvent.keyDown(zwave, { key: " " });
    expect(groupBox("Z-Wave JS")).toHaveAttribute("aria-checked", "true");
    fireEvent.keyDown(zwave, { key: "Enter" });
    expect(zwave).toHaveAttribute("aria-expanded", "false");
    expect(card().queryByRole("group", { name: "Unsaved sources" })).toBeNull();
  });


  it("filters by text, chosen state, type, area and integration, counts matches and clears back to the search field", () => {
    render(view());
    choose("Group by", "none");
    const search = card().getByRole("searchbox", { name: "Search sources" });
    fireEvent.change(search, { target: { value: "kitchen" } });
    expect(names()).toEqual(["Dishwasher", "Washer"]);
    expect(results()).toBe("2 of 9 shown, 2 chosen");
    fireEvent.change(search, { target: { value: "zwave" } });
    expect(names()).toEqual(["Front door", "Garage door"]);
    fireEvent.change(search, { target: { value: "" } });
    choose("Type", "locks");
    expect(names()).toEqual(["Front door"]);
    choose("Type", "all");
    choose("Area", "hall");
    expect(names()).toEqual(["Front door", "Front doorbell", "Reading lamp"]);
    choose("Integration", "hue");
    expect(names()).toEqual(["Reading lamp"]);
    expect(results()).toBe("1 of 9 shown, 0 chosen");
    choose("Area", "all");
    choose("Integration", "all");
    choose("Area", "");
    expect(names()).toEqual(["Example driveway", "House alarm", "Robot vacuum"]);
    choose("Area", "all");
    choose("Show", "unchosen");
    expect(names()).toEqual(["Reading lamp"]);
    // A row ticked under this filter stays where it is until the filter changes.
    fireEvent.click(box("Reading lamp"));
    expect(names()).toEqual(["Reading lamp"]);
    expect(box("Reading lamp")).toBeChecked();
    choose("Show", "chosen");
    expect(names()).toHaveLength(9);
    choose("Integration", "frigate");
    expect(names()).toEqual(["Example driveway"]);
    fireEvent.change(search, { target: { value: "nothing like this" } });
    expect(card().getByText("No sources match these filters.")).toBeInTheDocument();
    const clear = card().getAllByRole("button", { name: "Clear filters" })[0];
    fireEvent.click(clear);
    expect(search).toHaveFocus();
    expect(search).toHaveValue("");
    expect(card().getByLabelText("Show")).toHaveValue("all");
    expect(card().getByLabelText("Integration")).toHaveValue("all");
    expect(names()).toHaveLength(9);
    expect(card().getByRole("button", { name: "Clear filters" })).toBeDisabled();
  });

  it("sorts by any column from its header button and marks it with aria-sort", () => {
    render(view());
    choose("Group by", "none");
    const header = (name: string) => table().getByRole("columnheader", { name });
    expect(header("Name")).toHaveAttribute("aria-sort", "ascending");
    fireEvent.click(within(header("Device")).getByRole("button", { name: "Device" }));
    expect(header("Device")).toHaveAttribute("aria-sort", "ascending");
    expect(header("Name")).not.toHaveAttribute("aria-sort");
    // Rows without a device sort last in either direction.
    expect(names()).toEqual(["Example driveway", "Front doorbell", "Front door", "Garage door", "Dishwasher", "Washer", "Reading lamp", "Robot vacuum", "House alarm"]);
    fireEvent.click(within(header("Device")).getByRole("button", { name: "Device" }));
    expect(header("Device")).toHaveAttribute("aria-sort", "descending");
    expect(names()).toEqual(["Robot vacuum", "Reading lamp", "Dishwasher", "Washer", "Garage door", "Front door", "Front doorbell", "Example driveway", "House alarm"]);
    fireEvent.click(within(header("Type")).getByRole("button", { name: "Type" }));
    expect(header("Type")).toHaveAttribute("aria-sort", "ascending");
    expect(names()).toEqual(["Garage door", "Front door", "House alarm", "Dishwasher", "Washer", "Robot vacuum", "Front doorbell", "Example driveway", "Reading lamp"]);
    fireEvent.click(within(header("Name")).getByRole("button", { name: "Name" }));
    fireEvent.click(within(header("Name")).getByRole("button", { name: "Name" }));
    expect(header("Name")).toHaveAttribute("aria-sort", "descending");
    expect(names()[0]).toBe("Washer");
  });

  it("chooses and removes everything shown, and goes back to the suggestions", () => {
    family.value = { ...family.value, activity: { panel: true, people: false, sources: [id("light.example_lamp")] } };
    render(view());
    expect(card().getByText("1 source chosen")).toBeInTheDocument();
    fireEvent.change(card().getByRole("searchbox", { name: "Search sources" }), { target: { value: "front" } });
    fireEvent.click(card().getByRole("button", { name: "Choose all shown" }));
    expect(box("Front door")).toBeChecked();
    expect(box("Front doorbell")).toBeChecked();
    expect(card().getByText("3 sources chosen")).toBeInTheDocument();
    expect(card().getByRole("button", { name: "Choose all shown" })).toBeDisabled();
    fireEvent.click(card().getByRole("button", { name: "Remove all shown" }));
    expect(card().getByText("1 source chosen")).toBeInTheDocument();
    fireEvent.click(card().getByRole("button", { name: "Use suggested sources" }));
    expect(card().getByText("8 sources chosen")).toBeInTheDocument();
    expect(card().getByRole("button", { name: "Use suggested sources" })).toBeDisabled();
    fireEvent.click(card().getByRole("button", { name: "Save sources" }));
    expect(setActivity).toHaveBeenCalledOnce();
    expect(setActivity).toHaveBeenLastCalledWith({ sources: undefined });
  });

  it("collects ticks in one draft: Save writes once, Cancel restores, and a failed save keeps the draft", () => {
    render(view());
    expect(card().queryByRole("button", { name: "Save sources" })).toBeNull();
    fireEvent.click(box("Reading lamp"));
    fireEvent.click(box("Garage door"));
    fireEvent.click(box("Washer"));
    expect(setActivity).not.toHaveBeenCalled();
    const bar = within(card().getByRole("group", { name: "Unsaved sources" }));
    expect(bar.getByText("3 unsaved changes")).toBeInTheDocument();
    fireEvent.click(bar.getByRole("button", { name: "Cancel" }));
    expect(box("Reading lamp")).not.toBeChecked();
    expect(box("Garage door")).toBeChecked();
    expect(card().getByRole("heading", { name: "Activity sources" })).toHaveFocus();
    expect(card().queryByRole("group", { name: "Unsaved sources" })).toBeNull();
    // Ticking a row back to where it was leaves nothing to save.
    fireEvent.click(box("Washer"));
    fireEvent.click(box("Washer"));
    expect(card().queryByRole("group", { name: "Unsaved sources" })).toBeNull();

    setActivity.mockImplementation(() => false);
    fireEvent.click(box("Reading lamp"));
    fireEvent.click(card().getByRole("button", { name: "Save sources" }));
    expect(card().getByRole("alert")).toHaveTextContent("Sources were not saved. Your changes are kept here, so you can try again.");
    expect(box("Reading lamp")).toBeChecked();
    expect(card().getByText("1 unsaved change")).toBeInTheDocument();
    setActivity.mockImplementation(() => true);
    fireEvent.click(card().getByRole("button", { name: "Save sources" }));
    expect(saved()).toEqual(expect.arrayContaining([id("light.example_lamp"), id("binary_sensor.example_garage")]));
    expect(saved()).toHaveLength(9);
    expect(card().queryByRole("alert")).toBeNull();
    expect(card().queryByRole("group", { name: "Unsaved sources" })).toBeNull();
  });

  it("keeps unavailable sources removable, marks hidden types and disables changes until settings load", () => {
    family.value = { ...family.value, activity: { panel: true, people: true, hidden: ["locks"], sources: [id("lock.example_front"), "home|sensor.example_gone"] } };
    const { unmount } = render(view());
    expect(groups()).toContain("Front lock, LocksHidden under Event types1 of 1 chosen");
    expect(outline()).toContain("Unknown integration › Without a device (1 of 2 chosen)");
    expect(groups()).toContain("Unavailable sourcesNot found in Home Assistant right now.1 of 1 chosen");
    expect(box("Front door").closest("tr")).toHaveTextContent("LocksHidden");
    const gone = box("Source unavailable");
    expect(gone.closest("tr")).toHaveTextContent("sensor.example_gone");
    fireEvent.click(gone);
    // The row stays to tick again until the change is saved.
    expect(box("Source unavailable")).not.toBeChecked();
    fireEvent.click(card().getByRole("button", { name: "Save sources" }));
    expect(setActivity).toHaveBeenLastCalledWith({ sources: [id("lock.example_front")] });
    expect(card().getByText("People coming and going are included as well, under Latest events above.")).toBeInTheDocument();
    unmount();
    shared.value = { state: { loaded: false, error: "" } };
    render(view());
    expect(box("Front door")).toBeDisabled();
    expect(card().getByRole("button", { name: "Use suggested sources" })).toBeDisabled();
  });

  it("explains an empty choice", () => {
    family.value = { ...family.value, activity: { panel: true, people: false, sources: [] } };
    render(view());
    expect(card().getByText("No sources chosen. Latest events only shows people coming and going, when they are included.")).toBeInTheDocument();
    expect(card().getByText("0 sources chosen")).toBeInTheDocument();
  });

  it("handles hundreds of candidates, folds long levels and stays quick", () => {
    const many: Entity[] = Array.from({ length: 600 }, (_, index) => ({
      ...entities.find(entity => entity.entityId === "light.example_lamp")!, entityId: `light.example_${index}`, preferenceId: id(`light.example_${index}`),
      name: `Example light ${index}`, device: device(`dev-${index % 40}`, `Example device ${index % 40}`), integration: index % 2 ? "hue" : "zwave_js",
    }));
    const started = performance.now();
    render(view({ entities: many, areas }));
    // Two integrations open; their 20 devices each start folded.
    expect(groups()).toHaveLength(42);
    expect(names()).toHaveLength(0);
    expect(outline().slice(0, 2)).toEqual(["Philips Hue (0 of 300 chosen)", "  Example device 1 › Other changes (0 of 15 chosen) +"]);
    fireEvent.change(card().getByRole("searchbox", { name: "Search sources" }), { target: { value: "light 59" } });
    // A search opens every path to its 16 matches.
    expect(names()).toHaveLength(16);
    fireEvent.change(card().getByRole("searchbox", { name: "Search sources" }), { target: { value: "" } });
    choose("Group by", "none");
    expect(names()).toHaveLength(600);
    // Every word must match somewhere: "light" and "59" (59, 159 … 559 and 590–599).
    fireEvent.change(card().getByRole("searchbox", { name: "Search sources" }), { target: { value: "light 59" } });
    expect(names()).toHaveLength(16);
    expect(names().slice(0, 3)).toEqual(["Example light 59", "Example light 159", "Example light 259"]);
    expect(results()).toBe("16 of 600 shown, 0 chosen");
    fireEvent.change(card().getByRole("searchbox", { name: "Search sources" }), { target: { value: "" } });
    choose("Group by", "device");
    expect(groups()).toHaveLength(40);
    expect(names()).toHaveLength(0);
    expect(groups()[0]).toBe("Example device 0, Z-Wave JS, Other changes0 of 15 chosen");
    choose("Show", "unchosen");
    expect(names()).toHaveLength(600);
    // Generous for a slow CI machine; locally this takes well under a second.
    expect(performance.now() - started).toBeLessThan(8000);
  });
});

describe("source table helpers", () => {
  const labels = { language: "en", name: (entity: Entity) => entity.name, unnamedDevice: "Unnamed device", missingName: "Source unavailable", category: (category: string) => category };
  const rows = activitySourceRows(entities.filter(entity => origins[entity.entityId]), areas, new Set(), labels);
  const treeLabels = { category: (category: string) => category, noDevice: "Without a device", noIntegration: "Unknown integration", noArea: "Unassigned" };

  it("names integrations readably", () => {
    expect(["zwave_js", "mqtt", "home_connect", "bosch_shc"].map(integrationLabel)).toEqual(["Z-Wave JS", "MQTT", "Home Connect", "Bosch Shc"]);
  });

  it("matches every search word in names, IDs, devices, integrations, areas and types, ignoring accents", () => {
    const match = (text: string) => filterSourceRows(rows, { ...emptySourceFilters, text }, new Set(), new Set(), "en").map(row => row.detail);
    expect(filterSourceRows(rows, { ...emptySourceFilters, text: "kitchen dish" }, new Set(), new Set(), "en").map(row => row.name)).toEqual(["Dishwasher"]);
    expect(filterSourceRows(rows, { ...emptySourceFilters, text: "Hüe" }, new Set(), new Set(), "en").map(row => row.name)).toEqual(["Reading lamp"]);
    expect(match("openings")).toHaveLength(1);
  });

  it("keeps the type order for type groups and sorts other groups by name", () => {
    const sorted = sortSourceRows(rows, { key: "name", direction: "ascending" }, "en");
    expect(buildSourceTree(sorted, "type", "en", treeLabels).map(node => node.parts[0].key))
      .toEqual(["openings", "locks", "alarm", "appliances", "robots", "doorbells", "other"]);
  });

  it("orders levels with the chosen one first and merges only single-child groups", () => {
    expect(sourceLevels("integration")).toEqual(["integration", "device", "type"]);
    expect(sourceLevels("area")).toEqual(["area", "integration", "device", "type"]);
    expect(sourceLevels("device")).toEqual(["device", "integration", "type"]);
    expect(sourceLevels("type")).toEqual(["type", "integration", "device"]);
    expect(sourceLevels("none")).toEqual([]);
    const sorted = sortSourceRows(rows, { key: "name", direction: "ascending" }, "en");
    const shape = (nodes: SourceTreeNode[]): unknown[] => nodes.map(node => node.children.length
      ? { [node.parts.map(part => part.label).join(" › ")]: shape(node.children) } : `${node.parts.map(part => part.label).join(" › ")}: ${node.rows.map(each => each.name).join(", ")}`);
    const zwave = (merge: boolean) => shape(buildSourceTree(sorted, "integration", "en", treeLabels, merge)).find(node => JSON.stringify(node).includes("Z-Wave JS"));
    expect(zwave(false)).toEqual({ "Z-Wave JS": [{ "Front lock": ["locks: Front door"] }, { "Garage controller": ["openings: Garage door"] }] });
    expect(zwave(true)).toEqual({ "Z-Wave JS": ["Front lock › locks: Front door", "Garage controller › openings: Garage door"] });
    // A merged node keeps the innermost path as its key, so folding it survives a change of siblings.
    expect(buildSourceTree(sorted, "integration", "en", treeLabels)[0].key).toBe("/integration:example_bells/device:dev-bell/type:doorbells");
    expect(buildSourceTree(sorted, "none", "en", treeLabels)).toEqual([]);
  });
});

describe("phone layout contract", () => {
  // 375–390px phones, also at 150% text: a phone browser widens its layout viewport to fit anything that overflows,
  // pushing the dock past the edge. The table becomes stacked entries inside the card's own width instead.
  const css: string = sourceFile("components/activity-sources-table.css");
  const phone = css.slice(css.indexOf("@container activity-sources (max-width: 40rem)"));
  const declarations = (source: string, selector: string) => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return [...source.matchAll(new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`, "g"))].map(match => match[1]).join(";");
  };

  it("measures the card, in rem, so text size moves the breakpoint", () => {
    expect(declarations(css, ".activity-sources-card")).toMatch(/container: activity-sources \/ inline-size/);
    expect(phone).not.toBe(css);
  });

  it("turns rows into wrapping entries and the headers into wrapping sort capsules", () => {
    expect(declarations(phone, ".activity-sources-table, .activity-sources-table :is(caption, thead, tbody, tr, th, td)")).toMatch(/display: block/);
    expect(declarations(phone, ".activity-sources-table thead tr")).toMatch(/display: flex; flex-wrap: wrap/);
    expect(declarations(phone, ".activity-sources-table tbody tr")).toMatch(/display: flex; flex-wrap: wrap/);
    expect(declarations(phone, ".activity-sources-table tbody th.activity-sources-name")).toMatch(/flex: 0 0 calc\(100% \+ var\(--check-slot\) \+ var\(--lead-gap\)\)/);
    expect(declarations(phone, ".activity-sources-meta.is-empty")).toMatch(/display: none/);
  });

  it("indents each level by a step capped to the card's width, so deep levels never push past a phone", () => {
    expect(declarations(css, ".activity-sources")).toMatch(/--tree-step: min\(1\.5rem, 4cqi\)/);
    expect(declarations(css, ".activity-sources-lead")).toMatch(/padding-inline-start: calc\(var\(--level, 0\) \* var\(--tree-step\)\)/);
    expect(declarations(phone, ".activity-sources-table tbody tr")).toMatch(/padding: [^;]*calc\(var\(--level, 0\) \* var\(--tree-step\) \+ var\(--check-slot\) \+ var\(--lead-gap\)\)/);
    expect(declarations(phone, ".activity-sources-lead")).toMatch(/padding-inline-start: 0/);
  });

  it("lets long names wrap and never sets a width wider than a phone", () => {
    expect(declarations(css, ".activity-sources-table :is(th, td)")).toMatch(/min-width: 0;[^;]*;[^;]*;[^;]*; overflow-wrap: anywhere/);
    expect(declarations(css, ".activity-sources-filters")).toMatch(/minmax\(min\(100%, 9rem\), 1fr\)/);
    expect(declarations(css, ".activity-sources-filters select")).toMatch(/width: 100%; min-width: 0/);
    for (const selector of [".activity-sources-actions", ".activity-sources-results", ".activity-sources-savebar"]) expect(declarations(css, selector)).toMatch(/flex-wrap: wrap/);
    // No fixed widths beyond the 3rem checkbox gutter and the 12rem save-bar text basis.
    const widths = [...css.matchAll(/(?:^|[;{\s])(?:min-)?width: (\d+(?:\.\d+)?)(rem|px)/g)].map(([, value, unit]) => Number(value) * (unit === "rem" ? 16 : 1));
    expect(Math.max(...widths)).toBeLessThanOrEqual(48);
    expect(css).not.toMatch(/white-space: nowrap;[^}]*overflow-x/);
    expect(css).not.toMatch(/overflow-x: (?:auto|scroll)/);
  });
});
