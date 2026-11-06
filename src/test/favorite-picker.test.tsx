import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { FavoritePicker } from "@/components/FavoritePicker";
import { TooltipProvider } from "@/components/ui/tooltip";
import { emptyConfiguration } from "../../shared/configuration";
import { cardEntity, cardServices } from "./device-card-fixtures";

const mocks = vi.hoisted(() => ({ app: null, shared: null, save: vi.fn(), command: vi.fn() }));
vi.mock("@/contexts/AppContext", () => ({ useApp: () => mocks.app }));
vi.mock("@/contexts/SharedConfigurationContext", () => ({ useSharedConfiguration: () => mocks.shared }));
const light = cardEntity("light", "on", { brightness: 128, supported_color_modes: ["brightness"] });
const toggle = cardEntity("input_boolean", "off");
const unknown = cardEntity("future_domain", "idle");
const missing = "example|sensor.removed";
const open = (selected = [light.preferenceId, missing], groups = {}, savedGroups = []) => render(<MemoryRouter><TooltipProvider><FavoritePicker selected={selected} groups={groups} savedGroups={savedGroups} onSave={mocks.save} onCancel={() => {}} /></TooltipProvider></MemoryRouter>);
const chooseGroup = (card: string, group: string) => {
  fireEvent.click(screen.getByRole("button", { name: `Card group for ${card}` }));
  fireEvent.change(screen.getByRole("combobox", { name: "Search groups" }), { target: { value: group.toLowerCase() } });
  fireEvent.click(screen.getByRole("option", { name: group }));
};
beforeEach(() => {
  mocks.save.mockReset(); mocks.command.mockReset();
  mocks.app = { currentHome: { entities: [light, toggle, unknown], areas: [] }, homeOnline: true, commands: {}, services: cardServices, command: mocks.command };
  mocks.shared = { state: { loaded: true, config: emptyConfiguration() } };
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("selects by type without losing other types, missing selections or saved order", () => {
  open(undefined, { [missing]: "Example group" });
  expect(screen.getByRole("button", { name: "Light 1 available" })).toHaveAttribute("aria-pressed", "true");
  chooseGroup(light.name, "Example group");
  fireEvent.click(screen.getByRole("button", { name: "Switch & toggle 1 available" }));
  expect(screen.getByRole("button", { name: "Switch & toggle 1 available" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "Choose favorites: Switch & toggle" }));
  expect(screen.queryByRole("checkbox", { name: light.name })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("checkbox", { name: toggle.name }));
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
  fireEvent.click(screen.getByRole("button", { name: "Other entities 1 available" }));
  fireEvent.click(screen.getByRole("button", { name: "Choose favorites: Other entities" }));
  fireEvent.click(screen.getByRole("checkbox", { name: unknown.name }));
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
  expect(mocks.save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Save favorites" }));
  expect(mocks.save).toHaveBeenCalledWith([light.preferenceId, missing, toggle.preferenceId, unknown.preferenceId], { [light.preferenceId]: "Example group", [missing]: "Example group" }, ["Example group"]);
  expect(mocks.command).not.toHaveBeenCalled();
});

it("keeps unavailable favorites until removal is confirmed and disables saving on storage errors", async () => {
  const view = open();
  fireEvent.click(screen.getByRole("button", { name: "Remove sensor.removed from favorites" }));
  fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancel" }));
  expect(screen.getByText("sensor.removed")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Remove sensor.removed from favorites" }));
  await act(async () => { fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Remove favorites" })); });
  expect(screen.queryByText("sensor.removed")).not.toBeInTheDocument();
  mocks.shared.state.error = "Save failed";
  view.rerender(<MemoryRouter><TooltipProvider><FavoritePicker selected={[]} groups={{}} savedGroups={[]} onSave={mocks.save} onCancel={() => {}} /></TooltipProvider></MemoryRouter>);
  expect(screen.getByRole("button", { name: "Save favorites" })).toBeDisabled();
  expect(screen.getByRole("button", { name: `Card group for ${light.name}` })).toBeDisabled();
  expect(screen.getByRole("alert")).toHaveTextContent("Save failed");
});


it("creates reusable groups, rejects duplicate names, searches choices and removes groups without removing cards", () => {
  open(undefined, { [missing]: "Existing group" }, ["Empty group"]);
  const add = screen.getByRole("button", { name: "Add group" });
  const input = screen.getByRole("textbox", { name: "New group name" });
  expect(add).toBeDisabled();
  fireEvent.change(input, { target: { value: "  Example group  " } });
  fireEvent.click(add);
  expect(input).toHaveValue("");
  fireEvent.change(input, { target: { value: "example GROUP" } });
  expect(add).toBeDisabled();
  expect(screen.getByText("A group with this name already exists.")).toBeVisible();
  fireEvent.change(input, { target: { value: "" } });
  fireEvent.click(screen.getByRole("button", { name: `Card group for ${light.name}` }));
  const search = screen.getByRole("combobox", { name: "Search groups" });
  fireEvent.change(search, { target: { value: "not found" } });
  expect(screen.getByText("No matching groups.")).toBeVisible();
  fireEvent.change(search, { target: { value: "EXAMPLE" } });
  expect(screen.queryByRole("option", { name: "Existing group" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("option", { name: "Example group" }));
  expect(screen.getByRole("button", { name: `Card group for ${light.name}` })).toHaveTextContent("Example group");
  expect(screen.getByRole("button", { name: `Card group for ${light.name}` })).toHaveAccessibleDescription("Example group");
  chooseGroup(light.name, "Ungrouped");
  expect(screen.getByRole("button", { name: `Card group for ${light.name}` })).toHaveTextContent("Ungrouped");
  chooseGroup(light.name, "Example group");
  fireEvent.click(screen.getByRole("button", { name: "Remove group Example group" }));
  expect(screen.getByRole("button", { name: `Card group for ${light.name}` })).toHaveTextContent("Ungrouped");
  expect(screen.getByRole("listitem", { name: light.name })).toBeInTheDocument();
  expect(mocks.save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Save favorites" }));
  expect(mocks.save).toHaveBeenCalledWith([light.preferenceId, missing], { [missing]: "Existing group" }, ["Empty group", "Existing group"]);
});
