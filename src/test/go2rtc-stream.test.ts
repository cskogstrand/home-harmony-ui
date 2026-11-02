import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { playGo2rtcStream } from "@/lib/go2rtc-stream";

class Peer {
  static instances: Peer[] = [];
  iceGatheringState = "gathering";
  iceConnectionState = "new";
  localDescription = null;
  onicecandidate: (event: { candidate: unknown }) => void;
  oniceconnectionstatechange: () => void;
  ontrack: (event: { track: MediaStreamTrack }) => void;
  constructor() { Peer.instances.push(this); }
  addTransceiver = vi.fn(); close = vi.fn();
  createOffer = vi.fn(async () => ({ type: "offer", sdp: "v=0\r\na=recvonly\r\n" }));
  setLocalDescription = vi.fn(async value => { this.localDescription = value; });
  setRemoteDescription = vi.fn(async () => {});
}
let video: HTMLVideoElement, controller: AbortController;
const failed = vi.fn(), request = vi.fn();
const start = () => playGo2rtcStream("camera.example", video, controller.signal, failed);
beforeEach(() => {
  vi.useFakeTimers(); Peer.instances = []; failed.mockReset();
  request.mockReset().mockResolvedValue({ ok: true, text: async () => "v=0\r\nfixture-answer" });
  vi.stubGlobal("fetch", request); vi.stubGlobal("RTCPeerConnection", Peer);
  vi.stubGlobal("MediaStream", class { tracks = []; addTrack(track) { this.tracks.push(track); } getTracks() { return this.tracks; } });
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  video = document.createElement("video"); controller = new AbortController();
});
afterEach(() => { controller.abort(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

it("waits for ICE, exchanges SDP once, plays tracks and releases everything on abort", async () => {
  start(); await vi.advanceTimersByTimeAsync(0);
  const peer = Peer.instances[0];
  expect(request).not.toHaveBeenCalled();
  peer.localDescription.sdp += "a=candidate:fixture\r\n";
  peer.onicecandidate({ candidate: null }); peer.onicecandidate({ candidate: null });
  await vi.advanceTimersByTimeAsync(0);
  expect(request).toHaveBeenCalledExactlyOnceWith("/api/cameras/camera.example/webrtc", expect.objectContaining({ method: "POST", body: peer.localDescription.sdp, headers: { "Content-Type": "application/sdp" } }));
  expect(peer.setRemoteDescription).toHaveBeenCalledWith({ type: "answer", sdp: "v=0\r\nfixture-answer" });
  const track = { stop: vi.fn() };
  peer.ontrack({ track: track as unknown as MediaStreamTrack });
  expect(video.play).toHaveBeenCalledOnce();
  video.dispatchEvent(new Event("playing"));
  await vi.advanceTimersByTimeAsync(30000); expect(failed).not.toHaveBeenCalled();
  controller.abort();
  expect(peer.close).toHaveBeenCalledOnce(); expect(track.stop).toHaveBeenCalledOnce();
  expect(request.mock.calls[0][1].signal.aborted).toBe(true);
  expect(video.srcObject).toBeNull();
});

it("fails once on timeouts and allows the caller to start its fallback", async () => {
  start(); await vi.advanceTimersByTimeAsync(20000);
  expect(failed).toHaveBeenCalledOnce(); expect(Peer.instances[0].close).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(30000); expect(failed).toHaveBeenCalledOnce();
});

it("does not apply a late answer or start fallback after abort", async () => {
  let resolve;
  request.mockReturnValue(new Promise(done => { resolve = done; }));
  start(); await vi.advanceTimersByTimeAsync(0);
  const peer = Peer.instances[0]; peer.onicecandidate({ candidate: null });
  controller.abort();
  resolve({ ok: true, text: async () => "late answer" }); await vi.advanceTimersByTimeAsync(0);
  expect(peer.setRemoteDescription).not.toHaveBeenCalled(); expect(failed).not.toHaveBeenCalled();
});

it("fails cleanly on HTTP errors and unsupported WebRTC", async () => {
  request.mockResolvedValue({ ok: false });
  start(); await vi.advanceTimersByTimeAsync(0); Peer.instances[0].onicecandidate({ candidate: null });
  await vi.advanceTimersByTimeAsync(0); expect(failed).toHaveBeenCalledOnce();
  vi.stubGlobal("RTCPeerConnection", undefined); start(); await vi.advanceTimersByTimeAsync(0);
  expect(failed).toHaveBeenCalledTimes(2);
});
