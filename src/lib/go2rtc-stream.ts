// go2rtc converts its configured RTSP restream to browser WebRTC; signaling stays same-origin.
export function playGo2rtcStream(entityId: string, video: HTMLVideoElement, signal: AbortSignal, onError: () => void) {
  if (signal.aborted) return;
  let peer: RTCPeerConnection | undefined, stream: MediaStream | undefined;
  const request = new AbortController();
  let stopped = false, sent = false;
  let timer: ReturnType<typeof setTimeout>;
  const playing = () => clearTimeout(timer);
  const waiting = () => { clearTimeout(timer); timer = setTimeout(fail, 20000); };
  const stop = () => {
    if (stopped) return;
    stopped = true; clearTimeout(timer); request.abort();
    signal.removeEventListener("abort", stop);
    video.removeEventListener("playing", playing); video.removeEventListener("waiting", waiting);
    video.removeEventListener("error", fail); video.removeEventListener("ended", fail);
    if (peer) { peer.ontrack = null; peer.onicecandidate = null; peer.oniceconnectionstatechange = null; peer.close(); }
    stream?.getTracks().forEach(track => track.stop());
    video.pause(); video.srcObject = null; video.removeAttribute("src"); video.load();
  };
  const fail = () => { if (!stopped) { stop(); onError(); } };
  signal.addEventListener("abort", stop, { once: true });
  video.addEventListener("playing", playing); video.addEventListener("waiting", waiting);
  video.addEventListener("error", fail); video.addEventListener("ended", fail);
  waiting();
  void (async () => {
    peer = new RTCPeerConnection({ iceServers: [] });
    stream = new MediaStream();
    peer.ontrack = ({ track }) => {
      if (stopped) return;
      stream.addTrack(track);
      if (video.srcObject !== stream) { video.srcObject = stream; void video.play().catch(fail); }
    };
    peer.oniceconnectionstatechange = () => {
      if (peer.iceConnectionState === "failed") fail();
      else if (peer.iceConnectionState === "disconnected") waiting();
      else if (["connected", "completed"].includes(peer.iceConnectionState) && video.readyState >= 3) playing();
    };
    const exchange = async () => {
      if (sent || stopped || !peer.localDescription?.sdp) return;
      sent = true;
      const response = await fetch(`/api/cameras/${encodeURIComponent(entityId)}/webrtc`, {
        method: "POST", headers: { "Content-Type": "application/sdp" }, body: peer.localDescription.sdp, signal: request.signal,
      });
      if (!response.ok) throw new Error("Stream unavailable");
      const sdp = await response.text();
      if (!stopped) await peer.setRemoteDescription({ type: "answer", sdp });
    };
    peer.onicecandidate = ({ candidate }) => { if (!candidate) void exchange().catch(fail); };
    peer.addTransceiver("audio", { direction: "recvonly" });
    peer.addTransceiver("video", { direction: "recvonly" });
    const offer = await peer.createOffer();
    if (stopped) return;
    await peer.setLocalDescription(offer);
    if (peer.iceGatheringState === "complete") await exchange();
  })().catch(fail);
}
