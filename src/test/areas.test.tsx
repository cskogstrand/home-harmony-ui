import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { AppContext } from "@/contexts/AppContext";
import Areas from "@/pages/Areas";
import { cardEntity } from "./device-card-fixtures";

afterEach(cleanup);

it.each([
  { states: ["unknown", "unavailable"], summary: "Some readings unavailable" },
  { states: ["on", "unavailable"], summary: "1 light on · Some readings unavailable" },
  { states: ["off", "off"], summary: "0 lights on" },
])("does not present missing light states as switched off: $states", ({ states, summary }) => {
  const entities = states.map((state, index) => ({ ...cardEntity("light", state), entityId: `light.example_${index}` }));
  render(<AppContext.Provider value={{ currentHome: { areas: [{ id: "example", name: "Example room", entities }] }, homeOnline: true } as React.ContextType<typeof AppContext>}>
    <MemoryRouter><Areas /></MemoryRouter>
  </AppContext.Provider>);
  expect(screen.getByRole("link", { name: new RegExp(`Example room`) }).querySelector("p")).toHaveTextContent(summary);
  if (states.every(state => state !== "on" && state !== "off")) expect(screen.queryByText("0 lights on")).not.toBeInTheDocument();
});
