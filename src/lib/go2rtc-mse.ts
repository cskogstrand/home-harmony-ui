import { go2rtcErrors } from "../../shared/cameras";

// HTTP fMP4 uses the same go2rtc media as MSE, through the authenticated dashboard.
export function playGo2rtcMse(id: string, video: HTMLVideoElement, signal: AbortSignal, onError: (message: string) => void) {
  if (signal.aborted) return;
  const ManagedSource = (globalThis as typeof globalThis & { ManagedMediaSource?: typeof MediaSource }).ManagedMediaSource;
  const Source = ManagedSource ?? globalThis.MediaSource;
  if (!Source) { onError(go2rtcErrors.playback); return; }
  const request = new AbortController();
  const source = new Source();
  const objectUrl = URL.createObjectURL(source);
  let stopped = false;
  let buffer: SourceBuffer;
  let timer: ReturnType<typeof setTimeout>;
  const catchUp = () => {
    if (video.paused || !buffer?.buffered.length) return;
    const end = buffer.buffered.end(buffer.buffered.length - 1);
    if (end - video.currentTime > 5) video.currentTime = Math.max(0, end - 1);
  };
  const stop = () => {
    if (stopped) return;
    stopped = true; clearTimeout(timer); request.abort();
    signal.removeEventListener("abort", stop);
    source.removeEventListener("sourceopen", open);
    video.removeEventListener("play", catchUp); video.removeEventListener("playing", playing); video.removeEventListener("waiting", waiting); video.removeEventListener("error", failed);
    video.pause(); video.removeAttribute("src"); video.load(); URL.revokeObjectURL(objectUrl);
  };
  const fail = (message: string) => { if (!stopped) { stop(); onError(message); } };
  const failed = () => fail(go2rtcErrors.playback);
  const playing = () => clearTimeout(timer);
  const waiting = () => { clearTimeout(timer); timer = setTimeout(failed, 20000); };
  const update = (buffer: SourceBuffer, action: () => void) => new Promise<void>((resolve, reject) => {
    const cleanup = () => { buffer.removeEventListener("updateend", done); buffer.removeEventListener("error", error); request.signal.removeEventListener("abort", error); };
    const done = () => { cleanup(); resolve(); };
    const error = () => { cleanup(); reject(new Error()); };
    buffer.addEventListener("updateend", done, { once: true }); buffer.addEventListener("error", error, { once: true }); request.signal.addEventListener("abort", error, { once: true });
    try { if (request.signal.aborted) error(); else action(); } catch { error(); }
  });
  const open = () => { void (async () => {
    const response = await fetch(`/api/cameras/${encodeURIComponent(id)}/stream.mp4`, { signal: request.signal });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      fail(Object.values(go2rtcErrors).includes(body?.error) ? body.error : go2rtcErrors.signaling); return;
    }
    const type = response.headers.get("content-type") ?? "";
    if (!response.body || !Source.isTypeSupported(type)) { failed(); return; }
    if (stopped) return;
    buffer = source.addSourceBuffer(type);
    const reader = response.body.getReader();
    while (!stopped) {
      const { done, value } = await reader.read();
      if (stopped) return;
      if (done) { failed(); return; }
      await update(buffer, () => buffer.appendBuffer(value));
      if (buffer.buffered.length) {
        const end = buffer.buffered.end(buffer.buffered.length - 1);
        catchUp();
        const before = end - 15;
        if (before > buffer.buffered.start(0)) await update(buffer, () => buffer.remove(0, before));
      }
    }
  })().catch(failed); };
  signal.addEventListener("abort", stop, { once: true });
  source.addEventListener("sourceopen", open, { once: true });
  video.addEventListener("play", catchUp); video.addEventListener("playing", playing); video.addEventListener("waiting", waiting); video.addEventListener("error", failed);
  video.disableRemotePlayback = true;
  video.srcObject = null; video.src = objectUrl;
  waiting();
  void video.play().catch(failed);
}
