import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { AppContext } from "@/contexts/AppContext";
import Areas from "@/pages/Areas";
import type { Entity } from "@/types/api";
import { cardEntity } from "./device-card-fixtures";

afterEach(cleanup);

const summary = (entities: Entity[]) => {
  render(<AppContext.Provider value={{ currentHome: { areas: [{ id: "example", name: "Example room", entities }] }, homeOnline: true } as React.ContextType<typeof AppContext>}>
    <MemoryRouter><Areas /></MemoryRouter>
  </AppContext.Provider>);
  return screen.getByRole("link", { name: /Example room/ }).querySelector("p");
};

it.each([
  { states: ["unknown", "unavailable"], text: "Some readings unavailable" },
  { states: ["on", "unavailable"], text: "1 light on · Some readings unavailable" },
  { states: ["off", "off"], text: "2 devices" },
])("does not present missing light states as switched off or count lights that are off: $states", ({ states, text }) => {
  const entities = states.map((state, index) => ({ ...cardEntity("light", state), entityId: `light.example_${index}` }));
  expect(summary(entities)).toHaveTextContent(text);
  expect(screen.queryByText(/0 lights on/)).not.toBeInTheDocument();
});

it("shows the room temperature with the shared precision and unit spacing", () => {
  const temperature = { ...cardEntity("sensor", "20.37", { device_class: "temperature", unit_of_measurement: "°C" }), entityId: "sensor.example_temperature" };
  const paragraph = summary([{ ...cardEntity("light", "off"), entityId: "light.example" }, temperature]);
  expect(paragraph.textContent).toBe("20.4 °C");
});
