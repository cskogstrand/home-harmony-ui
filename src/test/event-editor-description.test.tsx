import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { EventEditor } from "@/components/FamilyPlanner";
import type { FamilyEvent } from "@/contexts/FamilyContext";

const app = vi.hoisted(() => ({ haUrl: "https://ha.example", homeOnline: true, services: {}, commands: {}, command: vi.fn().mockResolvedValue(undefined), currentHome: {
  timeZone: "UTC", areas: [], devices: [], entities: [{ entityId: "calendar.example", preferenceId: "home|calendar.example", name: "Example calendar", domain: "calendar", state: "off", attributes: { supported_features: 4 } }],
} }));
const saveEvent = vi.hoisted(() => vi.fn().mockReturnValue(true));
vi.mock("@/contexts/AppContext", () => ({ useApp: () => app }));
vi.mock("@/contexts/FamilyContext", async importOriginal => ({ ...await importOriginal<typeof import("@/contexts/FamilyContext")>(), useFamily: () => ({
  today: "2026-10-28", time: "10:05", members: [{ id: "example", name: "Example person" }], memberName: () => "Example person", connectedPlanner: true, calendarMembers: { "home|calendar.example": "example" }, saveEvent,
}) }));
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

it("preserves the duration when moving a future local plan's start time", () => {
  const event: FamilyEvent = { id: "example", title: "Example plan", date: "2026-11-02", time: "09:00", endTime: "10:00", member: "example", location: "", note: "" };
  render(<MemoryRouter><EventEditor open onOpenChange={() => {}} onSaved={() => {}} event={event} /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText("Time"), { target: { value: "09:30" } });
  expect(screen.getByLabelText("End time (optional)")).toHaveValue("10:30");
  fireEvent.click(screen.getByRole("button", { name: "Save plan" }));
  expect(saveEvent).toHaveBeenCalledWith({ ...event, time: "09:30", endTime: "10:30" });
});

it("keeps normalized waste dates read-only even when the source supports editing", () => {
  const event: FamilyEvent = { id: "pickup", title: "Paper", date: "2026-10-28", time: "00:00", allDay: true, wasteCollection: true, member: "example", location: "", note: "",
    calendarId: "calendar.example", calendarEvent: { uid: "pickup", summary: "Paper", start: "2026-10-28T01:00:00Z", end: "2026-10-31T23:00:00Z" },
  };
  render(<MemoryRouter><EventEditor open onOpenChange={() => {}} onSaved={() => {}} event={event} /></MemoryRouter>);
  expect(screen.getByRole("dialog")).toHaveTextContent("Waste collections use the collection date only.");
  expect(screen.getByRole("heading", { name: "Paper" }).querySelector(".lucide-newspaper")).toBeInTheDocument();
  expect(screen.queryByLabelText("What’s happening?")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Save plan" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  expect(app.command).not.toHaveBeenCalled();
});

it("previews an editable description while saving its original HTML unchanged", async () => {
  const description = '<p style="color:red">Example <strong>reservation</strong></p><p><a href="https://example.com/booking">Booking details</a></p>';
  const event: FamilyEvent = { id: "example", title: "Example reservation", date: "2026-10-28", time: "16:00", member: "example", location: "Example venue", note: description,
    calendarId: "calendar.example", calendarEvent: { uid: "example", summary: "Example reservation", start: "2026-10-28T16:00:00Z", end: "2026-10-28T17:00:00Z", description },
  };
  const onSaved = vi.fn();
  render(<MemoryRouter><EventEditor open onOpenChange={() => {}} onSaved={onSaved} event={event} /></MemoryRouter>);
  expect(screen.getByRole("link", { name: "Booking details" })).toHaveAttribute("href", "https://example.com/booking");
  expect(screen.getByLabelText("A little reminder")).toHaveValue(description);
  fireEvent.change(screen.getByLabelText("What’s happening?"), { target: { value: "Updated reservation" } });
  fireEvent.click(screen.getByRole("button", { name: "Save plan" }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
  expect(app.command).toHaveBeenCalledWith("calendar.example", "update_event", expect.objectContaining({ event: expect.objectContaining({ summary: "Updated reservation", description }) }));
});

it("creates all-day plans with an exclusive HA end date and preserves timed duration", async () => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  app.currentHome.entities[0].attributes.supported_features = 1;
  app.services = { calendar: { create_event: {} } };
  render(<MemoryRouter><EventEditor open onOpenChange={() => {}} onSaved={() => {}} /></MemoryRouter>);
  expect(screen.getByLabelText("Time")).toHaveValue("10:30");
  fireEvent.change(screen.getByLabelText("Time"), { target: { value: "12:00" } });
  expect(screen.getByLabelText("End time")).toHaveValue("13:00");
  fireEvent.change(screen.getByLabelText("What’s happening?"), { target: { value: "Example holiday" } });
  fireEvent.click(screen.getByRole("switch", { name: "All day" }));
  expect(screen.queryByLabelText("Time")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Save plan" }));
  await waitFor(() => expect(app.command).toHaveBeenCalledWith("calendar.example", "create_event", { summary: "Example holiday", start_date: "2026-10-28", end_date: "2026-10-29", location: "", description: "" }));
});
