import type { Connection } from "home-assistant-js-websocket";
import { z } from "zod";
import hlsWorkerUrl from "hls.js/dist/hls.worker.js?url";

const capabilitiesSchema = z.object({ frontend_stream_types: z.array(z.string()) });
const clientConfigSchema = z.object({ configuration: z.record(z.unknown()), dataChannel: z.string().nullish() });
const streamSchema = z.object({ url: z.string().regex(/^\/api\/hls\/[a-f0-9]+\/master_playlist\.m3u8$/) });
const candidateSchema = z.object({ candidate: z.string(), sdpMid: z.string().nullish(), sdpMLineIndex: z.number().int().nonnegative().nullish(), usernameFragment: z.string().nullish() });
const eventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("session"), session_id: z.string().min(1) }),
  z.object({ type: z.literal("answer"), answer: z.string().min(1) }),
  z.object({ type: z.literal("candidate"), candidate: candidateSchema }),
  z.object({ type: z.literal("error") }),
]);

// One visible surface owns one player; abort also closes its HA signaling subscription.
export function playCameraStream(connection: Connection, entityId: string, video: HTMLVideoElement, signal: AbortSignal, onError: () => void) {
  if (signal.aborted) return;
  let stopped = false, attempt = 0;
  let types: string[] = [];
  let dispose = () => {};
  let usingHlsJs = false;
  let timer: ReturnType<typeof setTimeout>;
  const current = (id: number) => !stopped && !signal.aborted && id === attempt;
  const clearPlayer = () => {
    clearTimeout(timer);
    dispose(); dispose = () => {};
    usingHlsJs = false;
    video.pause(); video.srcObject = null; video.removeAttribute("src"); video.load();
  };
  const stop = () => {
    stopped = true; attempt++;
    video.removeEventListener("playing", playing);
    video.removeEventListener("pause", paused);
    video.removeEventListener("waiting", waiting);
    video.removeEventListener("error", mediaError);
    video.removeEventListener("ended", next);
    signal.removeEventListener("abort", stop);
    clearPlayer();
  };
  const playing = () => clearTimeout(timer);
  const paused = () => { if (video.readyState >= 3) clearTimeout(timer); };
  const waiting = () => { clearTimeout(timer); timer = setTimeout(next, 30000); };
  const next = () => { if (!stopped) void startNext(); };
  const mediaError = () => { if (!usingHlsJs) next(); };

  async function startNext() {
    const id = ++attempt;
    clearPlayer();
    const type = types.shift();
    if (!type) { stop(); onError(); return; }
    const fail = () => { if (current(id)) next(); };
    timer = setTimeout(fail, type === "web_rtc" ? 15000 : 45000);
    try {
      if (type === "web_rtc") {
        const config = clientConfigSchema.parse(await connection.sendMessagePromise({ type: "camera/webrtc/get_client_config", entity_id: entityId }));
        if (!current(id)) return;
        const peer = new RTCPeerConnection(config.configuration);
        const stream = new MediaStream();
        let unsubscribe: (() => Promise<void>) | undefined;
        let session: string | undefined;
        let events = Promise.resolve();
        const localCandidates: RTCIceCandidateInit[] = [], remoteCandidates: RTCIceCandidateInit[] = [];
        dispose = () => {
          peer.ontrack = null; peer.onicecandidate = null; peer.oniceconnectionstatechange = null;
          peer.close(); stream.getTracks().forEach(track => track.stop());
          void unsubscribe?.().catch(() => {});
        };
        const sendCandidate = (candidate: RTCIceCandidateInit) => {
          void connection.sendMessagePromise({ type: "camera/webrtc/candidate", entity_id: entityId, session_id: session, candidate }).catch(fail);
        };
        peer.onicecandidate = ({ candidate }) => {
          if (!current(id) || !candidate) return;
          if (session) sendCandidate(candidate.toJSON()); else localCandidates.push(candidate.toJSON());
        };
        peer.oniceconnectionstatechange = () => {
          if (peer.iceConnectionState === "failed") fail();
          else if (peer.iceConnectionState === "disconnected") waiting();
          else if (["connected", "completed"].includes(peer.iceConnectionState) && video.readyState >= 3) playing();
        };
        peer.ontrack = ({ track }) => {
          if (!current(id)) return;
          stream.addTrack(track);
          if (video.srcObject !== stream) { video.srcObject = stream; void video.play().catch(fail); }
        };
        if (config.dataChannel) peer.createDataChannel(config.dataChannel);
        peer.addTransceiver("audio", { direction: "recvonly" });
        peer.addTransceiver("video", { direction: "recvonly" });
        const offer = await peer.createOffer();
        if (!current(id)) return;
        await peer.setLocalDescription(offer);
        if (!current(id)) return;
        const unsub = await connection.subscribeMessage<unknown>(message => {
          events = events.then(async () => {
            if (!current(id)) return;
            const event = eventSchema.parse(message);
            if (event.type === "session") {
              session = event.session_id;
              localCandidates.splice(0).forEach(sendCandidate);
            } else if (event.type === "answer") {
              await peer.setRemoteDescription({ type: "answer", sdp: event.answer });
              for (const candidate of remoteCandidates.splice(0)) {
                if (!current(id)) return;
                await peer.addIceCandidate(candidate);
              }
            } else if (event.type === "candidate") {
              const candidate = { ...event.candidate, ...(event.candidate.sdpMid == null && event.candidate.sdpMLineIndex == null ? { sdpMid: "0" } : {}) };
              if (peer.remoteDescription) await peer.addIceCandidate(candidate); else remoteCandidates.push(candidate);
            } else fail();
          }).catch(fail);
        }, { type: "camera/webrtc/offer", entity_id: entityId, offer: offer.sdp }, { resubscribe: false });
        if (current(id)) unsubscribe = unsub; else void unsub().catch(() => {});
      } else {
        const { url } = streamSchema.parse(await connection.sendMessagePromise({ type: "camera/stream", entity_id: entityId, format: "hls" }));
        if (!current(id)) return;
        // Safari's native player also supports codecs unavailable to MediaSource on some devices.
        if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = url;
          void video.play().catch(fail);
          return;
        }
        const Hls: typeof import("hls.js").default = (await import("hls.js/dist/hls.light.mjs")).default;
        if (!current(id)) return;
        if (!Hls.isSupported()) { fail(); return; }
        const hls = new Hls({ workerPath: hlsWorkerUrl, lowLatencyMode: true, backBufferLength: 30, maxLiveSyncPlaybackRate: 2,
          manifestLoadPolicy: { default: { ...Hls.DefaultConfig.manifestLoadPolicy.default, maxLoadTimeMs: 30000 } },
          playlistLoadPolicy: { default: { ...Hls.DefaultConfig.playlistLoadPolicy.default, maxTimeToFirstByteMs: 30000, maxLoadTimeMs: 30000 } },
        });
        usingHlsJs = true;
        dispose = () => hls.destroy();
        let recovered = false;
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (!current(id) || !data.fatal) return;
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR && !recovered) { recovered = true; hls.recoverMediaError(); }
          else fail();
        });
        hls.on(Hls.Events.MANIFEST_PARSED, () => { if (current(id)) void video.play().catch(fail); });
        hls.loadSource(url);
        hls.attachMedia(video);
      }
    } catch { fail(); }
  }

  signal.addEventListener("abort", stop, { once: true });
  video.addEventListener("playing", playing);
  video.addEventListener("pause", paused);
  video.addEventListener("waiting", waiting);
  video.addEventListener("error", mediaError);
  video.addEventListener("ended", next);
  timer = setTimeout(next, 15000);
  void connection.sendMessagePromise({ type: "camera/capabilities", entity_id: entityId }).then(result => {
    if (!current(0)) return;
    const supported = capabilitiesSchema.parse(result).frontend_stream_types;
    types = ["web_rtc", "hls"].filter(type => supported.includes(type) && (type !== "web_rtc" || typeof RTCPeerConnection !== "undefined"));
    next();
  }).catch(() => {
    if (!current(0)) return;
    // HA versions before camera/capabilities can still supply HLS.
    types = ["hls"]; next();
  });
}
