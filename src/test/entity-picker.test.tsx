import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { EntityPicker } from "@/components/EntityPicker";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { mapHome } from "@/lib/ha-model";
import { state } from "./ha-fixtures";
import { chooseEntity } from "./entity-picker-helpers";

const home = mapHome({
  "sensor.example_status": state("sensor.example_status", "running", { friendly_name: "Example status" }),
  "sensor.example_time": state("sensor.example_time", "24", { friendly_name: "Example remaining time" }),
  "camera.example": state("camera.example", "idle", { friendly_name: "Example camera" }),
  "calendar.example": state("calendar.example", "off", { friendly_name: "Example calendar" }),
}, {
  areas: [{ area_id: "utility", name: "Example utility room" }],
  devices: [{ id: "washer", name: "Example washer", area_id: "utility" }, { id: "doorbell", name: "Example doorbell" }],
  entities: [
    { entity_id: "sensor.example_status", id: "stable-status", device_id: "washer", platform: "example_integration" },
    { entity_id: "sensor.example_time", id: "stable-time", device_id: "washer" },
    { entity_id: "camera.example", id: "stable-camera", device_id: "doorbell" },
  ],
}, "home");
vi.mock("@/contexts/AppContext", () => ({ useApp: () => ({ currentHome: home }) }));
afterEach(cleanup);

it("narrows by device, returns to all devices and selects stable entity IDs", async () => {
  const change = vi.fn();
  render(<EntityPicker entities={home.entities} label="Source entity" value="" onChange={change} />);
  fireEvent.click(screen.getByRole("button", { name: "Source entity" }));
  expect(screen.getByRole("searchbox")).toHaveFocus();
  screen.getByRole("list").scrollTop = 100;
  fireEvent.click(screen.getByRole("button", { name: "Choose device Example washer" }));
  expect(screen.getByRole("list").scrollTop).toBe(0);
  expect(screen.getByRole("button", { name: /Example remaining time · sensor/ })).toBeVisible();
  expect(screen.queryByRole("button", { name: /Example camera · camera/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Back to devices" }));
  fireEvent.click(screen.getByRole("button", { name: /Without a device/ }));
  expect(screen.getByRole("button", { name: /Example calendar · calendar/ })).toBeVisible();
  expect(screen.queryByRole("button", { name: /Example status · sensor/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Back to devices" }));
  fireEvent.click(screen.getByRole("button", { name: /All entities/ }));
  fireEvent.click(screen.getByRole("button", { name: /Example status · sensor/ }));
  expect(change).toHaveBeenCalledWith("home|stable-status");
  await waitFor(() => expect(screen.getByRole("button", { name: "Source entity" })).toHaveFocus());
});

it("searches across entities, IDs, rooms, integrations and devices, and recovers from no results", () => {
  const change = vi.fn();
  render(<EntityPicker entities={home.entities} label="Source entity" value="" onChange={change} />);
  fireEvent.click(screen.getByRole("button", { name: "Source entity" }));
  const search = screen.getByRole("searchbox");
  screen.getByRole("list").scrollTop = 100;
  for (const query of ["STATUS", "sensor.example_status", "utility status", "example_integration", "washer status"]) {
    fireEvent.change(search, { target: { value: query } });
    expect(screen.getByRole("button", { name: /Example status · sensor/ })).toBeVisible();
    expect(screen.queryByRole("button", { name: /Example camera · camera/ })).not.toBeInTheDocument();
    expect(screen.getByRole("list").scrollTop).toBe(0);
  }
  fireEvent.change(search, { target: { value: "does-not-exist" } });
  expect(screen.getByText("No matching entities. Change or clear the filters.")).toBeVisible();
  fireEvent.change(search, { target: { value: "camera.example" } });
  fireEvent.click(screen.getByRole("button", { name: /Example camera · camera/ }));
  expect(change).toHaveBeenCalledWith("home|stable-camera");
});

it("uses the supplied eligibility list, explains disabled choices, and retains missing selections until cleared", () => {
  const change = vi.fn();
  const view = render(<EntityPicker entities={home.entities.filter(entity => entity.domain === "calendar")} label="Calendar" value="home|calendar.removed" clearLabel="None" onChange={change} disabledReason={() => "Read-only or unavailable"} />);
  expect(screen.getByRole("button", { name: "Calendar" })).toHaveTextContent("calendar.removed");
  fireEvent.click(screen.getByRole("button", { name: "Calendar" }));
  expect(screen.queryByRole("button", { name: /Choose device/ })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Example calendar · calendar/ })).toBeDisabled();
  expect(screen.queryByRole("button", { name: /Example status · sensor/ })).not.toBeInTheDocument();
  expect(change).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "None" }));
  expect(change).toHaveBeenCalledWith("");
  view.rerender(<EntityPicker entities={[]} label="Calendar" value="" onChange={change} disabled />);
  expect(screen.getByRole("button", { name: "Calendar" })).toBeDisabled();
});

it("keeps multiple selections while filtering and allows removal of missing sources", () => {
  function Multiple() {
    const [value, setValue] = useState(["home|stable-status", "home|calendar.removed"]);
    return <EntityPicker multiple entities={home.entities} label="Favorites" value={value} onChange={setValue} />;
  }
  render(<Multiple />);
  const trigger = screen.getByRole("button", { name: "Favorites" });
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole("button", { name: /All entities/ }));
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "camera" } });
  fireEvent.click(screen.getByRole("checkbox", { name: "Example camera" }));
  expect(screen.getByRole("status")).toHaveTextContent("3 selected");
  expect(trigger).toHaveAccessibleDescription("3 selected");
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "" } });
  expect(screen.getByRole("checkbox", { name: "Example status" })).toBeChecked();
  fireEvent.click(screen.getByRole("checkbox", { name: /Entity unavailable · calendar.removed/ }));
  expect(screen.getByRole("status")).toHaveTextContent("2 selected");
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
  expect(screen.getByRole("button", { name: "Favorites" })).toHaveTextContent("Example status, Example camera");
  expect(screen.getByRole("button", { name: "Favorites" })).toHaveAccessibleDescription("Example status, Example camera");
});

it("announces selection alongside help and distinguishes matching names by entity ID", () => {
  const entities = home.entities.filter(entity => entity.domain === "sensor").map(entity => ({ ...entity, name: "Same name" }));
  render(<><p id="picker-help">Choose the source to monitor.</p><EntityPicker multiple label="Sources" describedBy="picker-help" entities={entities} value={[entities[0].preferenceId]} onChange={() => {}} /></>);
  expect(screen.getByRole("button", { name: "Sources" })).toHaveAccessibleDescription("Choose the source to monitor. Same name");
  fireEvent.click(screen.getByRole("button", { name: "Sources" }));
  fireEvent.click(screen.getByRole("button", { name: /All entities/ }));
  expect(screen.getByRole("checkbox", { name: "Same name", description: "sensor.example_status" })).toBeChecked();
  expect(screen.getByRole("checkbox", { name: "Same name", description: "sensor.example_time" })).not.toBeChecked();
});

it("supports arrow navigation, Escape and focus restoration inside another dialog", async () => {
  render(<Dialog open><DialogContent><DialogTitle>Example editor</DialogTitle><EntityPicker label="Source" entities={home.entities} value="" onChange={() => {}} /></DialogContent></Dialog>);
  fireEvent.click(screen.getByRole("button", { name: "Source" }));
  const picker = screen.getByRole("dialog", { name: "Source" });
  fireEvent.keyDown(screen.getByRole("searchbox"), { key: "ArrowDown" });
  expect(within(picker).getByRole("button", { name: /All entities/ })).toHaveFocus();
  fireEvent.keyDown(document.activeElement, { key: "End" });
  expect(screen.getByRole("button", { name: "Choose device Example washer" })).toHaveFocus();
  fireEvent.keyDown(document.activeElement, { key: "Escape" });
  expect(screen.getByRole("dialog", { name: "Example editor" })).toBeVisible();
  expect(screen.queryByRole("dialog", { name: "Source" })).not.toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole("button", { name: "Source" })).toHaveFocus());
});

it("allows wheel and touch scrolling in a modal picker while keeping the background locked", async () => {
  render(<Dialog open><DialogContent><DialogTitle>Example editor</DialogTitle><EntityPicker label="Camera" entities={home.entities} value="" onChange={() => {}} /></DialogContent></Dialog>);
  fireEvent.click(screen.getByRole("button", { name: "Camera" }));
  fireEvent.click(screen.getByRole("button", { name: /All entities/ }));
  const list = screen.getByRole("list");
  // JSDOM has no layout; give the real scroll-lock handlers a scrollable result list.
  Object.defineProperties(list, { scrollHeight: { value: 1000 }, clientHeight: { value: 200 } });
  list.style.overflowY = "auto";
  await waitFor(() => expect(document.body).toHaveAttribute("data-scroll-locked"));
  expect(fireEvent.wheel(list, { deltaY: 80, cancelable: true })).toBe(true);
  fireEvent.touchStart(list, { touches: [{ clientX: 0, clientY: 100 }], changedTouches: [{ clientX: 0, clientY: 100 }] });
  expect(fireEvent.touchMove(list, { touches: [{ clientX: 0, clientY: 20 }], changedTouches: [{ clientX: 0, clientY: 20 }], cancelable: true })).toBe(true);
  expect(fireEvent.wheel(document.body, { deltaY: 80, cancelable: true })).toBe(false);
  fireEvent.click(within(screen.getByRole("dialog", { name: "Camera" })).getByRole("button", { name: "Close" }));
  expect(screen.getByRole("dialog", { name: "Example editor" })).toBeVisible();
  await waitFor(() => expect(screen.getByRole("button", { name: "Camera" })).toHaveFocus());
});

it("updates the displayed name when an entity is renamed without changing the saved value", () => {
  const change = vi.fn();
  const view = render(<EntityPicker entities={home.entities} label="Source" value="home|stable-status" onChange={change} />);
  view.rerender(<EntityPicker entities={home.entities.map(entity => entity.preferenceId === "home|stable-status" ? { ...entity, name: "Renamed example" } : entity)} label="Source" value="home|stable-status" onChange={change} />);
  expect(screen.getByRole("button", { name: "Source" })).toHaveTextContent("Renamed example");
  expect(screen.getByRole("button", { name: "Source" })).toHaveAccessibleDescription("Renamed example");
  expect(change).not.toHaveBeenCalled();
  chooseEntity("Source", "sensor.example_status");
  expect(change).toHaveBeenCalledWith("home|stable-status");
});
