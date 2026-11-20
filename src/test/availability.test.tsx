import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Notifications from "@/pages/Notifications";
import { mapHome } from "@/lib/ha-model";
import { state } from "./ha-fixtures";
import { emptyPlanner } from "../../shared/configuration";

const mocks = vi.hoisted(() => ({ home: null }));
vi.mock("@/contexts/AppContext", () => ({ useApp: (select = value => value) => select({ currentHome: mocks.home, homeOnline: false }) }));
vi.mock("@/contexts/FamilyContext", () => ({ useFamily: () => ({ language: "en", notifications: emptyPlanner().notifications }) }));
vi.mock("@/components/NotificationCenter", () => ({ NotificationList: () => <div>Household alerts</div> }));
afterEach(cleanup);
it("collapses diagnostics by device and distinguishes unknown from unavailable", () => {
  mocks.home = mapHome({ "sensor.example_one": state("sensor.example_one", "unknown", { friendly_name: "Example reading" }), "sensor.example_two": state("sensor.example_two", "unavailable", { friendly_name: "Other reading" }) }, {
    areas: [], devices: [{ id: "example", name: "Example device" }], entities: [
      { id: "one", entity_id: "sensor.example_one", device_id: "example" }, { id: "two", entity_id: "sensor.example_two", device_id: "example" },
    ],
  }, "home");
  const { container } = render(<MemoryRouter><Notifications /></MemoryRouter>);
  expect(container.querySelector("details")).not.toHaveAttribute("open");
  expect(screen.getByText("1 unavailable · 1 unknown")).toBeInTheDocument();
  expect(screen.getByText("Example device", { exact: false })).toHaveTextContent("(2)");
  expect(screen.getByRole("link", { name: "Example reading", hidden: true })).toHaveAttribute("href", "/devices/example#sensor.example_one");
  expect(screen.getByText("Cached status is stale while disconnected.")).toBeInTheDocument();
});
