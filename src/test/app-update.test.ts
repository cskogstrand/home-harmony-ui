import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { appVersion, useAppUpdate } from "@/hooks/use-app-update";

const request = vi.fn();
const response = (version: unknown) => ({ ok: true, json: async () => ({ version }) });
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("PROD", true);
  vi.stubGlobal("fetch", request);
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  request.mockReset().mockResolvedValue(response(appVersion));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it("checks immediately and discovers a changed release without using cached responses", async () => {
  const { result } = renderHook(useAppUpdate);
  await act(async () => {});
  expect(result.current).toBeUndefined();
  expect(request).toHaveBeenCalledWith("/version.json", { cache: "no-store", signal: expect.any(AbortSignal) });
  request.mockResolvedValue(response("99.0.0"));
  await act(() => vi.advanceTimersByTimeAsync(60000));
  expect(result.current).toBe("99.0.0");
  request.mockResolvedValue(response(appVersion));
  await act(() => vi.advanceTimersByTimeAsync(60000));
  expect(result.current).toBeUndefined();
});

it("pauses while hidden and checks on wake, reconnection, or a page download failure", async () => {
  const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
  const { unmount } = renderHook(useAppUpdate);
  await act(() => vi.advanceTimersByTimeAsync(60000));
  expect(request).not.toHaveBeenCalled();
  hidden.mockReturnValue(false);
  await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
  expect(request).toHaveBeenCalledTimes(1);
  await act(async () => { window.dispatchEvent(new Event("online")); });
  expect(request).toHaveBeenCalledTimes(2);
  await act(async () => { window.dispatchEvent(new Event("vite:preloadError")); });
  expect(request).toHaveBeenCalledTimes(3);
  unmount();
  document.dispatchEvent(new Event("visibilitychange"));
  window.dispatchEvent(new Event("online"));
  window.dispatchEvent(new Event("vite:preloadError"));
  await act(() => vi.advanceTimersByTimeAsync(60000));
  expect(request).toHaveBeenCalledTimes(3);
});

it("ignores offline, failed, and malformed checks without losing a known update", async () => {
  request.mockRejectedValueOnce(new TypeError("offline"));
  const { result } = renderHook(useAppUpdate);
  await act(async () => {});
  expect(result.current).toBeUndefined();
  request.mockResolvedValueOnce(response("99.0.0"));
  await act(() => vi.advanceTimersByTimeAsync(60000));
  expect(result.current).toBe("99.0.0");
  for (const next of [new Error("offline"), { ok: false }, { ok: true, json: async () => { throw new SyntaxError("HTML response"); } }, response(null), response("not a version")]) {
    if (next instanceof Error) request.mockRejectedValueOnce(next); else request.mockResolvedValueOnce(next);
    await act(() => vi.advanceTimersByTimeAsync(60000));
    expect(result.current).toBe("99.0.0");
  }
});

it("bounds slow checks, prevents overlapping requests, and aborts on unmount", async () => {
  request.mockImplementationOnce((_, { signal }) => new Promise((_, reject) => {
    signal.addEventListener("abort", () => reject(new Error("aborted")));
  }));
  const { unmount } = renderHook(useAppUpdate);
  window.dispatchEvent(new Event("online"));
  expect(request).toHaveBeenCalledTimes(1);
  const signal = request.mock.calls[0][1].signal;
  await act(() => vi.advanceTimersByTimeAsync(10000));
  expect(signal.aborted).toBe(true);
  await act(() => vi.advanceTimersByTimeAsync(50000));
  expect(request).toHaveBeenCalledTimes(2);
  request.mockImplementationOnce(() => new Promise(() => {}));
  window.dispatchEvent(new Event("online"));
  const pending = request.mock.calls[2][1].signal;
  unmount();
  expect(pending.aborted).toBe(true);
});

it("leaves development updates to Vite", async () => {
  vi.stubEnv("PROD", false);
  renderHook(useAppUpdate);
  await act(() => vi.advanceTimersByTimeAsync(60000));
  expect(request).not.toHaveBeenCalled();
});
