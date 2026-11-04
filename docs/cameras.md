# Cameras and connections

Cameras are created explicitly in Home Harmony. Home Assistant discovery does not add them to the camera page or notification picker. A camera has its own name and ID, a connection, a video source, and an optional person image. A go2rtc camera does not need a Home Assistant camera entity.

## Set up connections

Open **Home settings → Camera connections**, or **Manage connections** from camera setup.

- **Home Assistant** is built in and uses the home's existing authenticated connection. Its `camera.*` entities become choices when adding a camera; its image entities can supply person snapshots.
- **go2rtc:** choose **Add connection**, give it a name and enter its HTTP API address, for example `http://go2rtc.example:1984`. A working `stream.html?src=example_camera` or `webrtc.html?src=example_camera&media=video+audio` URL is also accepted; its server address is extracted. Multiple cameras can share this connection, and multiple go2rtc servers can be configured separately.
- **Frigate snapshots:** add a separate connection with Frigate's internal API address, for example `http://frigate.example:5000`. This connection supplies fast camera previews and person images; go2rtc supplies live video.

Addresses must be reachable from the Home Harmony server without an additional login. A reverse-proxy base path is supported. Passwords, tokens and fragments are rejected; only supported player-link parameters are accepted and removed when saving the server address. Keep camera credentials in Frigate/go2rtc's private configuration. The built-in Home Assistant connection uses the existing server-side HA token.

Connections can be renamed or edited. A connection used by a camera's live video, startup preview or person image cannot be deleted until those sources are changed. Removing an unused connection does not change the upstream server.

## Add a camera

1. Choose **Add camera** under **Smart home → Cameras** or **Home settings → Cameras**.
2. Enter a **Camera name**. This is the name shown in Home Harmony and its notification camera picker.
3. Choose a **Connection**.
4. For **Home Assistant**, select a **Home Assistant camera**. For **go2rtc**, choose a **Stream** from the selected server's list. **Refresh streams** reloads the list. If discovery is unavailable, **Enter stream manually** accepts a `stream.html` or `webrtc.html` link, a stream name, or an RTSP restream address such as `rtsp://frigate.example:8554/example_camera`. Only `example_camera` is saved; the selected connection determines the server. A player link for another server is rejected until its matching connection is selected. **Open in go2rtc (new tab)** opens the selected source in the upstream player for comparison.
5. Under **Preview while video connects**, select **Frigate latest image** for a fast preview from Frigate's API. Choose the saved **Frigate preview connection** and enter the **Frigate preview camera** name. This is Frigate's camera name, which can differ from the go2rtc stream name. **Use the video connection** keeps the existing go2rtc or HA snapshot source. The preview choice applies to this camera everywhere, including live camera notifications.
6. Optionally open **Person image (optional)** and choose its source independently.
7. Press **Save camera**, or **Save and test camera** to save and open its live video.

If saving fails, the error identifies the field to correct and keeps your draft. **Frigate latest image** requires both a Frigate connection and a Frigate camera name, independently of the person image. Fill those preview fields or select **Use the video connection**; selecting a valid `camera.*` person image does not complete the startup preview.

Saved cameras group **Preview startup image**, **Watch live stream**, and **Preview person snapshot** (when configured). The startup preview refreshes the same image source used while video connects, without starting video. **Edit** and **Delete** sit beside the camera name.

On **Smart home → Cameras**, each camera offers **Live camera**, **Still image**, and **Person snapshot** when a person source is configured. The still view refreshes the configured startup image from Frigate or the video connection without opening a live stream. Each camera keeps its own selection. Expand any view to see the same selected media in the larger viewer; switching views stops the previous live stream or still-image polling.

The go2rtc list uses the [go2rtc stream API](https://github.com/AlexxIT/go2rtc/blob/master/website/api/openapi.yaml). Home Harmony returns stream names only; upstream producer URLs and credentials are not sent to the browser. A failed or empty list does not erase the selected source.

## Watch cameras and use them in notifications

**Smart home → Cameras** shows only cameras you have added. Each has **Configure camera** and **Use in notification**. The latter starts a camera notification with that camera selected; choose the trigger under **When to show it** before saving.

In **Home settings → Notifications → Camera popup → Camera and image**, **Camera** lists your configured cameras, regardless of connection. **Show in notification** offers that camera's live source and its **Person snapshot**, when configured. **Test camera output** previews the choice. **Configure camera (new tab)** keeps the notification draft open while editing the camera. Changing a camera's connection or source applies wherever that camera is used.

Camera deletion requires confirmation and is blocked while a notification references it. Delete or reassign those rules first. Removing a camera from Home Harmony leaves its connection, Home Assistant entity and physical camera unchanged.

## Live playback

Camera status appears as an icon in the top-left corner across cards, expanded viewers, notifications and settings previews: connecting, live video, preview image or unavailable video. Tap or focus and activate the icon to read its explanation; hover and screen-reader labels provide the same text. Status text no longer covers the camera image. Loading and error messages remain visible when no image is available.

Video stays above the last decoded snapshot. Playback fades in over 240 ms when video frames arrive. Browser buffering events alone never hide established video or restart image requests: the player waits for three seconds without a new video frame before fading back to snapshots. Browsers without video-frame callbacks use advancing playback time instead. A new frame restores video even without another `playing` event, and manually paused video retains its frame. Reduced motion shortens the fade to 160 ms. The snapshot remains in memory until the viewer closes or its source changes.

Camera views and live camera notifications request a current snapshot immediately while video connects. The preview refreshes up to twice per second, keeps the previous image until its replacement is decoded, and switches to video on playback. Requests never overlap; slow cameras determine the actual refresh rate, and failed snapshots retry after two seconds without interrupting video. Polling stops when video plays, the viewer closes, or the camera view is hidden, and resumes if video stalls. Home Assistant cameras use their camera snapshot; go2rtc cameras use a 640-pixel-wide JPEG from the configured live stream, independently of optional person images. Live-video startup previews are not prefetched, so their first image still depends on camera/server response time. Person images use the separate page cache described below. go2rtc's [snapshot endpoint](https://github.com/AlexxIT/go2rtc/blob/master/internal/mjpeg/README.md#jpeg) may need FFmpeg on the go2rtc server to convert an H.264/H.265 frame to JPEG.

When a Frigate preview is configured, Home Harmony instead requests `/api/<frigate-camera>/latest.jpg` through the authenticated dashboard proxy. This uses Frigate's latest frame and avoids go2rtc's on-demand JPEG conversion. The configured Frigate camera name is used exactly; Home Harmony never derives it by removing suffixes from a go2rtc stream name. Older settings and backups keep their existing snapshot source until a Frigate preview is selected. Preview failures do not stop the live video from connecting.

Browsers do not play RTSP directly. Home Harmony first exchanges receive-only SDP with the selected go2rtc server; the browser receives WebRTC media from it. This direct WebRTC path needs access to the server's configured WebRTC candidates, normally TCP/UDP port 8555. HTTP signaling alone does not relay video; if direct WebRTC cannot connect, the HTTP MSE fallback below can still play the stream. H.264 offers broad browser compatibility. See [Frigate restreaming](https://docs.frigate.video/configuration/restream/) and [WebRTC setup](https://docs.frigate.video/configuration/live/#webrtc-extra-configuration).

For the Frigate Home Assistant app, the go2rtc API port may need enabling in its network settings; see [Frigate port access](https://docs.frigate.video/troubleshooting/go2rtc/#home-assistant-and-port-access). Keep the API on a trusted network. When WebRTC fails, Home Harmony tries MSE using the same stream through an authenticated HTTP fMP4 relay. This avoids requiring a direct WebRTC media connection from the browser and carries the upstream codecs without transcoding. It prefers ManagedMediaSource when available, otherwise MediaSource, and requires compatible source codecs. Startup/stall timeouts, old-buffer pruning and cancellation on close bound the player. If both transports fail, a specific error, Retry and **Open in go2rtc (new tab)** are shown. It does not switch to an unrelated HA camera. Cameras using Home Assistant retain its WebRTC/HLS player, MJPEG and labeled still-image fallbacks. Inline previews pause offscreen; live viewers pause in background tabs and stop on close.

## Person images

The person image has its own source and is viewed as a separate still image. Changing it does not change the live stream or its startup preview, and a failed person image does not fall back to live video or its preview.

- **Person image from Home Assistant:** choose Frigate's `image.example_camera_person`. Older `camera.*` snapshot entities also work. A `sensor.*` or `binary_sensor.*` works only when its `entity_picture` refers to HA's `image_proxy` or `camera_proxy`. The picker filters out unsupported entities; previously saved missing or unsupported sources stay visible for replacement. A person occupancy/count sensor without a picture is a notification trigger, not an image source. See the [Frigate integration](https://github.com/blakeblackshear/frigate-hass-integration).
- **Person image directly from Frigate:** select a **Frigate connection** and enter its **Frigate camera name**. Home Harmony requests `/api/<camera>/person/snapshot.jpg`. Enable person tracking and snapshots in Frigate. The camera name can differ from the go2rtc stream name.

Save the camera, then use **Preview person snapshot**. Expanded live viewers show the latest person image in a picture-in-picture inset when configured, including camera notification popups. Tap the inset for its status and Retry if loading failed; the image may predate the alert. Expanded camera viewers also retain the separate person-image view. Camera frames and images fit within their views without cropping, including portrait and 4:3 sources. Images use dashboard authentication; HA credentials are attached server-side only for HA requests, and redirects are refused. Images are not stored in settings or backups; responses use `no-store`.

Under **Person image (optional)**, choose **Person inset size**: Small, Medium, Large, or Extra large. Medium preserves the original size. The saved choice applies to this camera's fullscreen previews and notification-card insets, adapts to the available space, and keeps the full person image visible. It syncs across screens and travels with configuration backups.

The separate person-image view uses the same frame as live video and still images, keeping the card height stable when switching views. Its top-left status icon opens the image explanation and any retry action without adding a caption below the image. Loading and initial errors remain visible when no image is available.

Configured person images are fetched and decoded when the page's saved settings load, before any camera viewer opens. One decoded image per camera stays in page memory and is shared by settings previews, notification cards and expanded viewers, including after those viewers close. The first page load still waits for the source to respond; later views can show the cached image immediately. Images are not persisted to disk, settings or backups.

Home Assistant WebSocket entity updates refresh this cache even when no viewer is open. Picture sensors also follow updates to their referenced image/camera entity. Updates during a slow request are combined into one follow-up request; downloads never overlap for a camera. The previous image stays visible until its replacement is decoded, and failed refreshes retain it with an explanation and Retry. Requests and decoding time out after 15 seconds.

Direct Frigate sources have no associated HA entity, so their cache refreshes every five seconds while the tab is visible. Visible HA person-image viewers and failed loads also use five-second refresh checks to catch late snapshots. Background polling pauses in hidden tabs, and returning to the tab refreshes the cache. Source changes, camera removal, authentication errors and closing the page discard the affected images and cancel pending work. Person images remain the latest available snapshot, not an event-bound capture, and may predate an alert; the viewer labels this.

## Existing settings

Settings remain shared and included in version 3 backups. Previous explicit camera overrides become named camera entries and reusable connections. Existing camera notification selections become entries too. Other discovered HA cameras are not imported. Camera names from older settings initially use their saved entity ID and can be renamed. Existing HA device cards continue to show their HA entities; the configured camera collection is managed separately.

Automated tests and synthetic UI fixtures verify configuration, discovery, routing and interaction. Live go2rtc playback was verified in the local frontend at 2560 × 1440, with video ready state 4 and advancing playback time. This establishes playback for the tested setup; Home Assistant live playback and HA/Frigate person snapshots still require installation testing. The popup redesign, recordings and event-specific snapshots remain outside this change.
