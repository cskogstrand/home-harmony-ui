import { useState } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";

afterEach(cleanup);

function Example({ remove, disabled = false }: { remove: () => Promise<void>; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  return <><button onClick={() => setOpen(true)}>Delete</button><ConfirmDialog open={open} onOpenChange={setOpen} title="Delete saved item?" description="This cannot be undone." confirmLabel="Delete item" pendingLabel="Deleting…" destructive disabled={disabled} onConfirm={remove} /></>;
}

it("focuses Cancel, restores focus after Escape, and never runs a disabled action", async () => {
  const remove = vi.fn(async () => {});
  const view = render(<Example remove={remove} />);
  const trigger = screen.getByRole("button", { name: "Delete" });
  trigger.focus();
  fireEvent.click(trigger);
  expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
  fireEvent.keyDown(screen.getByRole("alertdialog"), { key: "Escape" });
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  await waitFor(() => expect(trigger).toHaveFocus());
  fireEvent.click(screen.getByRole("button", { name: "Delete" }));
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(remove).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Delete" }));
  view.rerender(<Example remove={remove} disabled />);
  expect(screen.getByRole("button", { name: "Delete item" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Delete item" }));
  expect(remove).not.toHaveBeenCalled();
});

it("blocks duplicates and dismissal while pending, keeps errors visible, and closes after success", async () => {
  let reject: (reason: Error) => void;
  const remove = vi.fn().mockImplementationOnce(() => new Promise<void>((_resolve, fail) => { reject = fail; })).mockResolvedValue(undefined);
  render(<Example remove={remove} />);
  fireEvent.click(screen.getByRole("button", { name: "Delete" }));
  fireEvent.click(screen.getByRole("button", { name: "Delete item" }));
  expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Deleting…" }));
  fireEvent.keyDown(screen.getByRole("alertdialog"), { key: "Escape" });
  expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  expect(remove).toHaveBeenCalledOnce();
  await act(async () => reject(new Error("Deletion failed")));
  expect(screen.getByRole("alert")).toHaveTextContent("Deletion failed");
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Delete item" })));
  expect(remove).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
});
