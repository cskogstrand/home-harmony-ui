# 07 · Ask the house (Assist)

[← Master plan](README.md) · Depends on [04](04-admin-to-settings.md) (Settings structure) and [05](05-ha-language-and-numbers.md) (language plumbing)

**Goal:** a calm "Ask the house" entry on the wall and phone that sends a sentence to Home Assistant Assist and shows (and optionally speaks) the answer. Text first; voice second.

**Why:** the connected Home Assistant has conversation agents, speech-to-text and text-to-speech engines configured, but the app only shows a decorative "Voice & Assist" card.

## Protocol notes (verify against current HA developer docs before coding)

- Text: WebSocket `conversation/process` with `{ text, language, agent_id?, conversation_id? }`. Response: `response.speech.plain.speech`, `response.response_type` (`action_done`, `query_answer`, `error`), `conversation_id` for follow-ups.
- Agents: `conversation/agent/list` (with `language`); pipelines: `assist_pipeline/pipeline/list`.
- Voice: `assist_pipeline/run` with `start_stage: "stt"`, `end_stage: "tts"`, `input: { sample_rate: 16000 }`. Audio is sent as **binary** WebSocket frames prefixed with the `stt_binary_handler_id` byte from the `run-start` event; an empty frame ends the stream. Events: `stt-end`, `intent-end`, `tts-end` (`tts_output.url`).
- **Proxy blocker:** `server/home-assistant.mjs` (~56–60) closes the browser socket on any binary frame. Voice requires allowing binary frames only after both sides are authenticated, with a size cap, and forwarding them unchanged.
- **Microphone needs a secure context** (HTTPS or `localhost`). See the open question in the master plan.
- TTS audio URL is `/api/tts_proxy/...` on Home Assistant; `server/app.mjs` (~147–195) only proxies an allow-list of HA paths, so add a narrow `GET /api/tts_proxy/<token>.<ext>` pass-through.
- Assist can control any entity the owner exposed to Assist in Home Assistant. The app must not widen that; document that exposure is managed in HA.

## Phase A — text

- [x] Client: add `assist(text, { agentId, conversationId, language })` to `HomeAssistantClient` in `src/lib/home-assistant.ts` using `sendMessagePromise`, with the existing `bounded` timeout and error mapping.
- [x] Shared setting (Settings → Screen and alerts, new item "Assist"): enable/disable, agent (from `conversation/agent/list`), whether answers are spoken. Default: disabled until chosen. Store in shared configuration like other screen settings.
  > Note: stored as `assist: { enabled, agentId }`; an empty agent is Home Assistant's built-in agent (what `conversation/process` uses without `agent_id`), so the built-in agent is not listed twice. The "answers are spoken" switch moved to phase B (see "Run the pipeline…"): without the TTS proxy there is nothing to play, and a switch that does nothing would mislead.
- [x] UI: an "Ask the house" button in the header actions (only when enabled) opening a dialog: input, send, conversation transcript for this session, clear. Generous touch targets; works with the on-screen keyboard; Escape closes and returns focus.
  > Note: the button leads the header actions. With it, phones up to 449 px move the vehicle chip to the second header row, and phones below 380 px use 44 px header targets so six controls fit. Proven with tests and fictional fixtures only; the dev server serves `main`, so the layout at 1440 × 2560 and 390 × 844 (light, dark, artwork, on-screen keyboard) still needs a browser check in workstream 13.
- [x] Show `action_done` answers with a subtle confirmation; `error` responses in plain language with retry; keep the typed text on failure.
- [x] Offline/HA disconnected: button disabled with reason.
- [x] Tests (mock connection): request shape, follow-up keeps `conversation_id`, error keeps draft, disabled when offline.
- [x] Docs: README (feature), DOCS.md (enable Assist, exposure is managed in HA), PRODUCT.md capability line; i18n en/nb.

## Phase B — voice (only after the owner confirms a secure context)

> Blocked (all of phase B): the open question in the master plan, whether the wall browser is served over HTTPS (a secure context for the microphone), is not answered. Phase B starts only after the owner confirms it. The proxy boxes do not need the microphone themselves, but they only serve voice, so they wait too rather than widen the WebSocket proxy for nothing.

- [ ] Proxy: allow binary frames after auth, cap frame size (for example 64 KiB) and total stream duration; server tests in `server/connection.test.mjs` or a new test proving text-only clients are unaffected and pre-auth binary still closes the socket.
  > Blocked: waits for the secure-context answer (see above).
- [ ] Proxy `GET /api/tts_proxy/*` with the same auth and header hygiene as other HA proxies; server test.
  > Blocked: waits for the secure-context answer (see above).
- [ ] Browser capture: `getUserMedia` + `AudioWorklet` downsampling to 16 kHz mono 16-bit PCM; push-to-talk (hold or tap-to-start/tap-to-stop); visible listening state; automatic stop after silence/timeout.
  > Blocked: the microphone needs a secure context; open question to the owner.
- [ ] Run the pipeline, show the recognised text (`stt-end`), then the answer; play TTS when the setting allows. Add the "Speak answers" switch to Settings → Assist (`assist.speak`, default off) here.
  > Blocked: depends on the capture and TTS proxy boxes above.
- [ ] Graceful fallback: no secure context or no permission → voice button hidden or explained, text still works.
  > Blocked: part of voice; text already works without it.
- [ ] Tests for the PCM framing helper and event handling; manual check on the wall browser by the owner (note result here).
  > Blocked: follows the voice boxes above.

## Acceptance

- Phase A: typing "Hvilke lys er på?" returns HA's answer in the dialog in Bokmål; failures keep the text.
  > Handoff: proven with a fake connection and fictional answers (`src/test/assist.test.tsx`, `src/test/assist-ui.test.tsx`). No Assist request was sent to the real Home Assistant, because a sentence can control devices. Left for the owner or workstream 13: turn on Ask the house, ask "Hvilke lys er på?" once on the merged build, and check the header and dialog in the browser at 1440 × 2560 and 390 × 844 (light, dark, artwork on, phone keyboard open).
- Phase B: push-to-talk round trip works on a secure-context screen; non-secure screens still offer text.
