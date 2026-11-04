import { playGo2rtcStream } from "./go2rtc-stream";
import { playGo2rtcMse } from "./go2rtc-mse";

type Player = typeof playGo2rtcStream;
type Playback = { video: HTMLVideoElement; transport: "webrtc" | "mse" };
type View = {
  container: HTMLElement;
  name: string;
  expanded: boolean;
  update: (playback: Playback) => void;
  failed: (message?: string) => void;
  canvas: HTMLCanvasElement;
};
const sessions = new WeakMap<Player, Map<string, ReturnType<typeof createSession>>>();

function createSession(id: string, go2rtc: boolean, watchCameraStream: Player) {
  const video = document.createElement("video");
  video.autoplay = true; video.muted = true; video.playsInline = true;
  const views = new Set<View>();
  let playback: Playback = { video, transport: "webrtc" };
  let controller: AbortController;
  let frame: number | undefined;
  let error: { message?: string } | undefined;

  const draw = () => {
    if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) return;
    for (const view of views) {
      if (view.container.contains(video)) continue;
      const canvas = view.canvas;
      const width = Math.min(video.videoWidth, Math.round((canvas.clientWidth || video.videoWidth) * (window.devicePixelRatio || 1)));
      const height = Math.round(width * video.videoHeight / video.videoWidth);
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
      canvas.getContext("2d")?.drawImage(video, 0, 0, width, height);
    }
  };
  const cancelFrame = () => {
    if (frame === undefined) return;
    if (video.requestVideoFrameCallback) video.cancelVideoFrameCallback(frame);
    else cancelAnimationFrame(frame);
    frame = undefined;
  };
  const mirror = () => {
    draw();
    frame = video.requestVideoFrameCallback ? video.requestVideoFrameCallback(mirror) : requestAnimationFrame(mirror);
  };
  const placeVideo = () => {
    cancelFrame();
    const owner = [...views].reverse().find(view => view.expanded) ?? views.values().next().value as View | undefined;
    if (!owner) return;
    // Move the original element: MSE/HLS buffers cannot be attached to two videos.
    if (!owner.container.contains(video)) owner.container.replaceChildren(video);
    video.controls = owner.expanded;
    video.setAttribute("aria-label", owner.name);
    if (!owner.expanded) video.muted = true;
    for (const view of views) if (view !== owner && !view.container.contains(view.canvas)) view.container.replaceChildren(view.canvas);
    if (views.size > 1) mirror();
  };
  const start = () => {
    controller = new AbortController();
    const signal = controller.signal;
    const failed = (message?: string) => {
      if (signal.aborted) return;
      controller.abort();
      if (go2rtc && playback.transport === "webrtc") {
        playback = { video, transport: "mse" };
        for (const view of views) view.update(playback);
        start();
      } else {
        error = { message };
        for (const view of views) view.failed(message);
      }
    };
    (go2rtc ? playback.transport === "mse" ? playGo2rtcMse : playGo2rtcStream : watchCameraStream)(id, video, signal, failed);
  };
  return {
    add(view: View) {
      views.add(view); placeVideo(); view.update(playback);
      if (error) view.failed(error.message);
      else if (!controller) start();
    },
    remove(view: View) {
      views.delete(view); placeVideo(); view.container.replaceChildren();
      if (views.size) return false;
      controller?.abort(); video.remove();
      return true;
    },
  };
}

export function shareCameraStream(key: string, id: string, go2rtc: boolean, watchCameraStream: Player, options: Omit<View, "canvas">) {
  let streams = sessions.get(watchCameraStream);
  if (!streams) { streams = new Map(); sessions.set(watchCameraStream, streams); }
  let session = streams.get(key);
  if (!session) { session = createSession(id, go2rtc, watchCameraStream); streams.set(key, session); }
  const canvas = document.createElement("canvas");
  canvas.setAttribute("role", "img"); canvas.setAttribute("aria-label", options.name);
  const view = { ...options, canvas };
  session.add(view);
  return () => { if (session.remove(view)) streams.delete(key); };
}
