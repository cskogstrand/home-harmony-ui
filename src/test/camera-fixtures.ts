import type { CameraSettings } from "../../shared/cameras";
export const cameraSettings = (): CameraSettings => ({
  connections: [{ id: "example-go2rtc", name: "Example go2rtc", type: "go2rtc", url: "http://go2rtc.example:1984" }],
  items: [{ id: "example-camera", name: "Example camera", connectionId: "example-go2rtc", source: "example", personSnapshot: { type: "home-assistant", entity: "image.example_person" } }],
});
