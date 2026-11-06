import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { EventEditor } from "@/components/FamilyPlanner";
import type { FamilyEvent } from "@/contexts/FamilyContext";

const app = vi.hoisted(() => ({ haUrl: "https://ha.example", homeOnline: true, services: {}, commands: {}, command: vi.fn().mockResolvedValue(undefined), currentHome: {
  timeZone: "UTC", entities: [{ entityId: "calendar.example", preferenceId: "home|calendar.example", name: "Example calendar", domain: "calendar", state: "off", attributes: { supported_features: 4 } }],
} }));
vi.mock("@/contexts/AppContext", () => ({ useApp: () => app }));
vi.mock("@/contexts/FamilyContext", async importOriginal => ({ ...await importOriginal<typeof import("@/contexts/FamilyContext")>(), useFamily: () => ({
  today: "2026-10-28", members: [{ id: "example", name: "Example person" }], memberName: () => "Example person", connectedPlanner: true, calendarMembers: { "home|calendar.example": "example" },
}) }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

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
