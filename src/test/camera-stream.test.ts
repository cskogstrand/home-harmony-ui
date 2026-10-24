import { afterEach, beforeEach, expect, it, vi, type Mock } from "vitest";
import type { Connection } from "home-assistant-js-websocket";
import Hls from "hls.js/dist/hls.light.mjs";
import { playCameraStream } from "@/lib/camera-stream";

vi.mock("hls.js/dist/hls.light.mjs", () => ({ default: class FakeHls {
  static isSupported = vi.fn(() => true);
  static Events = { ERROR: "error", MANIFEST_PARSED: "manifest" };
  static ErrorTypes = { MEDIA_ERROR: "media" };
  static DefaultConfig = { manifestLoadPolicy: { default: {} }, playlistLoadPolicy: { default: {} } };
  static instances = [];
  handlers = new Map();
  constructor(public config: unknown) { FakeHls.instances.push(this); }
  on(event: string, callback: unknown) { this.handlers.set(event, callback); }
  loadSource = vi.fn(); attachMedia = vi.fn(); destroy = vi.fn(); recoverMediaError = vi.fn();
} }));
const hlsInstances = () => (Hls as unknown as { instances: { config: unknown; handlers: Map<string, (event: string, data?: unknown) => void>; loadSource: ReturnType<typeof vi.fn>; attachMedia: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn>; recoverMediaError: ReturnType<typeof vi.fn> }[] }).instances;

class Peer {
  static instances: Peer[] = [];
  remoteDescription: unknown = null;
  iceConnectionState = "new";
  ontrack?: (event: { track: MediaStreamTrack }) => void;
  onicecandidate?: (event: { candidate: { toJSON: () => RTCIceCandidateInit } }) => void;
  oniceconnectionstatechange?: () => void;
  constructor(public config: unknown) { Peer.instances.push(this); }
  createDataChannel = vi.fn(); addTransceiver = vi.fn(); close = vi.fn();
  createOffer = vi.fn(async () => ({ type: "offer", sdp: "fixture-offer" }));
  setLocalDescription = vi.fn(async () => {});
  setRemoteDescription = vi.fn(async value => { this.remoteDescription = value; });
  addIceCandidate = vi.fn(async () => {});
}
let video: HTMLVideoElement, controller: AbortController, failed: Mock<() => void>;
let send: ReturnType<typeof vi.fn>, subscribe: ReturnType<typeof vi.fn>, unsubscribe: Mock<() => Promise<void>>;
let receive: (event: unknown) => void;
const url = "/api/hls/0123456789abcdef/master_playlist.m3u8";
const start = () => playCameraStream({ sendMessagePromise: send, subscribeMessage: subscribe } as unknown as Connection, "camera.example", video, controller.signal, failed);
const flush = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
  vi.useFakeTimers(); Peer.instances = []; hlsInstances().length = 0;
  vi.stubGlobal("RTCPeerConnection", Peer);
  vi.stubGlobal("MediaStream", class {
    tracks: MediaStreamTrack[] = [];
    addTrack(track: MediaStreamTrack) { this.tracks.push(track); }
    getTracks() { return this.tracks; }
  });
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "canPlayType").mockReturnValue("probably");
  video = document.createElement("video"); controller = new AbortController(); failed = vi.fn();
  unsubscribe = vi.fn(async () => {});
  subscribe = vi.fn(async callback => { receive = callback; return unsubscribe; });
  send = vi.fn(async ({ type }) => ({
    "camera/capabilities": { frontend_stream_types: ["hls", "web_rtc"] },
    "camera/webrtc/get_client_config": { configuration: { iceServers: [] }, dataChannel: "fixture-channel" },
    "camera/stream": { url },
  })[type]);
});
afterEach(() => { controller.abort(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

it("prefers WebRTC, exchanges queued ICE candidates and closes tracks and signaling on abort", async () => {
  start(); await flush();
  const peer = Peer.instances[0];
  expect(peer.config).toEqual({ iceServers: [] });
  expect(peer.createDataChannel).toHaveBeenCalledWith("fixture-channel");
  expect(peer.addTransceiver.mock.calls).toEqual([["audio", { direction: "recvonly" }], ["video", { direction: "recvonly" }]]);
  expect(subscribe).toHaveBeenCalledWith(expect.any(Function), { type: "camera/webrtc/offer", entity_id: "camera.example", offer: "fixture-offer" }, { resubscribe: false });
  peer.onicecandidate({ candidate: { toJSON: () => ({ candidate: "fixture-local", sdpMid: "0" }) } });
  expect(send).not.toHaveBeenCalledWith(expect.objectContaining({ type: "camera/webrtc/candidate" }));
  receive({ type: "session", session_id: "fixture-session" });
  receive({ type: "candidate", candidate: { candidate: "fixture-remote" } });
  await flush();
  expect(peer.addIceCandidate).not.toHaveBeenCalled();
  receive({ type: "answer", answer: "fixture-answer" });
  await flush();
  expect(send).toHaveBeenCalledWith({ type: "camera/webrtc/candidate", entity_id: "camera.example", session_id: "fixture-session", candidate: { candidate: "fixture-local", sdpMid: "0" } });
  expect(peer.setRemoteDescription).toHaveBeenCalledWith({ type: "answer", sdp: "fixture-answer" });
  expect(peer.addIceCandidate).toHaveBeenCalledWith({ candidate: "fixture-remote", sdpMid: "0" });
  const track = { stop: vi.fn() };
  peer.ontrack({ track: track as unknown as MediaStreamTrack });
  expect((video.srcObject as MediaStream).getTracks()).toEqual([track]);
  const secondTrack = { stop: vi.fn() };
  peer.ontrack({ track: secondTrack as unknown as MediaStreamTrack });
  expect((video.srcObject as MediaStream).getTracks()).toEqual([track, secondTrack]);
  expect(video.play).toHaveBeenCalledOnce();
  video.dispatchEvent(new Event("playing"));
  await vi.advanceTimersByTimeAsync(60000);
  expect(failed).not.toHaveBeenCalled();
  expect(send).not.toHaveBeenCalledWith(expect.objectContaining({ type: "camera/stream" }));
  controller.abort();
  expect(peer.close).toHaveBeenCalledOnce(); expect(track.stop).toHaveBeenCalledOnce();
  expect(secondTrack.stop).toHaveBeenCalledOnce();
  expect(unsubscribe).toHaveBeenCalledOnce(); expect(video.srcObject).toBeNull();
});

it("accepts a WebRTC configuration without a data channel", async () => {
  send.mockResolvedValueOnce({ frontend_stream_types: ["web_rtc"] }).mockResolvedValueOnce({ configuration: {}, dataChannel: null });
  start(); await flush();
  expect(subscribe).toHaveBeenCalledOnce();
  expect(Peer.instances[0].createDataChannel).not.toHaveBeenCalled(); expect(failed).not.toHaveBeenCalled();
});

it("falls back to native HLS after WebRTC failure and ignores old signaling callbacks", async () => {
  start(); await flush();
  const peer = Peer.instances[0];
  receive({ type: "error", message: "fixture failure" }); await flush();
  expect(peer.close).toHaveBeenCalledOnce(); expect(unsubscribe).toHaveBeenCalledOnce();
  expect(video).toHaveAttribute("src", url);
  expect(send).toHaveBeenCalledWith({ type: "camera/stream", entity_id: "camera.example", format: "hls" });
  receive({ type: "answer", answer: "late" }); await flush();
  expect(peer.setRemoteDescription).not.toHaveBeenCalled();
  expect(failed).not.toHaveBeenCalled();
  video.dispatchEvent(new Event("error"));
  expect(failed).toHaveBeenCalledOnce(); expect(video).not.toHaveAttribute("src");
});

it("times out a stalled WebRTC setup and ignores its late configuration", async () => {
  let resolve: (value: unknown) => void;
  send.mockImplementation(async ({ type }) => type === "camera/capabilities" ? { frontend_stream_types: ["web_rtc", "hls"] }
    : type === "camera/stream" ? { url } : new Promise(done => { resolve = done; }));
  start(); await flush(); video.dispatchEvent(new Event("pause")); await vi.advanceTimersByTimeAsync(15000);
  expect(video).toHaveAttribute("src", url);
  resolve({ configuration: {} }); await flush();
  expect(Peer.instances).toHaveLength(0); expect(failed).not.toHaveBeenCalled();
});

it("unsubscribes when signaling acknowledges only after the viewer was closed", async () => {
  let resolve: (value: () => Promise<void>) => void;
  subscribe.mockImplementation(callback => { receive = callback; return new Promise(done => { resolve = done; }); });
  start(); await flush(); controller.abort();
  resolve(unsubscribe); await flush();
  expect(unsubscribe).toHaveBeenCalledOnce(); expect(failed).not.toHaveBeenCalled();
});

it("uses HLS.js with a worker and low latency, recovers one media error, and tears it down", async () => {
  vi.stubGlobal("RTCPeerConnection", undefined);
  vi.mocked(video.canPlayType).mockReturnValue("");
  start(); await vi.waitFor(() => expect(hlsInstances()).toHaveLength(1));
  const hls = hlsInstances()[0];
  expect(hls.config).toEqual(expect.objectContaining({ lowLatencyMode: true, maxLiveSyncPlaybackRate: 2, workerPath: expect.stringContaining("hls.worker.js") }));
  expect(hls.loadSource).toHaveBeenCalledWith(url); expect(hls.attachMedia).toHaveBeenCalledWith(video);
  hls.handlers.get("manifest")("manifest");
  expect(video.play).toHaveBeenCalled();
  hls.handlers.get("error")("error", { fatal: false }); expect(failed).not.toHaveBeenCalled();
  hls.handlers.get("error")("error", { fatal: true, type: "media" });
  expect(hls.recoverMediaError).toHaveBeenCalledOnce(); expect(failed).not.toHaveBeenCalled();
  hls.handlers.get("error")("error", { fatal: true, type: "media" });
  expect(hls.destroy).toHaveBeenCalledOnce(); expect(failed).toHaveBeenCalledOnce();
});

it.each(["https://example.invalid/stream.m3u8", "//example.invalid/api/hls/abc/master_playlist.m3u8", "/api/hls/abc/master_playlist.m3u8?token=fixture", "/api/config"])("rejects unsafe HLS URL %s", async unsafe => {
  send.mockImplementation(async ({ type }) => type === "camera/capabilities" ? { frontend_stream_types: ["hls"] } : { url: unsafe });
  start(); await flush();
  expect(failed).toHaveBeenCalledOnce(); expect(video).not.toHaveAttribute("src");
});

it("keeps non-streaming cameras on the image fallback", async () => {
  send.mockResolvedValue({ frontend_stream_types: [] }); start(); await flush();
  expect(send).toHaveBeenCalledTimes(1); expect(failed).toHaveBeenCalledOnce();
});

it("tries HLS when older HA does not implement capabilities", async () => {
  send.mockRejectedValueOnce({ code: "unknown_command" }).mockResolvedValue({ url });
  start(); await flush(); expect(video).toHaveAttribute("src", url);
});

it("does not start an aborted viewer or use HLS replies after abort", async () => {
  controller.abort(); start(); expect(send).not.toHaveBeenCalled();
  controller = new AbortController();
  let resolve: (value: unknown) => void;
  send.mockResolvedValueOnce({ frontend_stream_types: ["hls"] }).mockImplementation(() => new Promise(done => { resolve = done; }));
  start(); await flush(); controller.abort(); resolve({ url }); await flush();
  expect(video).not.toHaveAttribute("src"); expect(failed).not.toHaveBeenCalled();
});

it("falls back if a previously playing stream stops producing video", async () => {
  send.mockResolvedValueOnce({ frontend_stream_types: ["hls"] }).mockResolvedValue({ url });
  start(); await flush(); video.dispatchEvent(new Event("playing"));
  await vi.advanceTimersByTimeAsync(60000); expect(failed).not.toHaveBeenCalled();
  video.dispatchEvent(new Event("waiting")); await vi.advanceTimersByTimeAsync(30000);
  expect(failed).toHaveBeenCalledOnce();
});
