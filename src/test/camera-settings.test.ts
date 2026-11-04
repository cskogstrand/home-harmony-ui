import { cameraSettings } from "./camera-fixtures";
import { expect, it } from "vitest";
import { cameraConnectionSchema, cameraSettingsSchema, go2rtcLink, go2rtcPlayerUrl, homeAssistantPicturePath } from "../../shared/cameras";
import { emptyConfiguration, parseConfiguration } from "../../shared/configuration";

it("defaults old backups and round-trips camera sources without storing RTSP hosts", () => {
  const config = emptyConfiguration();
  delete config.settings.cameras;
  expect(parseConfiguration(JSON.stringify(config)).settings.cameras).toEqual({ connections: [], items: [] });
  config.settings.cameras = cameraSettingsSchema.parse({ go2rtcUrl: "http://go2rtc.example:1984/", frigateUrl: "http://frigate.example:5000/", sources: {
    "camera.example": { stream: "rtsp://frigate.example:8554/example_camera", personSnapshot: { type: "frigate", camera: "example_camera" } },
    "camera.second": { personSnapshot: { type: "home-assistant", entity: "image.example_person" } },
  } });
  expect(config.settings.cameras.items[0].source).toBe("example_camera");
  expect(config.settings.cameras.connections[0].url).toBe("http://go2rtc.example:1984");
  expect(parseConfiguration(JSON.stringify(config))).toEqual(config);
});

it("round-trips person inset sizes and rejects unsupported sizes without changing older cameras", () => {
  const config = emptyConfiguration(); config.settings.cameras = cameraSettings();
  expect(parseConfiguration(JSON.stringify(config)).settings.cameras.items[0].personPipSize).toBeUndefined();
  for (const size of ["small", "medium", "large", "xlarge"] as const) {
    config.settings.cameras.items[0].personPipSize = size;
    expect(parseConfiguration(JSON.stringify(config)).settings.cameras.items[0].personPipSize).toBe(size);
  }
  for (const size of ["huge", "", 50, null]) {
    expect(cameraSettingsSchema.safeParse({ ...config.settings.cameras, items: [{ ...config.settings.cameras.items[0], personPipSize: size }] }).success).toBe(false);
  }
});

it("rejects credentials, arbitrary stream URLs, unsafe identifiers and missing servers", () => {
  for (const stream of ["rtsp://user:secret@example.test:8554/cam", "http://example.test/cam", "ffmpeg:example", "../other", "cam?src=other"]) {
    expect(cameraSettingsSchema.safeParse({ go2rtcUrl: "http://example.test", sources: { "camera.example": { stream } } }).success, stream).toBe(false);
  }
  for (const url of ["file:///tmp/camera", "http://user:secret@example.test", "http://example.test?token=secret", "http://example.test/#secret"]) {
    expect(cameraSettingsSchema.safeParse({ go2rtcUrl: url }).success).toBe(false);
  }
  expect(cameraSettingsSchema.safeParse({ sources: { "camera.example": { stream: "example" } } }).success).toBe(false);
  expect(cameraSettingsSchema.safeParse({ sources: { "camera.example": { personSnapshot: { type: "frigate", camera: "example" } } } }).success).toBe(false);
  expect(cameraSettingsSchema.safeParse({ sources: { "sensor.example": {} } }).success).toBe(false);
});

it("accepts only HA picture proxies and discards picture access tokens", () => {
  expect(homeAssistantPicturePath("/api/image_proxy/image.example_person?token=fixture")).toBe("/api/image_proxy/image.example_person");
  expect(homeAssistantPicturePath("/api/camera_proxy/camera.example_person")).toBe("/api/camera_proxy/camera.example_person");
  for (const value of ["https://other.example/image.jpg", "//other.example/image.jpg", "/api/image_proxy/image.example/../config", "/api/services/light/turn_on", null]) expect(homeAssistantPicturePath(value)).toBeUndefined();
});

it("accepts go2rtc player links while retaining the connection base path and rejecting credentials", () => {
  for (const page of ["stream.html?src=example_sub", "webrtc.html?src=example_sub&media=video+audio"]) {
    const link = `https://go2rtc.example/proxy/${page}`;
    expect(go2rtcLink(link)).toEqual({ serverUrl: "https://go2rtc.example/proxy", stream: "example_sub" });
    const settings = cameraSettings();
    settings.connections[0].url = link; settings.items[0].source = link;
    const saved = cameraSettingsSchema.parse(settings);
    expect(saved.items[0].source).toBe("example_sub");
    expect(go2rtcPlayerUrl(saved.connections[0], saved.items[0].source)).toBe("https://go2rtc.example/proxy/stream.html?src=example_sub");
  }
  for (const link of ["http://user:secret@go2rtc.example/stream.html?src=example", "http://go2rtc.example/stream.html?src=example&token=secret", "http://go2rtc.example/stream.html?src=example&src=other", "http://go2rtc.example/stream.html?src=ffmpeg:example", "http://go2rtc.example/stream.html?src=example#secret"]) {
    expect(go2rtcLink(link)).toBeUndefined();
    expect(cameraConnectionSchema.safeParse({ ...cameraSettings().connections[0], url: link }).success).toBe(false);
  }
});


it("preserves only explicit old camera sources and notification selections, with idempotent migration", () => {
  const config = emptyConfiguration();
  config.settings.notifications.rules = [{ id: "example", title: "Example", kind: "camera", cameraEntity: "home|camera.example", entityDisplay: [{ entity: "home|camera.example", attribute: "", name: "Example status", placement: "footer" }], trigger: { type: "state", entity: "home|binary_sensor.example", operator: "eq", value: "on" } } as never];
  const migrated = parseConfiguration(JSON.stringify(config));
  expect(migrated.settings.cameras.items).toEqual([{ id: "legacy-camera.example", name: "camera.example", connectionId: "home-assistant", source: "camera.example", personSnapshot: { type: "none" } }]);
  expect(migrated.settings.notifications.rules[0].cameraEntity).toBe("legacy-camera.example");
  expect(migrated.settings.notifications.rules[0].detailEntities).toContain("home|camera.example");
  expect(migrated.settings.notifications.rules[0].entityDisplay[0].name).toBe("Example status");
  expect(parseConfiguration(JSON.stringify(migrated))).toEqual(migrated);
  migrated.settings.notifications.rules = []; migrated.settings.cameras.items = [];
  expect(parseConfiguration(JSON.stringify(migrated)).settings.cameras.items).toEqual([]);
});

it("validates unique IDs, live connector types and snapshot references and normalizes RTSP input", () => {
  const settings = cameraSettings();
  settings.items[0].source = "rtsp://frigate.example:8554/example_sub";
  expect(cameraSettingsSchema.parse(settings).items[0].source).toBe("example_sub");
  expect(cameraSettingsSchema.safeParse({ ...settings, connections: [] }).success).toBe(false);
  expect(cameraSettingsSchema.safeParse({ ...settings, items: [settings.items[0], settings.items[0]] }).success).toBe(false);
  expect(cameraSettingsSchema.safeParse({ ...settings, connections: [...settings.connections, settings.connections[0]] }).success).toBe(false);
  settings.items[0].connectionId = "home-assistant";
  expect(cameraSettingsSchema.safeParse(settings).success).toBe(false);
  settings.items[0].source = "camera.example";
  expect(cameraSettingsSchema.safeParse(settings).success).toBe(true);
  settings.items[0].personSnapshot = { type: "frigate", connectionId: "example-go2rtc", camera: "example" };
  expect(cameraSettingsSchema.safeParse(settings).success).toBe(false);
});

it("round-trips a separate Frigate preview and rejects invalid names or connections", () => {
  const config = emptyConfiguration(); config.settings.cameras = cameraSettings();
  config.settings.cameras.connections.push({ id: "frigate", name: "Example Frigate", type: "frigate", url: "http://frigate.example:5000" });
  const camera = config.settings.cameras.items[0];
  camera.frigatePreview = { connectionId: "frigate", camera: "example_entry" };
  expect(parseConfiguration(JSON.stringify(config))).toEqual(config);
  for (const invalid of [
    { connectionId: "missing", camera: "example_entry" }, { connectionId: "example-go2rtc", camera: "example_entry" },
    { connectionId: "frigate", camera: "../other" }, { connectionId: "frigate", camera: "http://camera.example/latest.jpg" },
    { connectionId: "frigate", camera: "" },
  ]) {
    camera.frigatePreview = invalid;
    expect(cameraSettingsSchema.safeParse(config.settings.cameras).success).toBe(false);
  }
  delete camera.frigatePreview;
  expect(parseConfiguration(JSON.stringify(config))).toEqual(config);
});
