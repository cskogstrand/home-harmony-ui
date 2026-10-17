import { createHash, timingSafeEqual } from "node:crypto";
import WebSocket, { WebSocketServer } from "ws";

const failure = (status, message) => Object.assign(new Error(message), { status });
const digest = value => createHash("sha256").update(value).digest();

export function dashboardAccess(password, authDisabled = false) {
  if (!authDisabled && (typeof password !== "string" || password.length < 12)) throw new Error("Configure a dashboard password of at least 12 characters.");
  const expected = authDisabled ? undefined : digest(`Basic ${Buffer.from(`dashboard:${password}`).toString("base64")}`);
  return request => {
    if (expected && !timingSafeEqual(digest(request.headers.authorization ?? ""), expected)) throw failure(401, "Enter the dashboard username and password.");
    const origin = request.headers.origin;
    if (origin && new URL(origin).host !== request.headers.host) throw failure(403, "Cross-origin dashboard requests are not allowed.");
    if (request.headers["sec-fetch-site"] === "cross-site") throw failure(403, "Cross-site dashboard requests are not allowed.");
  };
}

export function attachHomeAssistantSocket(server, { homeAssistantUrl, homeAssistantToken, dashboardPassword, dashboardAuthDisabled }) {
  const authorize = dashboardAccess(dashboardPassword, dashboardAuthDisabled);
  const sockets = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 * 1024 });
  const upgrade = (request, socket, head) => {
    if (request.url !== "/api/websocket") return;
    try { authorize(request); }
    catch (error) { socket.end(`HTTP/1.1 ${error.status ?? 403} Rejected\r\nConnection: close\r\n\r\n`); return; }
    sockets.handleUpgrade(request, socket, head, browser => {
      const upstream = new WebSocket(`${homeAssistantUrl.replace(/^http/, "ws")}/api/websocket`, { handshakeTimeout: 10000, maxPayload: 16 * 1024 * 1024 });
      let authenticated = false;
      let browserAuth = false;
      const timeout = setTimeout(() => {
        console.warn(`Home Assistant WebSocket authentication timed out at ${homeAssistantUrl}. Check the configured URL and port.`);
        browser.terminate(); upstream.terminate();
      }, 15000);
      upstream.on("error", error => {
        const reason = error.code ?? error.message.match(/^Unexpected server response: \d{3}$/)?.[0] ?? "connection failed";
        console.warn(`Home Assistant WebSocket failed at ${homeAssistantUrl}: ${reason}. Check the URL, port and network access from the dashboard server.`);
        browser.close(1011, "Home Assistant is unavailable");
      });
      browser.on("error", () => upstream.terminate());
      upstream.on("close", () => { clearTimeout(timeout); browser.close(); });
      browser.on("close", () => { clearTimeout(timeout); upstream.close(); });
      upstream.on("message", data => {
        if (browser.readyState !== WebSocket.OPEN) return;
        let message;
        try { message = JSON.parse(data.toString()); } catch { browser.close(1011); return; }
        if (!message || typeof message !== "object") { browser.close(1011); return; }
        if (message.type === "auth_required") {
          upstream.send(JSON.stringify({ type: "auth", access_token: homeAssistantToken }));
          return;
        }
        if (message.type === "auth_ok") { authenticated = true; clearTimeout(timeout); }
        if (message.type === "auth_invalid") console.warn("Home Assistant rejected the configured server token. Update home_assistant_token / HOME_ASSISTANT_TOKEN and restart the dashboard.");
        browser.send(data.toString());
      });
      browser.on("message", (data, binary) => {
        let message;
        try { message = JSON.parse(data.toString()); } catch { browser.close(1008); return; }
        if (binary || !message || typeof message.type !== "string") { browser.close(1008); return; }
        // The browser sends a non-secret placeholder; only the server authenticates to HA.
        if (!browserAuth && message.type === "auth") { browserAuth = true; return; }
        if (!authenticated || !browserAuth || message.type === "auth" || upstream.readyState !== WebSocket.OPEN) { browser.close(1008); return; }
        upstream.send(data.toString());
      });
    });
  };
  server.on("upgrade", upgrade);
  return () => {
    server.off("upgrade", upgrade);
    for (const socket of sockets.clients) socket.terminate();
    sockets.close();
  };
}
