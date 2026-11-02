import { homeAssistantPicturePath } from "../shared/cameras.ts";

const failure = (status, message) => Object.assign(new Error(message), { status });
async function readLimited(body, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of body) {
    size += chunk.length;
    if (size > limit) throw failure(413, "Camera response or offer is too large.");
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

// Called only after dashboard authentication; upstream destinations come from saved settings.
export async function proxyCameraMedia(request, response, url, settings, { homeAssistantUrl, homeAssistantToken }) {
  const match = url.pathname.match(/^\/api\/cameras\/(camera\.[a-z0-9_]+)\/(webrtc|person\.jpg)$/);
  if (!match || request.method !== (match[2] === "webrtc" ? "POST" : "GET")) throw failure(404, "Camera source not found.");
  const source = settings.sources[match[1]];
  if (!source) throw failure(404, "Configure this camera in Camera settings.");
  const controller = new AbortController();
  const close = () => controller.abort();
  response.once("close", close);
  const timeout = setTimeout(close, 15000);
  const fetchMedia = (target, options = {}) => fetch(target, { ...options, redirect: "error", signal: controller.signal });
  const haHeaders = { Authorization: `Bearer ${homeAssistantToken}` };
  try {
    let target, options, allowedTypes, limit;
    if (match[2] === "webrtc") {
      if (!settings.go2rtcUrl || !source.stream) throw failure(404, "Configure a go2rtc stream for this camera.");
      if (request.headers["content-type"]?.split(";")[0] !== "application/sdp") throw failure(415, "Send an SDP offer.");
      const offer = (await readLimited(request, 65536)).toString("utf8");
      if (!offer.startsWith("v=0") || !/^a=recvonly\r?$/m.test(offer) || /^a=(sendonly|sendrecv)\r?$/m.test(offer)) throw failure(400, "Send a receive-only SDP offer.");
      target = `${settings.go2rtcUrl}/api/webrtc?${new URLSearchParams({ src: source.stream })}`;
      options = { method: "POST", headers: { "Content-Type": "application/sdp" }, body: offer };
      allowedTypes = ["application/sdp"]; limit = 65536;
    } else {
      const snapshot = source.personSnapshot;
      if (snapshot.type === "none") throw failure(404, "Configure a person snapshot for this camera.");
      if (snapshot.type === "frigate") {
        if (!settings.frigateUrl) throw failure(404, "Configure the Frigate server URL.");
        target = `${settings.frigateUrl}/api/${encodeURIComponent(snapshot.camera)}/person/snapshot.jpg`;
      } else {
        let path;
        if (snapshot.entity.startsWith("image.")) path = `/api/image_proxy/${snapshot.entity}`;
        else if (snapshot.entity.startsWith("camera.")) path = `/api/camera_proxy/${snapshot.entity}`;
        else {
          const state = await fetchMedia(`${homeAssistantUrl}/api/states/${snapshot.entity}`, { headers: haHeaders });
          if (!state.ok) throw new Error();
          const entity = JSON.parse((await readLimited(state.body, 1024 * 1024)).toString("utf8"));
          path = homeAssistantPicturePath(entity.attributes?.entity_picture);
          if (!path) throw failure(422, "This sensor has no supported picture. Select the Frigate person image entity.");
        }
        target = `${homeAssistantUrl}${path}`; options = { headers: haHeaders };
      }
      allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"]; limit = 10 * 1024 * 1024;
    }
    const result = await fetchMedia(target, options);
    const contentType = result.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
    if (!result.ok || !result.body || !allowedTypes.includes(contentType)) throw new Error();
    const contents = await readLimited(result.body, limit);
    response.writeHead(200, { "Content-Type": contentType, "Content-Length": contents.length, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
    response.end(contents);
  } catch (error) {
    if (!response.destroyed) throw error.status ? error : failure(502, "Camera media unavailable. Check Camera settings and the upstream server.");
  } finally { clearTimeout(timeout); controller.abort(); response.off("close", close); }
}
