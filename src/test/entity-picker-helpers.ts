import { fireEvent, screen, within } from "@testing-library/react";

export function chooseEntity(trigger: string | HTMLElement, entityId: string) {
  const button = typeof trigger === "string" ? screen.getByRole("button", { name: trigger }) : trigger;
  fireEvent.click(button);
  const picker = within(screen.getByRole("dialog", { name: button.getAttribute("aria-label") }));
  fireEvent.change(picker.getByRole("searchbox", { name: "Search devices and entities" }), { target: { value: entityId } });
  fireEvent.click(picker.getByRole("button", { name: name => name.endsWith(` · ${entityId}`) }));
}
