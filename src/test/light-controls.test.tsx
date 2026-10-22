import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DeviceControl } from "@/components/devices/DeviceControl";
import { emptyRegistries, mapHome } from "@/lib/ha-model";
import { services, state } from "./ha-fixtures";

const app = vi.hoisted(() => ({ homeOnline: true, commands: {}, services: {}, currentHome: { temperatureUnit: "°C" }, command: vi.fn() }));
vi.mock("@/contexts/AppContext", () => ({ useApp: () => app }));
const light = () => mapHome({ "light.example": state("light.example", "on", {
  friendly_name: "Example lamp", supported_color_modes: ["rgb", "color_temp", "white"], brightness: 128,
  rgb_color: [255, 128, 0], color_temp_kelvin: 3000, min_color_temp_kelvin: 2200, max_color_temp_kelvin: 6500,
  supported_features: 4, effect_list: ["None", "Rainbow"], effect: "None",
}) }, emptyRegistries, "test").entities[0];
beforeEach(() => {
  app.homeOnline = true; app.commands = {}; app.services = services; app.command.mockReset().mockResolvedValue(undefined);
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("dims to 1% with the keyboard and uses the toggle to turn off", () => {
  render(<DeviceControl entity={light()} />);
  const brightness = screen.getByRole("slider", { name: "Example lamp brightness" });
  expect(brightness).toHaveAttribute("aria-valuemin", "1");
  fireEvent.keyDown(brightness, { key: "Home" });
  expect(app.command).toHaveBeenLastCalledWith("light.example", "brightness", 1);
  fireEvent.keyDown(brightness, { key: "End" });
  expect(app.command).toHaveBeenLastCalledWith("light.example", "brightness", 100);
  fireEvent.click(screen.getByRole("switch"));
  expect(app.command).toHaveBeenLastCalledWith("light.example", "turn_off", undefined);
});

it("sets temperature, applies a color draft once, and selects supported white and effects", () => {
  render(<DeviceControl entity={light()} />);
  const temperature = screen.getByRole("slider", { name: "Example lamp color temperature" });
  expect(temperature).toHaveAttribute("aria-valuemin", "2200");
  expect(temperature).toHaveAttribute("aria-valuemax", "6500");
  fireEvent.keyDown(temperature, { key: "Home" });
  expect(app.command).toHaveBeenLastCalledWith("light.example", "color_temp_kelvin", 2200);
  app.command.mockClear();
  const color = screen.getByLabelText("Color for Example lamp");
  expect(color).toHaveValue("#ff8000");
  fireEvent.change(color, { target: { value: "#3366ff" } });
  expect(app.command).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Apply color" }));
  expect(app.command).toHaveBeenCalledExactlyOnceWith("light.example", "rgb_color", [51, 102, 255]);
  fireEvent.click(screen.getByRole("button", { name: "White light" }));
  expect(app.command).toHaveBeenLastCalledWith("light.example", "white", 50);
  fireEvent.change(screen.getByRole("combobox", { name: "Effect for Example lamp" }), { target: { value: "Rainbow" } });
  expect(app.command).toHaveBeenLastCalledWith("light.example", "effect", "Rainbow");
});

it("hides unsupported controls and disables supported ones while offline, unavailable or pending", () => {
  const entity = light();
  const view = render(<DeviceControl entity={{ ...entity, attributes: { supported_color_modes: ["onoff"] } }} />);
  expect(screen.queryByRole("slider")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Color for Example lamp")).not.toBeInTheDocument();
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  for (const status of ["offline", "unavailable", "pending"]) {
    app.homeOnline = status !== "offline";
    app.commands = status === "pending" ? { "light.example": { pending: true } } : {};
    view.rerender(<DeviceControl entity={{ ...entity, state: status === "unavailable" ? "unavailable" : "on" }} />);
    expect(screen.getByRole("slider", { name: "Example lamp brightness" })).toHaveAttribute("data-disabled");
    expect(screen.getByLabelText("Color for Example lamp")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Apply color" })).toBeDisabled();
    expect(screen.getByRole("combobox")).toBeDisabled();
  }
  expect(app.command).not.toHaveBeenCalled();
});

it("does not display zero percent for an off light or a sub-percent reading", () => {
  const entity = light();
  const view = render(<DeviceControl entity={{ ...entity, state: "off", attributes: { ...entity.attributes, brightness: null } }} />);
  expect(screen.getByRole("slider", { name: "Example lamp brightness" })).toHaveAttribute("aria-valuenow", "1");
  expect(screen.queryByText("0%")).not.toBeInTheDocument();
  view.rerender(<DeviceControl entity={{ ...entity, attributes: { ...entity.attributes, brightness: 1 } }} />);
  expect(screen.getByText("1%")).toBeInTheDocument();
});
