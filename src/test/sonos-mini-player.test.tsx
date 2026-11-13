import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Link, MemoryRouter } from "react-router-dom";
import { SonosMiniPlayer } from "@/components/sonos/SonosMiniPlayer";
import { musicFolder, sonosEntities, sonosServices, speaker } from "./sonos-fixtures";

const mocks = vi.hoisted(() => ({ app: null }));
vi.mock("@/contexts/AppContext", () => ({ useApp: () => mocks.app }));
const content = (path = "/") => <MemoryRouter initialEntries={[path]}><SonosMiniPlayer /><Link to="/settings/appearance">Settings route</Link><Link to="/calendar">Calendar route</Link><Link to="/sonos">Sonos route</Link></MemoryRouter>;
const openRooms = () => fireEvent.keyDown(within(mini()).getByRole("button", { name: "Choose a speaker" }), { key: "Enter" });
const mini = () => screen.getByRole("region", { name: "Sonos mini player" });
beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  mocks.app = { currentHome: { entities: sonosEntities() }, homeOnline: true, services: sonosServices, commands: {},
    command: vi.fn().mockResolvedValue(undefined), browseMedia: vi.fn().mockResolvedValue(musicFolder()), sonosQueue: vi.fn().mockResolvedValue([]) };
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

it.each(["/", "/calendar", "/lists", "/school", "/home", "/cameras", "/devices/example", "/notifications"])("shows playback on %s", path => {
  render(content(path));
  expect(mini()).toBeVisible();
  expect(mocks.app.browseMedia).not.toHaveBeenCalled();
});
it.each(["/settings", "/settings/appearance", "/user-settings", "/onboarding", "/sonos", "/sonos/", "/sonos?player=media_player.studio"])("omits playback from excluded route %s", path => {
  render(content(path)); expect(screen.queryByRole("region")).not.toBeInTheDocument();
});
it("uses the coordinator source to exclude TV, not the track title or a follower's stale source", async () => {
  mocks.app.currentHome.entities[0].attributes.source = "TV";
  const view = render(content());
  expect(screen.queryByRole("region")).not.toBeInTheDocument();
  mocks.app.currentHome.entities[0].attributes.source = "Spotify";
  mocks.app.currentHome.entities[0].attributes.media_title = "TV";
  mocks.app.currentHome.entities[1].attributes.source = "TV";
  view.rerender(content()); await waitFor(() => expect(mini()).toBeVisible());
});
it("does not summon playback for paused, unavailable, missing-coordinator or non-Sonos players", () => {
  const entities = sonosEntities();
  mocks.app.currentHome.entities = [entities[1], entities[2], entities[3], { ...speaker("cast"), integration: "cast" }];
  render(content()); expect(screen.queryByRole("region")).not.toBeInTheDocument();
});
it("keeps pause resumable and exits immediately when switched to TV", async () => {
  const view = render(content());
  fireEvent.click(within(mini()).getByRole("button", { name: "Pause" }));
  await waitFor(() => expect(mocks.app.command).toHaveBeenCalledWith("media_player.lounge", "media_pause", undefined));
  mocks.app.currentHome.entities[0].state = "paused";
  view.rerender(content());
  fireEvent.click(within(mini()).getByRole("button", { name: "Play" }));
  await waitFor(() => expect(mocks.app.command).toHaveBeenLastCalledWith("media_player.lounge", "media_play", undefined));
  mocks.app.currentHome.entities[0].state = "idle";
  view.rerender(content());
  expect(within(mini()).getByRole("timer")).toHaveTextContent("Hides in 10 s");
  mocks.app.currentHome.entities[0].state = "playing";
  view.rerender(content()); expect(mini()).toBeVisible();
  mocks.app.currentHome.entities[0].attributes.source = "TV";
  view.rerender(content());
  await waitFor(() => expect(screen.queryByRole("region", { name: "Sonos mini player" })).not.toBeInTheDocument());
});
it.each(["paused", "idle"])("counts down for ten seconds after %s, then stays hidden until playback resumes", async state => {
  vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
  const view = render(content());
  mocks.app.currentHome.entities[0].state = state;
  view.rerender(content());
  expect(within(mini()).getByRole("timer")).toHaveTextContent("Hides in 10 s");
  act(() => vi.advanceTimersByTime(6000));
  view.rerender(content());
  expect(within(mini()).getByRole("timer")).toHaveTextContent("Hides in 4 s");
  act(() => vi.advanceTimersByTime(3000));
  expect(within(mini()).getByRole("timer")).toHaveTextContent("Hides in 1 s");
  act(() => vi.advanceTimersByTime(1000));
  await waitFor(() => expect(screen.queryByRole("region", { name: "Sonos mini player" })).not.toBeInTheDocument());
  view.rerender(content());
  expect(screen.queryByRole("region")).not.toBeInTheDocument();
  mocks.app.currentHome.entities[0].state = "playing";
  view.rerender(content());
  expect(mini()).toBeVisible();
  expect(screen.queryByRole("timer")).not.toBeInTheDocument();
});
it("cancels the countdown when any group resumes and starts fresh after the last group stops", () => {
  vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
  const view = render(content());
  mocks.app.currentHome.entities[0].state = "paused";
  view.rerender(content());
  act(() => vi.advanceTimersByTime(7000));
  mocks.app.currentHome.entities[2].state = "playing";
  view.rerender(content());
  act(() => vi.advanceTimersByTime(20_000));
  expect(mini()).toBeVisible();
  expect(screen.queryByRole("timer")).not.toBeInTheDocument();
  mocks.app.currentHome.entities[2].state = "paused";
  view.rerender(content());
  expect(within(mini()).getByRole("timer")).toHaveTextContent("Hides in 10 s");
});
it("keeps the full player open while idle and starts a fresh countdown on close", () => {
  vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
  const view = render(content());
  mocks.app.currentHome.entities[0].state = "paused";
  view.rerender(content());
  act(() => vi.advanceTimersByTime(7000));
  fireEvent.click(screen.getByRole("button", { name: "Open full player" }));
  act(() => vi.advanceTimersByTime(20_000));
  const dialog = screen.getByRole("dialog", { name: "Sonos player" });
  expect(dialog).toBeVisible();
  expect(within(dialog).queryByRole("timer")).not.toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
  expect(within(mini()).getByRole("timer")).toHaveTextContent("Hides in 10 s");
});
it("shows separate groups once, names their tracks and changes only the selected command target", async () => {
  mocks.app.currentHome.entities[2].state = "playing";
  mocks.app.currentHome.entities[2].attributes.media_title = "Another song";
  const view = render(content());
  expect(within(mini()).getByText("2 playing separately")).toBeVisible();
  openRooms();
  expect(screen.getAllByRole("menuitemradio")).toHaveLength(2);
  expect(screen.getByRole("menuitemradio", { name: /Demo lounge/ })).toHaveAttribute("aria-checked", "true");
  fireEvent.click(screen.getByRole("menuitemradio", { name: /Demo studio.*Another song/ }));
  expect(mocks.app.command).not.toHaveBeenCalled();
  fireEvent.click(within(mini()).getByRole("button", { name: "Next track" }));
  await waitFor(() => expect(mocks.app.command).toHaveBeenLastCalledWith("media_player.studio", "media_next_track", undefined));
  await act(async () => {});
  view.rerender(content());
  expect(within(mini()).getByRole("button", { name: "Choose a speaker" })).toHaveTextContent("Demo studio");
});
it("shares balanced group volume, pending guards and partial-error feedback", async () => {
  let reject: (error: Error) => void;
  mocks.app.command.mockImplementation(id => id === "media_player.kitchen" ? new Promise((_, fail) => { reject = fail; }) : Promise.resolve());
  render(content());
  fireEvent.keyDown(within(mini()).getByRole("slider", { name: "Group volume" }), { key: "ArrowRight" });
  expect(within(mini()).getByRole("button", { name: "Pause" })).toBeDisabled();
  await act(async () => reject(new Error("Example failure")));
  expect(mocks.app.command.mock.calls).toEqual([["media_player.lounge", "volume_set", .21], ["media_player.kitchen", "volume_set", .41]]);
  expect(within(mini()).getByRole("alert")).toHaveTextContent("Some speakers did not respond");
});
it("opens the shared full player and its library, returns room focus and restores the expand button", async () => {
  render(content());
  fireEvent.click(screen.getByRole("button", { name: "Open full player" }));
  const dialog = screen.getByRole("dialog", { name: "Sonos player" });
  expect(within(dialog).getByRole("button", { name: "Shuffle" })).toBeVisible();
  expect(within(dialog).getByRole("slider", { name: "Track position" })).toBeVisible();
  fireEvent.click(within(dialog).getByRole("button", { name: "Your music" }));
  await screen.findByRole("button", { name: "Play Sunday selections" });
  fireEvent.click(screen.getByRole("button", { name: "Change room" }));
  await waitFor(() => expect(within(dialog).getByRole("button", { name: "Choose a speaker" })).toHaveFocus());
  fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Open full player" })).toHaveFocus());
});
it("preserves selection across navigation, hides on settings, and never replays offline commands", async () => {
  mocks.app.currentHome.entities[2].state = "playing";
  const view = render(content());
  openRooms();
  fireEvent.click(screen.getByRole("menuitemradio", { name: /Demo studio/ }));
  fireEvent.click(screen.getByRole("link", { name: "Settings route" }));
  await waitFor(() => expect(screen.queryByRole("region", { name: "Sonos mini player" })).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole("link", { name: "Calendar route" }));
  expect(within(mini()).getByRole("button", { name: "Choose a speaker" })).toHaveTextContent("Demo studio");
  fireEvent.click(screen.getByRole("link", { name: "Sonos route" }));
  await waitFor(() => expect(screen.queryByRole("region", { name: "Sonos mini player" })).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole("link", { name: "Calendar route" }));
  expect(within(mini()).getByRole("button", { name: "Choose a speaker" })).toHaveTextContent("Demo studio");
  mocks.app.homeOnline = false; view.rerender(content());
  await waitFor(() => expect(screen.queryByRole("region", { name: "Sonos mini player" })).not.toBeInTheDocument());
  mocks.app.homeOnline = true; view.rerender(content());
  expect(mocks.app.command).not.toHaveBeenCalled();
});
