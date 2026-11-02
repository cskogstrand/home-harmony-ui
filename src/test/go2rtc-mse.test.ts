import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { playGo2rtcMse } from "@/lib/go2rtc-mse";
import { go2rtcErrors } from "../../shared/cameras";

class Buffer extends EventTarget {
  buffered = { length: 1, start: () => 0, end: () => 30 };
  appendBuffer = vi.fn(() => queueMicrotask(() => this.dispatchEvent(new Event("updateend"))));
  remove = vi.fn(() => queueMicrotask(() => this.dispatchEvent(new Event("updateend"))));
}
class Source extends EventTarget {
  static instances: Source[] = [];
  static isTypeSupported = vi.fn(() => true);
  buffer = new Buffer();
  addSourceBuffer = vi.fn(() => this.buffer);
  constructor() { super(); Source.instances.push(this); }
}
let video: HTMLVideoElement, controller: AbortController;
const request = vi.fn(), failed = vi.fn(), revoke = vi.fn();
const start = () => playGo2rtcMse("example-camera", video, controller.signal, failed);
beforeEach(() => {
  vi.useFakeTimers(); Source.instances = []; Source.isTypeSupported.mockReset().mockReturnValue(true);
  failed.mockReset(); revoke.mockReset(); request.mockReset();
  const read = vi.fn().mockResolvedValueOnce({ done: false, value: new Uint8Array([1, 2, 3]) }).mockReturnValue(new Promise(() => {}));
  request.mockResolvedValue({ ok: true, headers: new Headers({ "Content-Type": 'video/mp4; codecs="avc1.640029"' }), body: { getReader: () => ({ read }) } });
  vi.stubGlobal("fetch", request); vi.stubGlobal("MediaSource", Source);
  vi.stubGlobal("URL", class extends URL { static createObjectURL = () => "blob:fixture"; static revokeObjectURL = revoke; });
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, "paused", "get").mockReturnValue(false);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  video = document.createElement("video"); controller = new AbortController();
});
afterEach(() => { controller.abort(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

it("uses server codecs, feeds media in order, trims old data and releases the stream on close", async () => {
  start(); const source = Source.instances[0]; source.dispatchEvent(new Event("sourceopen"));
  await vi.advanceTimersByTimeAsync(0);
  expect(request).toHaveBeenCalledWith("/api/cameras/example-camera/stream.mp4", expect.objectContaining({ signal: expect.any(AbortSignal) }));
  expect(source.addSourceBuffer).toHaveBeenCalledWith('video/mp4; codecs="avc1.640029"');
  expect(source.buffer.appendBuffer).toHaveBeenCalledWith(new Uint8Array([1, 2, 3]));
  expect(video.currentTime).toBe(29); expect(source.buffer.remove).toHaveBeenCalledWith(0, 15);
  expect(video.play).toHaveBeenCalledOnce(); // Incoming chunks must not override a user's pause.
  video.dispatchEvent(new Event("playing")); await vi.advanceTimersByTimeAsync(30000);
  expect(failed).not.toHaveBeenCalled(); controller.abort();
  expect(request.mock.calls[0][1].signal.aborted).toBe(true);
  expect(revoke).toHaveBeenCalledExactlyOnceWith("blob:fixture"); expect(video).not.toHaveAttribute("src");
});

it("keeps paused playback still while bounding the buffer and resumes at the live edge", async () => {
  let nextChunk: (chunk: unknown) => void;
  const read = vi.fn().mockResolvedValueOnce({ done: false, value: new Uint8Array([1]) })
    .mockReturnValueOnce(new Promise(resolve => { nextChunk = resolve; })).mockReturnValue(new Promise(() => {}));
  request.mockResolvedValue({ ok: true, headers: new Headers({ "Content-Type": 'video/mp4; codecs="avc1.640029"' }), body: { getReader: () => ({ read }) } });
  start(); const source = Source.instances[0]; source.dispatchEvent(new Event("sourceopen"));
  await vi.advanceTimersByTimeAsync(0);
  vi.spyOn(video, "paused", "get").mockReturnValue(true);
  source.buffer.buffered.end = () => 90;
  nextChunk({ done: false, value: new Uint8Array([2]) }); await vi.advanceTimersByTimeAsync(0);
  expect(video.currentTime).toBe(29); expect(video.play).toHaveBeenCalledOnce();
  expect(source.buffer.remove).toHaveBeenLastCalledWith(0, 75);
  vi.spyOn(video, "paused", "get").mockReturnValue(false);
  video.dispatchEvent(new Event("play"));
  expect(video.currentTime).toBe(89);
});

it("does not apply a response after abort", async () => {
  let resolve: (value: unknown) => void;
  request.mockReturnValue(new Promise(done => { resolve = done; }));
  start(); const source = Source.instances[0]; source.dispatchEvent(new Event("sourceopen")); controller.abort();
  resolve({ ok: true, headers: new Headers(), body: {} }); await vi.advanceTimersByTimeAsync(0);
  expect(source.addSourceBuffer).not.toHaveBeenCalled(); expect(failed).not.toHaveBeenCalled();
});

it("prefers ManagedMediaSource when Safari exposes both media source implementations", () => {
  vi.stubGlobal("ManagedMediaSource", Source);
  const legacy = vi.fn(); vi.stubGlobal("MediaSource", legacy);
  start();
  expect(Source.instances).toHaveLength(1); expect(legacy).not.toHaveBeenCalled();
  expect(video.disableRemotePlayback).toBe(true);
});

it("reports upstream failures, unsupported codecs and stalls without leaking response text", async () => {
  request.mockResolvedValue({ ok: false, json: async () => ({ error: go2rtcErrors.rejected }) });
  start(); Source.instances[0].dispatchEvent(new Event("sourceopen")); await vi.advanceTimersByTimeAsync(0);
  expect(failed).toHaveBeenLastCalledWith(go2rtcErrors.rejected);
  request.mockResolvedValue({ ok: false, json: async () => ({ error: "private upstream error" }) });
  start(); Source.instances[1].dispatchEvent(new Event("sourceopen")); await vi.advanceTimersByTimeAsync(0);
  expect(failed).toHaveBeenLastCalledWith(go2rtcErrors.signaling);
  Source.isTypeSupported.mockReturnValue(false);
  request.mockResolvedValue({ ok: true, headers: new Headers({ "Content-Type": "video/mp4" }), body: {} });
  start(); Source.instances[2].dispatchEvent(new Event("sourceopen")); await vi.advanceTimersByTimeAsync(0);
  expect(failed).toHaveBeenLastCalledWith(go2rtcErrors.playback);
  start(); await vi.advanceTimersByTimeAsync(20000);
  expect(failed).toHaveBeenCalledTimes(4);
});
