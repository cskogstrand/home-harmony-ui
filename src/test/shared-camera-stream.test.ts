import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { shareCameraStream } from "@/lib/shared-camera-stream";
import { playGo2rtcStream } from "@/lib/go2rtc-stream";
import { playGo2rtcMse } from "@/lib/go2rtc-mse";

vi.mock("@/lib/go2rtc-stream", () => ({ playGo2rtcStream: vi.fn() }));
vi.mock("@/lib/go2rtc-mse", () => ({ playGo2rtcMse: vi.fn() }));
let stops: (() => void)[];
const watch = vi.fn();
beforeEach(() => { vi.resetAllMocks(); stops = []; });
afterEach(() => { stops.reverse().forEach(stop => stop()); document.body.replaceChildren(); vi.restoreAllMocks(); });
function attach(expanded = false, key = "example", go2rtc = true, player = watch) {
  const container = document.createElement("div"); document.body.append(container);
  const update = vi.fn(), failed = vi.fn();
  const release = shareCameraStream(key, key, go2rtc, player, { container, expanded, name: "Example camera", update, failed });
  let stopped = false;
  const stop = () => { if (!stopped) { stopped = true; release(); } };
  stops.push(stop);
  return { container, update, failed, stop };
}

it.each([true, false])("moves the same player between simultaneous views and releases only the last (go2rtc: %s)", go2rtc => {
  const inline = attach(false, "example", go2rtc);
  const start = vi.mocked(go2rtc ? playGo2rtcStream : watch);
  const [, video, signal] = start.mock.calls[0];
  const popup = attach(true, "example", go2rtc);
  expect(start).toHaveBeenCalledOnce();
  expect(popup.container.firstChild).toBe(video);
  expect(video.controls).toBe(true);
  expect(inline.container.firstChild).toBeInstanceOf(HTMLCanvasElement);
  expect(inline.container.firstElementChild).toHaveAttribute("aria-label", "Example camera");
  popup.stop();
  expect(inline.container.firstChild).toBe(video);
  expect(video.controls).toBe(false);
  expect(signal.aborted).toBe(false);
  const reopened = attach(true, "example", go2rtc);
  expect(reopened.container.firstChild).toBe(video);
  expect(start).toHaveBeenCalledOnce();
  inline.stop();
  expect(reopened.container.firstChild).toBe(video);
  expect(signal.aborted).toBe(false);
  reopened.stop();
  expect(signal.aborted).toBe(true);
});

it("mirrors decoded frames and cancels drawing when only one view remains", () => {
  const inline = attach();
  const video = vi.mocked(playGo2rtcStream).mock.calls[0][1];
  vi.spyOn(video, "readyState", "get").mockReturnValue(4);
  vi.spyOn(video, "videoWidth", "get").mockReturnValue(640);
  vi.spyOn(video, "videoHeight", "get").mockReturnValue(360);
  const drawImage = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage } as unknown as CanvasRenderingContext2D);
  let frame: VideoFrameRequestCallback;
  video.requestVideoFrameCallback = vi.fn(callback => { frame = callback; return 17; });
  video.cancelVideoFrameCallback = vi.fn();
  const popup = attach(true);
  expect(drawImage).toHaveBeenCalledWith(video, 0, 0, 640, 360);
  expect(inline.container.querySelector("canvas")).toHaveAttribute("width", "640");
  frame(0, {} as VideoFrameCallbackMetadata);
  expect(drawImage).toHaveBeenCalledTimes(2);
  popup.stop();
  expect(video.cancelVideoFrameCallback).toHaveBeenCalledWith(17);
  expect(inline.container.firstChild).toBe(video);
});

it("keeps the MSE fallback and its element through repeated popup transitions", () => {
  const inline = attach();
  const [, video, firstSignal, fail] = vi.mocked(playGo2rtcStream).mock.calls[0];
  fail("WebRTC unavailable");
  const [, mseVideo, mseSignal, mseFail] = vi.mocked(playGo2rtcMse).mock.calls[0];
  expect(firstSignal.aborted).toBe(true);
  expect(mseVideo).toBe(video);
  const popup = attach(true);
  expect(popup.update).toHaveBeenLastCalledWith({ video, transport: "mse" });
  popup.stop();
  const reopened = attach(true);
  expect(reopened.container.firstChild).toBe(video);
  expect(playGo2rtcStream).toHaveBeenCalledOnce();
  expect(playGo2rtcMse).toHaveBeenCalledOnce();
  expect(mseSignal.aborted).toBe(false);
  mseFail("Stream unavailable");
  expect(inline.failed).toHaveBeenCalledWith("Stream unavailable");
  expect(reopened.failed).toHaveBeenCalledWith("Stream unavailable");
  expect(popup.failed).not.toHaveBeenCalled();
  expect(mseSignal.aborted).toBe(true);
  inline.stop(); reopened.stop();
  attach();
  expect(playGo2rtcStream).toHaveBeenCalledTimes(2);
});

it("isolates sources and Home Assistant clients and ignores late transport errors", () => {
  const first = attach();
  attach(false, "other");
  attach(false, "example", true, vi.fn());
  expect(playGo2rtcStream).toHaveBeenCalledTimes(3);
  const [, , signal, failed] = vi.mocked(playGo2rtcStream).mock.calls[0];
  first.stop(); failed();
  expect(signal.aborted).toBe(true);
  expect(playGo2rtcMse).not.toHaveBeenCalled();
  expect(vi.mocked(playGo2rtcStream).mock.calls[1][2].aborted).toBe(false);
  expect(vi.mocked(playGo2rtcStream).mock.calls[2][2].aborted).toBe(false);
});
