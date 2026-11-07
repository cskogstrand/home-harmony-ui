import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Sonos from "@/pages/Sonos";
import { musicFolder, sonosEntities, sonosServices } from "./sonos-fixtures";
import { MessageError } from "@/lib/i18n";

const mocks = vi.hoisted(() => ({ app: null }));
vi.mock("@/contexts/AppContext", () => ({ useApp: () => mocks.app }));
const mount = () => render(<MemoryRouter initialEntries={["/sonos?player=media_player.kitchen"]}><Sonos /></MemoryRouter>);
beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  mocks.app = { currentHome: { entities: sonosEntities(), areas: [], devices: [] }, homeOnline: true, connectionStatus: "connected", services: sonosServices, commands: {},
    command: vi.fn().mockResolvedValue(undefined), browseMedia: vi.fn().mockResolvedValue(musicFolder()), sonosQueue: vi.fn().mockResolvedValue([{ media_title: "Demo first", media_artist: "Example band", media_content_id: "first" }, { media_title: "Demo second", media_content_id: "second" }]) };
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("controls the coordinator when a follower is selected, with per-room volume targets", async () => {
  mount();
  await screen.findByRole("button", { name: "Play Sunday selections" });
  fireEvent.click(screen.getByRole("button", { name: "Pause" }));
  await waitFor(() => expect(mocks.app.command).toHaveBeenCalledWith("media_player.lounge", "media_pause", undefined));
  await act(async () => {});
  expect(screen.queryByRole("slider", { name: "Volume for Demo kitchen" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Room volumes" }));
  fireEvent.keyDown(screen.getByRole("slider", { name: "Volume for Demo kitchen" }), { key: "ArrowRight" });
  await waitFor(() => expect(mocks.app.command).toHaveBeenCalledWith("media_player.kitchen", "volume_set", .41));
  await act(async () => {});
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
  fireEvent.click(screen.getByRole("button", { name: "Play Sunday selections" }));
  await waitFor(() => expect(mocks.app.command).toHaveBeenCalledWith("media_player.lounge", "play_media", { media_content_id: "FV:2/1", media_content_type: "favorite_item_id", enqueue: "replace" }));
});
it("groups only after Apply, keeps the coordinator selected and disables unavailable speakers", async () => {
  mount(); await screen.findByRole("button", { name: "Play Sunday selections" });
  fireEvent.click(screen.getByRole("button", { name: "Edit group" }));
  expect(screen.getByRole("checkbox", { name: /Demo lounge/ })).toBeDisabled();
  expect(screen.getByRole("checkbox", { name: /Demo terrace/ })).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox", { name: "Demo kitchen" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Demo studio" }));
  expect(mocks.app.command).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Apply group" }));
  await waitFor(() => expect(mocks.app.command.mock.calls).toEqual([["media_player.kitchen", "unjoin"], ["media_player.lounge", "join", ["media_player.studio"]]]));
});
it("reports partial group-volume failures and never retries commands", async () => {
  mocks.app.command.mockImplementation(async id => { if (id === "media_player.kitchen") throw new Error("failed"); });
  mount(); await screen.findByRole("button", { name: "Play Sunday selections" });
  fireEvent.keyDown(screen.getByRole("slider", { name: "Group volume" }), { key: "ArrowRight" });
  await screen.findByRole("alert");
  expect(mocks.app.command.mock.calls).toEqual([["media_player.lounge", "volume_set", .21], ["media_player.kitchen", "volume_set", .41]]);
  expect(screen.getByRole("alert")).toHaveTextContent("Some speakers did not respond");
});
it("keeps failed group edits and the HA error visible inside the dialog without retrying", async () => {
  mocks.app.command.mockRejectedValue(new MessageError("Home Assistant could not change the group: {reason}", { reason: "Example speaker did not respond" }));
  mount(); await screen.findByRole("button", { name: "Play Sunday selections" });
  fireEvent.click(screen.getByRole("button", { name: "Edit group" }));
  const dialog = screen.getByRole("dialog", { name: "Edit group" });
  fireEvent.click(within(dialog).getByRole("checkbox", { name: "Demo studio" }));
  fireEvent.click(within(dialog).getByRole("button", { name: "Apply group" }));
  await waitFor(() => expect(within(dialog).getByRole("alert")).toHaveTextContent("Example speaker did not respond"));
  expect(within(dialog).getByRole("checkbox", { name: "Demo studio" })).toBeChecked();
  expect(mocks.app.command.mock.calls).toEqual([["media_player.lounge", "join", ["media_player.studio"]]]);
});
it("browses playlists with the native library ID and suppresses queueing favorites that ignore enqueue", async () => {
  mount(); await screen.findByRole("button", { name: "Play Sunday selections" });
  expect(screen.queryByRole("button", { name: "Queue options for Sunday selections" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Playlists" }));
  await waitFor(() => expect(mocks.app.browseMedia).toHaveBeenLastCalledWith("media_player.lounge", { media_content_type: "playlist", media_content_id: "A:PLAYLISTS" }));
});
it("renders supplied favorite artwork and falls back only when the image fails", async () => {
  mount();
  const favorite = await screen.findByRole("button", { name: "Play Sunday selections" });
  const image = favorite.querySelector("img");
  expect(image).toHaveAttribute("src", "https://images.example.invalid/playlist.jpg");
  expect(image).toHaveAttribute("referrerpolicy", "no-referrer");
  fireEvent.error(image);
  expect(favorite.querySelector("img")).toBeNull();
  expect(favorite.querySelector(".sonos-thumbnail svg")).not.toBeNull();
});
it("shows the coordinator's streaming source even when only hardware inputs are selectable", async () => {
  mocks.app.currentHome.entities[0].attributes.source = "Spotify";
  mocks.app.currentHome.entities[1].attributes.source = "TV";
  mount();
  await screen.findByRole("button", { name: "Play Sunday selections" });
  const source = screen.getByRole("combobox", { name: "Source" });
  expect(source).toHaveDisplayValue("Spotify");
  expect(within(source).getByRole("option", { name: "Spotify" })).toBeDisabled();
  expect(mocks.app.command).not.toHaveBeenCalled();
  fireEvent.change(source, { target: { value: "TV" } });
  await waitFor(() => expect(mocks.app.command).toHaveBeenCalledWith("media_player.lounge", "select_source", "TV"));
});
it("requires confirmation for queue deletion and rejects changed queue positions", async () => {
  mount(); await screen.findByRole("button", { name: "Queue" });
  fireEvent.click(screen.getByRole("button", { name: "Queue" }));
  await screen.findByRole("button", { name: "Play Demo second" });
  fireEvent.click(screen.getByRole("button", { name: "Remove Demo second from queue" }));
  expect(mocks.app.command).not.toHaveBeenCalled();
  mocks.app.sonosQueue.mockResolvedValueOnce([{ media_title: "Changed", media_content_id: "changed" }]);
  fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Remove track" }));
  await screen.findByText("The queue changed. Check the updated tracks and try again.");
  expect(mocks.app.command).not.toHaveBeenCalled();
});
it("plays queue items with zero-based service indices", async () => {
  mount(); fireEvent.click(screen.getByRole("button", { name: "Queue" }));
  fireEvent.click(await screen.findByRole("button", { name: "Play Demo second" }));
  await waitFor(() => expect(mocks.app.command).toHaveBeenCalledWith("media_player.lounge", "play_queue", 1));
});
it.each(["Remove track", "Clear queue"])("keeps %s tied to the queue shown when confirmation opened", async action => {
  const view = mount(); fireEvent.click(screen.getByRole("button", { name: "Queue" }));
  await screen.findByRole("button", { name: "Play Demo second" });
  fireEvent.click(screen.getByRole("button", { name: action === "Remove track" ? "Remove Demo second from queue" : "Clear queue" }));
  mocks.app.sonosQueue.mockResolvedValue([{ media_title: "Changed first", media_content_id: "new-first" }, { media_title: "Changed second", media_content_id: "new-second" }]);
  mocks.app.currentHome.entities[0].attributes.queue_position = 2;
  view.rerender(<MemoryRouter initialEntries={["/sonos?player=media_player.kitchen"]}><Sonos /></MemoryRouter>);
  await screen.findByText("Changed second");
  const confirm = within(screen.getByRole("alertdialog")).getByRole("button", { name: action });
  await waitFor(() => expect(confirm).not.toBeDisabled());
  fireEvent.click(confirm);
  await screen.findByText("The queue changed. Check the updated tracks and try again.");
  expect(mocks.app.command).not.toHaveBeenCalled();
});
it("keeps an active music tab usable when selected again", async () => {
  mount(); await screen.findByRole("button", { name: "Play Sunday selections" });
  fireEvent.click(screen.getByRole("button", { name: "Favorites" }));
  expect(screen.getByRole("button", { name: "Play Sunday selections" })).not.toBeDisabled();
});
it("disables commands offline, preserves known rooms, and explains an empty installation", async () => {
  mocks.app.homeOnline = false;
  const view = mount();
  expect(screen.getByRole("button", { name: "Pause" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Edit group" })).toBeDisabled();
  expect(screen.getByRole("slider", { name: "Group volume" })).toHaveAttribute("data-disabled");
  expect(mocks.app.browseMedia).not.toHaveBeenCalled();
  view.unmount(); mocks.app.homeOnline = true; mocks.app.currentHome.entities = [];
  mount(); expect(screen.getByRole("heading", { name: "Bring your rooms to life" })).toBeInTheDocument();
});
