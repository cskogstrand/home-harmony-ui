import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CameraPersonSnapshot } from "@/components/CameraPersonSnapshot";
import { emptyConfiguration } from "../../shared/configuration";
import { cameraSettings } from "./camera-fixtures";

const mocks = vi.hoisted(() => ({ shared: null, reducedMotion: false }));
vi.mock("@/contexts/SharedConfigurationContext", () => ({ useSharedConfiguration: () => mocks.shared }));
vi.mock("@/contexts/CameraPersonImageContext", () => ({ useCameraPersonImage: () => ({ src: "blob:person", width: 640, height: 360 }) }));
vi.mock("framer-motion", async importOriginal => ({ ...await importOriginal<typeof import("framer-motion")>(), useReducedMotion: () => mocks.reducedMotion }));

beforeEach(() => {
  const config = emptyConfiguration(); config.settings.cameras = cameraSettings();
  mocks.shared = { state: { config } }; mocks.reducedMotion = false;
  vi.stubGlobal("PointerEvent", class extends MouseEvent {
    pointerId: number;
    constructor(type: string, init: PointerEventInit) { super(type, init); this.pointerId = init.pointerId ?? 1; }
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function viewer(lift = 0) {
  const view = render(<div className="smart-camera-image-bounds"><CameraPersonSnapshot cameraId="example-camera" overlay /></div>);
  const button = screen.getByRole("button", { name: "Latest person snapshot" });
  const position = button.parentElement, frame = position.parentElement;
  const box = (x: number, y: number, width: number, height: number): DOMRect => ({ x, y, width, height, left: x, top: y, right: x + width, bottom: y + height, toJSON: () => ({}) });
  vi.spyOn(frame, "getBoundingClientRect").mockImplementation(() => box(100, 100, 640, 360));
  Object.defineProperties(position, {
    offsetLeft: { get: () => position.dataset.edge === "left" ? -142 : position.dataset.edge === "right" ? 628 : position.dataset.corner.endsWith("left") ? 8 : 478 },
    offsetTop: { get: () => position.dataset.corner.startsWith("top") ? 8 : 266 },
  });
  vi.spyOn(position, "getBoundingClientRect").mockImplementation(() => {
    const offset = position.style.transform.match(/translate\(([-.\d]+)px, ([-.\d]+)px\)/);
    const clearance = position.dataset.corner.startsWith("bottom") && position.style.translate !== "none" ? lift : 0;
    return box(100 + position.offsetLeft + Number(offset?.[1] ?? 0), 100 + position.offsetTop - clearance + Number(offset?.[2] ?? 0), 154, 86);
  });
  let captured = false;
  button.setPointerCapture = vi.fn(() => { captured = true; });
  button.hasPointerCapture = vi.fn(() => captured);
  button.releasePointerCapture = vi.fn(() => { captured = false; });
  return { ...view, button, position };
}
function swipe(button: HTMLElement, x: number, y: number, end = "pointerUp") {
  fireEvent.pointerDown(button, { button: 0, pointerId: 1, clientX: 650, clientY: 150 });
  fireEvent.pointerMove(button, { pointerId: 1, clientX: x, clientY: y });
  fireEvent[end](button, { pointerId: 1, clientX: x, clientY: y });
}

it.each([[180, 150, "top-left"], [180, 400, "bottom-left"], [650, 400, "bottom-right"], [600, 180, "top-right"]])("snaps a drag to the nearest corner (%s, %s)", (x, y, corner) => {
  const { button } = viewer();
  swipe(button, Number(x), Number(y));
  expect(button).toHaveAttribute("data-corner", corner);
  expect(button.setPointerCapture).toHaveBeenCalledWith(1);
  expect(button.releasePointerCapture).toHaveBeenCalledWith(1);
  fireEvent.click(button, { detail: 1 });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Show person snapshot" })).not.toBeInTheDocument();
});

it.each([[760, 150, "right"], [80, 150, "left"], [650, 70, "right"], [650, 480, "right"]] as const)("tucks beyond each video edge and restores the same image (%s, %s)", (x, y, edge) => {
  const { button, position } = viewer();
  const image = screen.getByRole("img");
  swipe(button, x, y);
  expect(screen.queryByRole("button", { name: "Latest person snapshot" })).not.toBeInTheDocument();
  const restore = screen.getByRole("button", { name: "Show person snapshot" });
  expect(position).toHaveAttribute("data-edge", edge);
  expect(position).toHaveStyle({ opacity: "1" });
  expect(restore.parentElement).toBe(position);
  expect(restore).toHaveFocus();
  expect(restore).toHaveClass("glass-surface");
  fireEvent.click(restore);
  expect(button).toHaveFocus();
  expect(button).not.toBeDisabled();
  expect(screen.getByRole("img")).toBe(image);
  expect(screen.queryByRole("button", { name: "Show person snapshot" })).not.toBeInTheDocument();
});

it.each(["pointerCancel", "lostPointerCapture"])("returns to the original corner after %s, even outside the frame", end => {
  const { button } = viewer();
  swipe(button, 80, 480, end);
  expect(button).toHaveAttribute("data-corner", "top-right");
  expect(button).not.toBeDisabled();
  expect(screen.queryByRole("button", { name: "Show person snapshot" })).not.toBeInTheDocument();
});

it("keeps taps working and offers all actions without dragging", () => {
  const { button } = viewer();
  swipe(button, 652, 151);
  fireEvent.click(button, { detail: 1 });
  expect(screen.getByRole("dialog")).toHaveTextContent("may predate this alert");
  fireEvent.click(screen.getByRole("button", { name: "Bottom left" }));
  expect(button).toHaveAttribute("data-corner", "bottom-left");
  expect(button).toHaveFocus();
  fireEvent.click(button);
  expect(screen.getByRole("button", { name: "Bottom left" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "Hide person snapshot" }));
  expect(screen.getByRole("button", { name: "Show person snapshot" })).toHaveFocus();
});

it("takes over a timeline lift without jumping and restores it after dragging", () => {
  const { button, position } = viewer(26);
  fireEvent.click(button);
  fireEvent.click(screen.getByRole("button", { name: "Bottom left" }));
  const before = position.getBoundingClientRect();
  fireEvent.pointerDown(button, { button: 0, pointerId: 1, clientX: 160, clientY: 380 });
  expect(position.getBoundingClientRect()).toMatchObject({ left: before.left, top: before.top, width: before.width, height: before.height });
  fireEvent.pointerMove(button, { pointerId: 1, clientX: 180, clientY: 405 });
  expect(position.getBoundingClientRect().left).toBe(before.left + 20);
  expect(position.getBoundingClientRect().top).toBe(before.top + 25);
  fireEvent.pointerCancel(button, { pointerId: 1, clientX: 180, clientY: 405 });
  expect(position.style.translate).toBe("");
  expect(position.style.transition).toBe("");
});

it("ignores secondary pointers and non-primary mouse buttons", () => {
  const { button } = viewer();
  fireEvent.pointerDown(button, { button: 2, pointerId: 1, clientX: 650, clientY: 150 });
  expect(button.setPointerCapture).not.toHaveBeenCalled();
  fireEvent.pointerDown(button, { button: 0, pointerId: 1, clientX: 650, clientY: 150 });
  fireEvent.pointerDown(button, { button: 0, pointerId: 2, clientX: 200, clientY: 400 });
  fireEvent.pointerMove(button, { pointerId: 2, clientX: 20, clientY: 600 });
  fireEvent.pointerUp(button, { pointerId: 2, clientX: 20, clientY: 600 });
  expect(button.setPointerCapture).toHaveBeenCalledTimes(1);
  expect(button.releasePointerCapture).not.toHaveBeenCalled();
  fireEvent.pointerMove(button, { pointerId: 1, clientX: 180, clientY: 400 });
  fireEvent.pointerUp(button, { pointerId: 1, clientX: 180, clientY: 400 });
  expect(button).toHaveAttribute("data-corner", "bottom-left");
});

it("keeps reduced-motion gestures functional and translates the restore action", () => {
  mocks.reducedMotion = true;
  const { button, position, rerender } = viewer();
  swipe(button, 760, 150);
  expect(position.style.transform).toBe("none");
  expect(position).toHaveAttribute("data-edge", "right");
  mocks.shared.state.config.settings.language = "nb";
  rerender(<div className="smart-camera-image-bounds"><CameraPersonSnapshot cameraId="example-camera" overlay /></div>);
  fireEvent.click(screen.getByRole("button", { name: "Vis personbilde" }), { detail: 1 });
  expect(button).toHaveStyle({ visibility: "visible" });
  expect(screen.getByRole("button", { name: "Siste personbilde" })).toHaveFocus();
});
