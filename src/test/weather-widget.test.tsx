import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { WeatherWidget } from "@/components/WeatherWidget";
import { mapHome, emptyRegistries } from "@/lib/ha-model";
import { createI18n } from "@/lib/i18n";
import { state } from "./ha-fixtures";

const data = vi.hoisted(() => ({ app: { currentHome: null, homeOnline: true, watchForecast: vi.fn() }, weatherEntity: "", weatherTemperatureEntity: "", weatherPlacement: { today: true, header: false }, language: "en" as "en" | "nb" }));
vi.mock("@/contexts/AppContext", () => ({ useApp: () => data.app }));
vi.mock("@/contexts/FamilyContext", () => ({ useFamily: () => data }));
vi.mock("@/hooks/use-i18n", () => ({ useI18n: () => createI18n(data.language) }));

beforeEach(() => {
  data.weatherEntity = "home|stable-weather";
  data.weatherTemperatureEntity = "";
  data.weatherPlacement = { today: true, header: false };
  data.language = "en";
  data.app.homeOnline = true;
  data.app.currentHome = mapHome({
    "weather.example": state("weather.example", "rainy", { friendly_name: "Example forecast", temperature: 0, temperature_unit: "°C", supported_features: 3 }),
    "sensor.temperature": state("sensor.temperature", "50", { device_class: "temperature", unit_of_measurement: "°F" }),
  }, { ...emptyRegistries, entities: [{ id: "stable-weather", entity_id: "weather.example" }, { id: "stable-temperature", entity_id: "sensor.temperature" }] }, "home");
  data.app.watchForecast.mockReset();
  data.app.watchForecast.mockImplementation((_id, _type, _signal, receive) => receive([{ datetime: "2030-01-01T12:00:00Z", condition: "sunny", temperature: 4 }]));
});
afterEach(() => { cleanup(); vi.useRealTimers(); });
const content = () => <MemoryRouter><WeatherWidget placement="today" /></MemoryRouter>;
const weatherButton = () => screen.getByRole("button", { name: /^Weather:/ });

it.each(["today", "header"] as const)("uses a live temperature entity in %s and the popover without changing forecast units", placement => {
  data.weatherPlacement = { today: true, header: true };
  data.weatherTemperatureEntity = "home|stable-temperature";
  const content = () => <MemoryRouter><WeatherWidget placement={placement} /></MemoryRouter>;
  const view = render(content());
  expect(weatherButton()).toHaveTextContent("50°F");
  expect(weatherButton()).toHaveAccessibleName(/Rainy/);
  fireEvent.click(weatherButton());
  expect(screen.getByRole("dialog")).toHaveTextContent("50°F");
  expect(screen.getByRole("dialog")).toHaveTextContent("4°C");
  expect(data.app.watchForecast.mock.calls[0][0]).toBe("weather.example");
  const sensor = data.app.currentHome.entities[1];
  sensor.state = "0";
  view.rerender(content());
  expect(weatherButton()).toHaveTextContent("0°F");
  expect(screen.getByRole("dialog")).toHaveTextContent("0°F");
  sensor.state = "-2.5";
  data.language = "nb";
  view.rerender(content());
  expect(screen.getByRole("button", { name: /^Vær:/ })).toHaveTextContent("−2,5°F");
  expect(screen.getByRole("dialog")).toHaveTextContent("−2,5°F");
  expect(data.app.watchForecast).toHaveBeenCalledTimes(1);
});

it.each(["unavailable", "unknown", "", " ", "invalid", "Infinity", "missing", "wrong-domain"])("does not substitute weather temperature when the selected temperature entity is %s", value => {
  data.weatherTemperatureEntity = "home|stable-temperature";
  const sensor = data.app.currentHome.entities[1];
  if (value === "missing") data.app.currentHome.entities.pop();
  else if (value === "wrong-domain") sensor.domain = "light";
  else sensor.state = value;
  const view = render(content());
  expect(weatherButton()).toHaveTextContent("—");
  expect(weatherButton()).not.toHaveTextContent("0°C");
  fireEvent.click(weatherButton());
  expect(screen.getByRole("status")).toHaveTextContent("Temperature entity unavailable");
  expect(screen.getByRole("dialog")).toHaveTextContent("4°C");
  data.weatherTemperatureEntity = "";
  view.rerender(content());
  expect(weatherButton()).toHaveTextContent("0°C");
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});

it("keeps independent temperature readings when weather is unavailable, but suppresses them when offline", () => {
  data.weatherTemperatureEntity = "home|stable-temperature";
  data.app.currentHome.entities[0].state = "unavailable";
  const sensor = data.app.currentHome.entities[1];
  delete sensor.attributes.unit_of_measurement;
  data.app.currentHome.temperatureUnit = "°C";
  const view = render(content());
  expect(weatherButton()).toHaveTextContent("50°C");
  expect(weatherButton()).toHaveTextContent("Unavailable");
  fireEvent.click(weatherButton());
  expect(screen.getByRole("dialog")).toHaveTextContent("50°C");
  expect(data.app.watchForecast).not.toHaveBeenCalled();
  data.app.homeOnline = false;
  view.rerender(content());
  expect(weatherButton()).toHaveTextContent("Offline");
  expect(screen.getByRole("dialog")).not.toHaveTextContent("50°C");
});

it("renders only in selected positions and cancels an open forecast when its position is disabled", () => {
  const widgets = () => <MemoryRouter><WeatherWidget placement="today" /><WeatherWidget placement="header" /></MemoryRouter>;
  const view = render(widgets());
  expect(weatherButton()).toHaveClass("today-weather");
  fireEvent.click(weatherButton());
  const signal = data.app.watchForecast.mock.calls[0][2];
  data.weatherPlacement = { today: false, header: true };
  view.rerender(widgets());
  expect(signal.aborted).toBe(true);
  expect(weatherButton()).toHaveClass("header-weather");
  data.weatherPlacement.today = true;
  view.rerender(widgets());
  expect(screen.getAllByRole("button", { name: /^Weather:/ })).toHaveLength(2);
  data.weatherPlacement = { today: false, header: false };
  view.rerender(widgets());
  expect(screen.queryByRole("button", { name: /^Weather:/ })).not.toBeInTheDocument();
  expect(data.weatherEntity).toBe("home|stable-weather");
});

it("stays hidden until a source is selected and displays live reported units and localized readings", () => {
  data.weatherEntity = "";
  const view = render(content());
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  data.weatherEntity = "home|stable-weather";
  view.rerender(content());
  expect(weatherButton()).toHaveTextContent("0°C");
  const entity = data.app.currentHome.entities[0];
  entity.attributes = { ...entity.attributes, temperature: -2.5, temperature_unit: "°F" };
  data.language = "nb";
  view.rerender(content());
  expect(screen.getByRole("button", { name: /Vær: Regn/ })).toHaveTextContent("−2,5°F");
  entity.attributes.temperature = null;
  view.rerender(content());
  expect(screen.getByRole("button")).toHaveTextContent("—");
  expect(screen.getByRole("button")).not.toHaveTextContent("°F");
  expect(data.app.watchForecast).not.toHaveBeenCalled();
});

it("subscribes only while open, changes supported periods, and cancels on close or source replacement", async () => {
  const view = render(content());
  expect(data.app.watchForecast).not.toHaveBeenCalled();
  fireEvent.click(weatherButton());
  expect(screen.getByRole("dialog", { name: "Example forecast" })).toHaveTextContent("4°C");
  expect(data.app.watchForecast.mock.calls[0].slice(0, 2)).toEqual(["weather.example", "hourly"]);
  const hourlySignal = data.app.watchForecast.mock.calls[0][2];
  fireEvent.change(screen.getByRole("combobox", { name: "Forecast" }), { target: { value: "daily" } });
  expect(hourlySignal.aborted).toBe(true);
  const dailySignal = data.app.watchForecast.mock.calls.slice(-1)[0][2];
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  await waitFor(() => expect(dailySignal.aborted).toBe(true));
  await waitFor(() => expect(weatherButton()).toHaveFocus());
  fireEvent.click(weatherButton());
  const reopenedSignal = data.app.watchForecast.mock.calls.slice(-1)[0][2];
  data.weatherEntity = "home|removed-weather";
  view.rerender(content());
  expect(reopenedSignal.aborted).toBe(true);
  expect(screen.getByRole("status")).toHaveTextContent("Choose another source in settings.");
  expect(screen.getByRole("link", { name: "Weather settings" })).toHaveAttribute("href", "/settings/weather");
});

it.each(["offline", "unavailable", "unknown", "missing", "wrong-domain"])("shows %s without stale temperature or forecast requests", status => {
  if (status === "offline") data.app.homeOnline = false;
  else if (status === "missing") data.app.currentHome.entities = [];
  else if (status === "wrong-domain") data.app.currentHome.entities[0].domain = "sensor";
  else data.app.currentHome.entities[0].state = status;
  render(content());
  expect(weatherButton()).toHaveTextContent(status === "offline" ? "Offline" : "Unavailable");
  expect(weatherButton()).not.toHaveTextContent("0°C");
  fireEvent.click(weatherButton());
  expect(data.app.watchForecast).not.toHaveBeenCalled();
});

it("handles forecast timeout and retry and cancels when the connection drops", () => {
  vi.useFakeTimers();
  data.app.watchForecast.mockImplementation(() => {});
  const view = render(content());
  fireEvent.click(weatherButton());
  expect(screen.getByRole("status")).toHaveTextContent("Loading forecast…");
  act(() => vi.advanceTimersByTime(15000));
  expect(screen.getByRole("status")).toHaveTextContent("Forecast unavailable");
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(data.app.watchForecast).toHaveBeenCalledTimes(2);
  const signal = data.app.watchForecast.mock.calls.slice(-1)[0][2];
  data.app.homeOnline = false;
  view.rerender(content());
  expect(signal.aborted).toBe(true);
  expect(screen.getByRole("dialog")).toHaveTextContent("Offline");
});

it("shows current conditions without inventing unsupported forecasts", () => {
  data.app.currentHome.entities[0].attributes.supported_features = 0;
  render(content());
  fireEvent.click(weatherButton());
  expect(screen.getByRole("dialog")).toHaveTextContent("0°C");
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  expect(data.app.watchForecast).not.toHaveBeenCalled();
});
