import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppContext } from "@/contexts/AppContext";
import History from "@/pages/History";
import { emptyRegistries, mapHome } from "@/lib/ha-model";
import { activitySourceRows, filterSourceRows, groupSourceRows, integrationLabel, sortSourceRows, emptySourceFilters } from "@/lib/activity-sources";
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
const table = () => within(card().getByRole("table", { name: "Activity sources" }));
const names = () => table().queryAllByRole("rowheader").filter(cell => cell.getAttribute("scope") === "row").map(cell => cell.querySelector("strong")!.textContent);
const groups = () => table().queryAllByRole("rowheader").filter(cell => cell.getAttribute("scope") === "rowgroup").map(cell => cell.textContent);
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
    expect(within(lock).getAllByRole("cell").map(cell => cell.textContent)).toEqual(["", "Front lock", "Z-Wave JS", "Example hall", "Locks"]);
    expect(within(lock).getByRole("rowheader")).toHaveTextContent("lock.example_front");
    const alarm = box("House alarm").closest("tr")!;
    expect(alarm.querySelectorAll(".is-empty")).toHaveLength(3);
    expect(card().queryByText("Driveway person occupancy")).toBeNull();
    // Readings and administration are never candidates.
    expect(card().queryByText("Hall temperature")).toBeNull();
    expect(card().queryByText("Evening lights")).toBeNull();
  });

  it("groups by type, device, integration and area, with the unassigned group last and n of m chosen", () => {
    render(view());
    expect(groups()).toEqual([
      "Doors and windows1 of 1 chosen", "Locks1 of 1 chosen", "Alarm1 of 1 chosen", "Appliances2 of 2 chosen", "Robot vacuums and mowers1 of 1 chosen",
      "Doorbells1 of 1 chosen", "Camera person detection1 of 1 chosen", "Other changes0 of 1 chosen",
    ]);
    choose("Group by", "device");
    expect(groups()).toEqual([
      "Driveway camera1 of 1 chosen", "Front doorbell unit1 of 1 chosen", "Front lock1 of 1 chosen", "Garage controller1 of 1 chosen", "Kitchen appliances2 of 2 chosen",
      "Lamp0 of 1 chosen", "Robot1 of 1 chosen", "Without a device1 of 1 chosen",
    ]);
    choose("Group by", "integration");
    expect(groups()).toEqual(["Example Bells1 of 1 chosen", "Example Robots1 of 1 chosen", "Frigate1 of 1 chosen", "Home Connect2 of 2 chosen", "Philips Hue0 of 1 chosen", "Z-Wave JS2 of 2 chosen", "Unknown integration1 of 1 chosen"]);
    choose("Group by", "area");
    expect(groups()).toEqual(["Example garage1 of 1 chosen", "Example hall2 of 3 chosen", "Example kitchen2 of 2 chosen", "Unassigned3 of 3 chosen"]);
    expect(names()).toHaveLength(9);
    // Folding a group hides its rows and says so.
    const fold = card().getByRole("button", { name: /^Example hall/ });
    expect(fold).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(fold);
    expect(fold).toHaveAttribute("aria-expanded", "false");
    expect(names()).toHaveLength(6);
    expect(card().queryByRole("checkbox", { name: "Use Reading lamp as a source" })).toBeNull();
    choose("Group by", "none");
    expect(groups()).toEqual([]);
  });

  it("chooses or clears a whole group from its checkbox, with a mixed state in between", () => {
    render(view());
    choose("Group by", "area");
    const hall = groupBox("Example hall");
    expect(hall).toHaveAttribute("aria-checked", "mixed");
    expect(groupBox("Example kitchen")).toHaveAttribute("aria-checked", "true");
    fireEvent.click(hall);
    expect(hall).toHaveAttribute("aria-checked", "true");
    expect(box("Reading lamp")).toBeChecked();
    expect(card().getByText("9 sources chosen")).toBeInTheDocument();
    fireEvent.click(hall);
    expect(hall).toHaveAttribute("aria-checked", "false");
    expect(box("Front door")).not.toBeChecked();
    expect(card().getByText("6 sources chosen")).toBeInTheDocument();
    fireEvent.click(box("Front door"));
    expect(hall).toHaveAttribute("aria-checked", "mixed");
    expect(setActivity).not.toHaveBeenCalled();
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
    expect(groups()).toContain("LocksHidden under Event types1 of 1 chosen");
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

  it("handles hundreds of candidates and starts many groups closed", () => {
    const many: Entity[] = Array.from({ length: 600 }, (_, index) => ({
      ...entities.find(entity => entity.entityId === "light.example_lamp")!, entityId: `light.example_${index}`, preferenceId: id(`light.example_${index}`),
      name: `Example light ${index}`, device: device(`dev-${index % 40}`, `Example device ${index % 40}`), integration: index % 2 ? "hue" : "zwave_js",
    }));
    render(view({ entities: many, areas }));
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
    expect(groups()[0]).toBe("Example device 00 of 15 chosen");
  });
});

describe("source table helpers", () => {
  const labels = { language: "en", name: (entity: Entity) => entity.name, unnamedDevice: "Unnamed device", missingName: "Source unavailable", category: (category: string) => category };
  const rows = activitySourceRows(entities.filter(entity => origins[entity.entityId]), areas, new Set(), labels);

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
    expect(groupSourceRows(sorted, "type", "en", { category: category => category, noDevice: "none", noIntegration: "none", noArea: "none" }).map(group => group.key))
      .toEqual(["openings", "locks", "alarm", "appliances", "robots", "doorbells", "other"]);
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
    expect(declarations(phone, ".activity-sources-table tbody .activity-sources-name")).toMatch(/flex-basis: 100%/);
    expect(declarations(phone, ".activity-sources-meta.is-empty")).toMatch(/display: none/);
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
