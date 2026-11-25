import { useCallback, useContext } from "react";
import { UNSAFE_DataRouterContext, useBeforeUnload, useBlocker, type BlockerFunction } from "react-router-dom";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import type { Message } from "@/lib/i18n";

interface UnsavedChangesGuardProps {
  /** True while there is a draft that leaving would lose; without one nothing asks. */
  dirty: boolean;
  title: Message;
  description: Message;
  /** Drops the draft once the owner chooses to discard it, before the navigation goes on. */
  onDiscard: () => void;
}

// Leaving means a new page or a new settings section (`?panel=`, `?group=`); a hash or state change stays put.
const leaves: BlockerFunction = ({ currentLocation, nextLocation }) => currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search;

/** Asks before in-app navigation drops a draft: Keep editing (the default) or Discard changes. Needs the app's data router. */
function NavigationGuard({ dirty, title, description, onDiscard }: UnsavedChangesGuardProps) {
  const blocker = useBlocker(useCallback<BlockerFunction>(args => dirty && leaves(args), [dirty]));
  return <ConfirmDialog open={blocker.state === "blocked"} title={title} description={description}
    cancelLabel="Keep editing" confirmLabel="Discard changes" destructive
    onOpenChange={open => { if (!open && blocker.state === "blocked") blocker.reset(); }}
    onConfirm={() => { onDiscard(); blocker.proceed?.(); }} />;
}

/**
 * Protects an unsaved draft: in-app links, the settings section menu and picker, and the browser's back button ask first
 * through the shared confirmation dialog; closing or reloading the tab gets the browser's own leave-page prompt.
 */
export function UnsavedChangesGuard(props: UnsavedChangesGuardProps) {
  const { dirty } = props;
  useBeforeUnload(useCallback((event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ""; } }, [dirty]));
  // Blocking needs a data router; a page rendered on its own (in a test or a plain router) keeps the tab prompt only.
  return useContext(UNSAFE_DataRouterContext) ? <NavigationGuard {...props} /> : null;
}
