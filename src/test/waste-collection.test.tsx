import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { WasteCollection } from "@/components/WasteCollection";
import { emptyRegistries, mapHome } from "@/lib/ha-model";
import { createI18n } from "@/lib/i18n";
import type { CalendarEvent } from "@/types/api";
import { state } from "./ha-fixtures";

const data = vi.hoisted(() => ({
  app: { currentHome: null, homeOnline: true, haUrl: "https://ha.example", watchCalendarEvents: vi.fn() },
  today: "2026-10-24", time: "08:59", wasteCollectionDays: 7, wasteCalendarEntity: "home|stable-waste", language: "en" as "en" | "nb",
}));
vi.mock("@/contexts/AppContext", () => ({ useApp: () => data.app }));
vi.mock("@/contexts/FamilyContext", async importOriginal => ({ ...await importOriginal<typeof import("@/contexts/FamilyContext")>(), useFamily: () => data }));
vi.mock("@/hooks/use-i18n", () => ({ useI18n: () => createI18n(data.language) }));

// Fictional waste calendar and schedule, including the daylight-saving transition.
const events: CalendarEvent[] = [
  { summary: "Paper", start: { date: "2026-10-27" }, end: { date: "2026-10-28" } },
  { summary: "Food waste", start: "2026-10-24", end: "2026-10-25" },
  { summary: "Glass", start: "2026-10-29", end: "2026-10-30" },
  { summary: "Residual waste", start: { dateTime: "2026-10-24T22:30:00Z" }, end: { dateTime: "2026-10-24T23:30:00Z" } },
  { summary: "Past collection", start: "2026-10-23", end: "2026-10-24" },
  { summary: "Outside range", start: "2027-01-22", end: "2027-01-23" },
];
beforeEach(() => {
  data.today = "2026-10-24";
  data.time = "08:59";
  data.wasteCollectionDays = 7;
  data.wasteCalendarEntity = "home|stable-waste";
  data.language = "en";
  data.app.homeOnline = true;
  data.app.haUrl = "https://ha.example";
  data.app.currentHome = mapHome({ "calendar.example": state("calendar.example", "off", { friendly_name: "Example waste calendar" }) },
    { ...emptyRegistries, entities: [{ id: "stable-waste", entity_id: "calendar.example" }] }, "home");
  data.app.currentHome.timeZone = "Europe/Oslo";
  data.app.watchCalendarEvents.mockReset();
  data.app.watchCalendarEvents.mockImplementation((_id, _from, _to, _signal, receive) => receive(events));
});
afterEach(cleanup);

it.each([
  ["Mat- og Restavfall", ["apple", "trash2"]],
  ["MATAVFALL / REST-AVFALL", ["apple", "trash2"]],
  ["Mat rester", ["apple"]],
  ["Bioavfall", ["apple"]],
  ["Våtorganisk", ["apple"]],
  ["Food waste and general waste", ["apple", "trash2"]],
  ["Organic waste", ["apple"]],
  ["Brennbart", ["trash2"]],
  ["Residual waste", ["trash2"]],
  ["Papp og papir", ["newspaper"]],
  ["PAPIRAVFALL, drikkekartong og papp-avfall", ["newspaper"]],
  ["Paper, cardboard and cartons", ["newspaper"]],
  ["Plastemballasje", ["milk"]],
  ["Plastikk / plast-avfall", ["milk"]],
  ["Plastic packaging", ["milk"]],
  ["Glass- og metallemballasje", ["wine", "cylinder"]],
  ["Glassavfall / hermetikk", ["wine", "cylinder"]],
  ["Glass packaging, metal cans and tins", ["wine", "cylinder"]],
  ["Hageavfall / garden waste", ["leaf"]],
  ["Farlig avfall / spesialavfall", ["triangle-alert"]],
  ["EE-avfall og elektronikk", ["plug-zap"]],
  ["E-waste / electronics", ["plug-zap"]],
  ["Tekstil, tekstiler, klær og tøy", ["shirt"]],
  ["Textiles and clothing", ["shirt"]],
  ["Ukjent avfallstype", ["trash2"]],
  ["Glassfiber og plastikkirurgi", ["trash2"]],
  ["", ["trash2"]],
])("matches waste icons for %j without changing the title", (summary, expectedIcons) => {
  data.app.watchCalendarEvents.mockImplementation((_id, _from, _to, _signal, receive) => receive([
    { summary, start: data.today, end: "2026-10-25" },
  ]));
  render(<WasteCollection />);
  const title = screen.getByRole("heading", { level: 3, name: summary || "Waste collection" });
  const icons = title.querySelectorAll("svg");
  expect(icons).toHaveLength(expectedIcons.length);
  expectedIcons.forEach((icon, index) => expect(icons[index]).toHaveClass(`lucide-${icon}`));
  expect(title.querySelector(".waste-collection-icons")).toHaveAttribute("aria-hidden", "true");
});

it("shows the next three collections in the home's timezone with literal waste types", () => {
  data.language = "nb";
  render(<WasteCollection />);
  const panel = screen.getByRole("region", { name: "Tømmevarsler" });
  const rows = within(panel).getAllByRole("listitem");
  expect(rows).toHaveLength(3);
  expect(rows[0]).toHaveTextContent("Food wasteI dag");
  expect(rows[1]).toHaveTextContent("Residual wasteI morgen00:30");
  expect(rows[2]).toHaveTextContent("Paper");
  expect(rows[2]).toHaveTextContent("Om 3 dager");
  expect(rows[2].querySelector("time")).toHaveAttribute("datetime", "2026-10-27");
  expect(panel).not.toHaveTextContent("Past collection");
  expect(panel).not.toHaveTextContent("Glass");
  expect(data.app.watchCalendarEvents.mock.calls[0].slice(0, 3)).toEqual(["calendar.example", "2026-10-23T22:00:00.000Z", "2026-10-31T23:00:00.000Z"]);
});

it("marks today's pickups at 09:00 without refetching, until the home date changes", () => {
  const view = render(<WasteCollection />);
  expect(screen.getByText("Food waste").closest("li")).toHaveTextContent("Today");
  data.time = "09:00";
  view.rerender(<WasteCollection />);
  expect(screen.getByText("Food waste").closest("li")).toHaveTextContent("Picked up today");
  expect(screen.getByText("Residual waste").closest("li")).toHaveTextContent("Tomorrow");
  data.time = "23:59";
  data.language = "nb";
  view.rerender(<WasteCollection />);
  expect(screen.getByText("Food waste").closest("li")).toHaveTextContent("Tømt i dag");
  expect(data.app.watchCalendarEvents).toHaveBeenCalledTimes(1);
  data.today = "2026-10-25";
  data.time = "00:00";
  view.rerender(<WasteCollection />);
  expect(screen.queryByText("Food waste")).not.toBeInTheDocument();
  expect(screen.getByText("Residual waste").closest("li")).toHaveTextContent("I dag");
  expect(screen.queryByText("Tømt i dag")).not.toBeInTheDocument();
});

it("includes the configured last day, hides later pickups and supports today only", () => {
  data.wasteCollectionDays = 3;
  data.app.watchCalendarEvents.mockImplementation((_id, _from, _to, _signal, receive) => receive(events.filter(event => ["Paper", "Glass"].includes(event.summary))));
  const view = render(<WasteCollection />);
  expect(screen.getByText("Paper").closest("li")).toHaveTextContent("In 3 days");
  expect(screen.queryByText("Glass")).not.toBeInTheDocument();
  data.wasteCollectionDays = 2;
  view.rerender(<WasteCollection />);
  expect(screen.queryByRole("region", { name: "Waste collection" })).not.toBeInTheDocument();
  data.app.watchCalendarEvents.mockImplementation((_id, _from, _to, _signal, receive) => receive(events));
  data.wasteCollectionDays = 0;
  view.rerender(<WasteCollection />);
  expect(screen.getAllByRole("listitem")).toHaveLength(1);
  expect(screen.getByText("Food waste")).toBeInTheDocument();
});

it("counts calendar days across the year boundary", () => {
  data.today = "2026-12-31";
  data.app.watchCalendarEvents.mockImplementation((_id, _from, _to, _signal, receive) => receive([
    { summary: "Example collection", start: "2027-01-02", end: "2027-01-03" },
  ]));
  render(<WasteCollection />);
  expect(screen.getByText("In 2 days")).toBeInTheDocument();
});

it("distinguishes loading, errors and empty calendars and supports retry and live updates", () => {
  data.app.watchCalendarEvents.mockImplementation(() => {});
  render(<WasteCollection />);
  expect(screen.getByRole("status")).toHaveTextContent("Loading your calendar");
  const [, , , signal, receive] = data.app.watchCalendarEvents.mock.calls[0];
  act(() => receive(null));
  expect(screen.getByRole("alert")).toHaveTextContent("Could not load waste collections");
  fireEvent.click(screen.getByRole("button", { name: "Refresh waste collections" }));
  expect(signal.aborted).toBe(true);
  const retry = data.app.watchCalendarEvents.mock.calls[1][4];
  act(() => retry([]));
  expect(screen.queryByRole("region", { name: "Waste collection" })).not.toBeInTheDocument();
  act(() => retry(events));
  expect(screen.getByText("Food waste")).toBeInTheDocument();
});

it.each(["missing", "unavailable", "offline", "unconfigured"])("does not request or show an empty schedule when %s", condition => {
  if (condition === "missing") data.app.currentHome.entities = [];
  if (condition === "unavailable") data.app.currentHome.entities[0].state = "unavailable";
  if (condition === "offline") data.app.homeOnline = false;
  if (condition === "unconfigured") data.wasteCalendarEntity = "";
  render(<WasteCollection />);
  expect(data.app.watchCalendarEvents).not.toHaveBeenCalled();
  expect(screen.getByRole("status")).toHaveTextContent(condition === "offline" ? "offline" : condition === "unconfigured" ? "Choose a waste collection calendar" : "calendar unavailable");
  expect(screen.queryByRole("list")).not.toBeInTheDocument();
});

it("aborts and ignores old results on calendar changes, disconnection, date rollover and unmount", () => {
  const view = render(<WasteCollection />);
  const first = data.app.watchCalendarEvents.mock.calls[0];
  data.wasteCalendarEntity = "home|another-waste";
  data.app.currentHome.entities[0].preferenceId = data.wasteCalendarEntity;
  data.app.currentHome.entities[0].entityId = "calendar.other";
  data.app.watchCalendarEvents.mockImplementation(() => {});
  view.rerender(<WasteCollection />);
  expect(first[3].aborted).toBe(true);
  act(() => first[4](events));
  expect(screen.queryByText("Food waste")).not.toBeInTheDocument();
  const second = data.app.watchCalendarEvents.mock.calls[1];
  act(() => second[4](events));
  data.app.homeOnline = false;
  view.rerender(<WasteCollection />);
  expect(second[3].aborted).toBe(true);
  expect(screen.queryByText("Food waste")).not.toBeInTheDocument();
  data.app.homeOnline = true;
  view.rerender(<WasteCollection />);
  expect(screen.getByRole("status")).toHaveTextContent("Loading your calendar");
  const third = data.app.watchCalendarEvents.mock.calls[2];
  data.today = "2026-10-25";
  view.rerender(<WasteCollection />);
  expect(third[3].aborted).toBe(true);
  const fourth = data.app.watchCalendarEvents.mock.calls[3];
  act(() => fourth[4](events));
  expect(screen.queryByText("Food waste")).not.toBeInTheDocument();
  expect(screen.getByText("Residual waste").closest("li")).toHaveTextContent("Today00:30");
  view.unmount();
  expect(fourth[3].aborted).toBe(true);
});
