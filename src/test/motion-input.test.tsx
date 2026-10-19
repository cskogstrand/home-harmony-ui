import { expect, it } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { createPortal } from "react-dom";
import { useMotionInput } from "@/hooks/use-motion-input";

it("tracks pointer and keyboard actions before portal handlers, then removes listeners", () => {
  const observed: (string | undefined)[] = [];
  function Fixture() {
    useMotionInput();
    return createPortal(<button onPointerDown={event => {
      event.stopPropagation();
      observed.push(document.documentElement.dataset.motionInput);
    }} onKeyDown={event => {
      event.stopPropagation();
      observed.push(document.documentElement.dataset.motionInput);
    }}>Action</button>, document.body);
  }
  const view = render(<Fixture />);
  const button = view.getByRole("button", { name: "Action" });
  fireEvent.pointerDown(button, { pointerType: "touch" });
  fireEvent.keyDown(button, { key: "Enter" });
  fireEvent.pointerDown(button, { pointerType: "mouse" });
  expect(observed).toEqual(["pointer", "keyboard", "pointer"]);
  view.unmount();
  fireEvent.pointerDown(document.body);
  fireEvent.keyDown(document.body, { key: "Tab" });
  expect(document.documentElement.dataset.motionInput).toBeUndefined();
});
