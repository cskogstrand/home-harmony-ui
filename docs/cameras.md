# Cameras and person snapshots

Open **Smart home → Cameras** to watch your cameras. Each camera has **Configure camera** and **Use in notification** shortcuts. **Camera settings** opens setup for all cameras; it is also available under **Home settings → Cameras**.

Camera settings lists your Home Assistant cameras automatically. Open a camera and choose its **Video source**: **Home Assistant** or **Frigate / go2rtc**. The same saved source is used by the camera page, device cards, expanded viewers and camera notification popups. Unconfigured cameras keep their Home Assistant player. Settings are shared across screens and included in version 3 backups; old backups default to no overrides.

## Frigate / go2rtc live video

1. Configure the camera stream in Frigate's `go2rtc.streams` (or standalone go2rtc).
2. Open the matching camera's settings and select **Video source → Frigate / go2rtc**. Enter the **go2rtc server address**, for example `http://go2rtc.example:1984`. This address is shared by all go2rtc cameras and must be reachable from the Home Harmony server. It is the go2rtc API, not the RTSP port or Frigate's web UI. A reverse-proxy base path is supported.
3. Enter its **Stream name or RTSP address**, for example `example_camera` or `rtsp://frigate.example:8554/example_camera`. Only `example_camera` is saved from that RTSP URL. The go2rtc server address determines which go2rtc instance serves it. URLs containing credentials, query parameters or fragments are rejected. Define camera credentials inside go2rtc's own private configuration.
4. Press **Save and watch stream**. After saving, it becomes **Watch live stream**. The player tries go2rtc WebRTC first. If it fails, it reports that it is trying the existing Home Assistant WebRTC/HLS player, followed by the existing MJPEG and still-image fallbacks. Select **Video source → Home Assistant** to switch back.

Browsers do not play RTSP directly. Home Harmony exchanges receive-only SDP with go2rtc through its authenticated server, and the browser receives WebRTC media from go2rtc. The browser therefore needs access to the configured WebRTC candidates, normally TCP/UDP port 8555. Configure candidates for your LAN, VPN or remote access as appropriate; HTTP signaling alone does not relay video. H.264 offers the broadest compatibility. No new transcoder or public STUN service is added by Home Harmony. See [Frigate restreaming](https://docs.frigate.video/configuration/restream/) and [WebRTC setup](https://docs.frigate.video/configuration/live/#webrtc-extra-configuration).

For the Frigate Home Assistant app, the go2rtc API port may need enabling in its network settings. Keep that API on a trusted network: this implementation expects the configured go2rtc API to be reachable without an additional login. See [Frigate port access](https://docs.frigate.video/troubleshooting/go2rtc/#home-assistant-and-port-access). Inline device previews pause offscreen. Open live viewers pause in background tabs and stop when closed. A configured go2rtc stream can play independently of the HA camera's availability.

## Person images

Choose a **Person snapshot source** for each camera:

- **Person image from Home Assistant:** select Frigate's `image.example_camera_person` entity. Older `camera.*` snapshot entities also work. A `sensor.*` or `binary_sensor.*` works only if its `entity_picture` points to HA's `image_proxy` or `camera_proxy`; external URLs and unrelated API paths are rejected. A person occupancy/count sensor without a picture is a notification trigger, not an image source. The [Frigate integration](https://github.com/blakeblackshear/frigate-hass-integration) publishes current person snapshots through image entities.
- **Person image directly from Frigate:** enter the **Frigate server address**, for example `http://frigate.example:5000`, and the **Frigate camera name**, which can differ from the go2rtc stream name. Home Harmony requests `/api/<camera>/person/snapshot.jpg`. Enable person tracking and snapshots in Frigate. Use its internal API on a trusted network reachable from this server without a login. If direct access requires authentication, select the HA image entity instead. Credentials and tokens do not belong in these settings.

Save, then use **Preview person snapshot**. Expanded device viewers offer **Live camera** and **Person snapshot** when a snapshot is configured. Image requests use the dashboard's authentication; the HA token is added only by the server to HA requests. No HA credentials are forwarded to go2rtc or Frigate, and redirects are refused. Images are not written to settings or backups and responses are marked `no-store`.

The viewer shows the latest available person image, **not an event-bound capture**. It may predate an alert; the UI labels that limitation. While open and the tab is visible, the image refreshes five seconds after the previous request finishes, and HA image updates also refresh it. This allows a delayed snapshot to appear after a person sensor triggers. Frigate can return an empty image when no snapshot exists.

## Notifications

From a camera, press **Use in notification** to start a camera rule with that camera already selected. Or open **Home settings → Notifications** and add or edit a **Camera popup**.

Under **Camera and image**, choose the camera. **Show in notification** offers its saved live source, labeled **Live video from go2rtc · example_camera** or **Live video from Home Assistant**, and **Person snapshot** when configured. To switch between go2rtc and Home Assistant, change the camera's **Video source** in its settings. **Test camera output** shows the selected video or image inside the editor. **Configure camera (new tab)** opens that camera's settings while keeping your notification draft.

Choose the trigger under **When to show it**, then save the notification. An occupancy sensor changing to `on`, or a count sensor exceeding `0`, can trigger either mode. Existing rules keep live video.

The popup layout, notification presentations, trigger rules and expiry behavior are unchanged. Event-specific snapshots, recordings and the popup redesign are outside this change.

Validation used automated tests and synthetic UI fixtures. Real Frigate/go2rtc/Home Assistant camera playback and hardware were not verified.
