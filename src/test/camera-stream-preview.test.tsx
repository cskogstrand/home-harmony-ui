import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CameraStreamPreview } from "@/components/CameraStreamPreview";

const fetchFrame = vi.fn(), decode = vi.fn(), create = vi.fn(), revoke = vi.fn();
const response = () => new Response(new Blob(["fixture-frame"], { type: "image/jpeg" }), { headers: { "Content-Type": "image/jpeg" } });
const preview = (src = "/api/cameras/example/snapshot.jpg") => <CameraStreamPreview src={src} name="Example camera" status="Loading video…" />;
beforeEach(() => {
  vi.useFakeTimers(); fetchFrame.mockReset().mockImplementation(async () => response());
  decode.mockReset().mockResolvedValue(undefined); create.mockReset(); revoke.mockReset();
  create.mockReturnValueOnce("blob:first").mockReturnValueOnce("blob:second");
  vi.stubGlobal("fetch", fetchFrame);
  vi.stubGlobal("Image", class { src = ""; decode = decode; });
  vi.stubGlobal("URL", class extends URL { static createObjectURL = create; static revokeObjectURL = revoke; });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });

it("requests immediately, retains the decoded image between refreshes and never overlaps requests", async () => {
  let finishDecode: () => void;
  decode.mockResolvedValueOnce(undefined).mockReturnValueOnce(new Promise<void>(resolve => { finishDecode = resolve; }));
  const view = render(preview());
  expect(fetchFrame).toHaveBeenCalledOnce();
  expect(fetchFrame).toHaveBeenCalledWith("/api/cameras/example/snapshot.jpg", { cache: "no-store", signal: expect.any(AbortSignal) });
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  expect(screen.getByRole("img")).toHaveAttribute("src", "blob:first");
  expect(screen.getByText("Snapshot preview · connecting video…")).toBeVisible();
  await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
  expect(fetchFrame).toHaveBeenCalledTimes(2);
  expect(screen.getByRole("img")).toHaveAttribute("src", "blob:first");
  await act(async () => { finishDecode(); });
  expect(screen.getByRole("img")).toHaveAttribute("src", "blob:second");
  expect(revoke).toHaveBeenCalledWith("blob:first");
  view.unmount();
  expect(revoke).toHaveBeenCalledWith("blob:second");
  expect(fetchFrame.mock.calls[1][1].signal.aborted).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});

it("requests the next frame immediately when the camera itself takes more than half a second", async () => {
  let finishResponse: (value: Response) => void;
  fetchFrame.mockReturnValueOnce(new Promise(resolve => { finishResponse = resolve; })).mockReturnValue(new Promise(() => {}));
  const view = render(preview());
  await act(async () => { await vi.advanceTimersByTimeAsync(1200); finishResponse(response()); });
  expect(fetchFrame).toHaveBeenCalledOnce();
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  expect(fetchFrame).toHaveBeenCalledTimes(2);
  view.unmount(); expect(vi.getTimerCount()).toBe(0);
});

it("keeps the previous image on failure, backs off, and ignores frames after closing", async () => {
  let finishResponse: (value: Response) => void;
  fetchFrame.mockResolvedValueOnce(response()).mockResolvedValueOnce(new Response("unavailable", { status: 502 }))
    .mockReturnValueOnce(new Promise(resolve => { finishResponse = resolve; }));
  const view = render(preview());
  await act(async () => { await vi.advanceTimersByTimeAsync(500); });
  expect(fetchFrame).toHaveBeenCalledTimes(2);
  expect(screen.getByRole("img")).toHaveAttribute("src", "blob:first");
  await act(async () => { await vi.advanceTimersByTimeAsync(1999); });
  expect(fetchFrame).toHaveBeenCalledTimes(2);
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  expect(fetchFrame).toHaveBeenCalledTimes(3);
  view.unmount();
  await act(async () => { finishResponse(response()); });
  expect(create).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0);
});

it("cancels slow frames, rejects non-images and releases pending decodes on source change", async () => {
  fetchFrame.mockImplementationOnce((_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new Error()))))
    .mockResolvedValueOnce(new Response("not an image", { headers: { "Content-Type": "text/html" } }));
  decode.mockReturnValue(new Promise(() => {}));
  const view = render(preview());
  await act(async () => { await vi.advanceTimersByTimeAsync(7000); });
  expect(fetchFrame.mock.calls[0][1].signal.aborted).toBe(true);
  expect(fetchFrame).toHaveBeenCalledTimes(2); expect(create).not.toHaveBeenCalled();
  await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
  expect(create).toHaveBeenCalledOnce();
  view.rerender(preview("/api/camera_proxy/camera.example"));
  expect(fetchFrame.mock.calls[2][1].signal.aborted).toBe(true);
  expect(revoke).toHaveBeenCalledWith("blob:first");
  expect(fetchFrame).toHaveBeenLastCalledWith("/api/camera_proxy/camera.example", expect.anything());
});
