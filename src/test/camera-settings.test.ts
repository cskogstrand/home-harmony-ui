import { expect, it } from "vitest";
import { cameraSettingsSchema, homeAssistantPicturePath } from "../../shared/cameras";
import { emptyConfiguration, parseConfiguration } from "../../shared/configuration";

it("defaults old backups and round-trips camera sources without storing RTSP hosts", () => {
  const config = emptyConfiguration();
  delete config.settings.cameras;
  expect(parseConfiguration(JSON.stringify(config)).settings.cameras).toEqual({ go2rtcUrl: "", frigateUrl: "", sources: {} });
  config.settings.cameras = cameraSettingsSchema.parse({ go2rtcUrl: "http://go2rtc.example:1984/", frigateUrl: "http://frigate.example:5000/", sources: {
    "camera.example": { stream: "rtsp://frigate.example:8554/example_camera", personSnapshot: { type: "frigate", camera: "example_camera" } },
    "camera.second": { personSnapshot: { type: "home-assistant", entity: "image.example_person" } },
  } });
  expect(config.settings.cameras.sources["camera.example"].stream).toBe("example_camera");
  expect(config.settings.cameras.go2rtcUrl).toBe("http://go2rtc.example:1984");
  expect(parseConfiguration(JSON.stringify(config))).toEqual(config);
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
