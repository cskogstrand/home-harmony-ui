import { go2rtcErrors, homeAssistantPicturePath } from "../shared/cameras.ts";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

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
  const match = url.pathname.match(/^\/api\/cameras\/([a-zA-Z0-9_.-]{1,128})\/(webrtc|stream\.mp4|snapshot\.jpg|person\.jpg)$/);
  const discovery = url.pathname.match(/^\/api\/camera-connections\/([a-zA-Z0-9_.-]{1,128})\/streams$/);
  if (discovery ? request.method !== "GET" : !match || request.method !== (match[2] === "webrtc" ? "POST" : "GET")) throw failure(404, "Camera source not found.");
  const source = match && settings.items.find(camera => camera.id === match[1]);
  if (!discovery && !source) throw failure(404, "Configure this camera in Camera settings.");
  const controller = new AbortController();
  const close = () => controller.abort();
  response.once("close", close);
  const timeout = setTimeout(close, 15000);
  const fetchMedia = (target, options = {}) => fetch(target, { ...options, redirect: "error", signal: controller.signal });
  const haHeaders = { Authorization: `Bearer ${homeAssistantToken}` };
  try {
    let target, options, allowedTypes, limit;
    if (discovery) {
      const connection = settings.connections.find(item => item.id === discovery[1] && item.type === "go2rtc");
      if (!connection) throw failure(404, "go2rtc connection not found.");
      const result = await fetchMedia(`${connection.url}/api/streams`);
      if (!result.ok || !result.headers.get("content-type")?.startsWith("application/json")) throw new Error();
      const streams = JSON.parse((await readLimited(result.body, 2 * 1024 * 1024)).toString("utf8"));
      if (!streams || typeof streams !== "object" || Array.isArray(streams)) throw new Error();
      // Upstream stream details can include camera credentials; return names only.
      const names = Object.keys(streams).filter(name => /^[a-zA-Z0-9_-][a-zA-Z0-9_.-]{0,127}$/.test(name)).sort().slice(0, 500);
      response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
      response.end(JSON.stringify(names)); return;
    }
    if (match[2] === "stream.mp4") {
      const connection = settings.connections.find(item => item.id === source.connectionId && item.type === "go2rtc");
      if (!connection) throw failure(404, "Configure a go2rtc stream for this camera.");
      const result = await fetchMedia(`${connection.url}/api/stream.mp4?${new URLSearchParams({ src: source.source })}`).catch(() => { throw failure(502, go2rtcErrors.unreachable); });
      const contentType = result.headers.get("content-type") ?? "";
      if (!result.ok) throw failure(502, go2rtcErrors.rejected);
      if (!result.body || !/^video\/mp4\s*;\s*codecs="[a-zA-Z0-9., -]+"$/i.test(contentType)) throw failure(502, go2rtcErrors.playback);
      clearTimeout(timeout);
      response.writeHead(200, { "Content-Type": contentType, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
      await pipeline(Readable.fromWeb(result.body), response, { signal: controller.signal });
      return;
    }
    if (match[2] === "snapshot.jpg") {
      if (source.frigatePreview) {
        const connection = settings.connections.find(item => item.id === source.frigatePreview.connectionId && item.type === "frigate");
        if (!connection) throw failure(404, "Configure the Frigate preview connection.");
        target = `${connection.url}/api/${encodeURIComponent(source.frigatePreview.camera)}/latest.jpg`;
        allowedTypes = ["image/jpeg", "image/png", "image/webp"];
      } else {
        const connection = settings.connections.find(item => item.id === source.connectionId && item.type === "go2rtc");
        if (!connection) throw failure(404, "Configure a go2rtc stream for this camera.");
        target = `${connection.url}/api/frame.jpeg?${new URLSearchParams({ src: source.source, width: "640" })}`;
        allowedTypes = ["image/jpeg"];
      }
      limit = 10 * 1024 * 1024;
    } else if (match[2] === "webrtc") {
      const connection = settings.connections.find(item => item.id === source.connectionId && item.type === "go2rtc");
      if (!connection) throw failure(404, "Configure a go2rtc stream for this camera.");
      if (request.headers["content-type"]?.split(";")[0] !== "application/sdp") throw failure(415, "Send an SDP offer.");
      const offer = (await readLimited(request, 65536)).toString("utf8");
      if (!offer.startsWith("v=0") || !/^a=recvonly\r?$/m.test(offer) || /^a=(sendonly|sendrecv)\r?$/m.test(offer)) throw failure(400, "Send a receive-only SDP offer.");
      target = `${connection.url}/api/webrtc?${new URLSearchParams({ src: source.source })}`;
      options = { method: "POST", headers: { "Content-Type": "application/sdp" }, body: offer };
      allowedTypes = ["application/sdp"]; limit = 65536;
    } else {
      const snapshot = source.personSnapshot;
      if (snapshot.type === "none") throw failure(404, "Configure a person snapshot for this camera.");
      if (snapshot.type === "frigate") {
        const connection = settings.connections.find(item => item.id === snapshot.connectionId && item.type === "frigate");
        if (!connection) throw failure(404, "Configure the Frigate connection.");
        target = `${connection.url}/api/${encodeURIComponent(snapshot.camera)}/person/snapshot.jpg`;
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
    const result = await fetchMedia(target, options).catch(error => {
      if (match[2] === "webrtc") throw failure(502, go2rtcErrors.unreachable);
      throw error;
    });
    const contentType = result.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
    if (match[2] === "webrtc") {
      if (!result.ok) throw failure(502, go2rtcErrors.rejected);
      if (contentType !== "application/sdp") throw failure(502, go2rtcErrors.invalid);
    }
    if (!result.ok || !result.body || !allowedTypes.includes(contentType)) throw new Error();
    const contents = await readLimited(result.body, limit);
    response.writeHead(200, { "Content-Type": contentType, "Content-Length": contents.length, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
    response.end(contents);
  } catch (error) {
    if (response.headersSent) { response.destroy(); return; }
    if (!response.destroyed) throw error.status ? error : failure(502, "Camera media unavailable. Check Camera settings and the upstream server.");
  } finally { clearTimeout(timeout); controller.abort(); response.off("close", close); }
}
