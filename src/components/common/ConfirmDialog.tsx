import type { Message } from "@/lib/i18n";
import { useI18n } from "@/hooks/use-i18n";
import { useRef, useState } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: Message;
  description: Message;
  confirmLabel?: Message;
  cancelLabel?: Message;
  pendingLabel?: Message;
  disabled?: boolean;
  destructive?: boolean;
  onConfirm: () => void | boolean | Promise<void | boolean>;
}

export function ConfirmDialog({
  open, onOpenChange, title, description,
  confirmLabel = "Confirm", cancelLabel = "Cancel", pendingLabel = "Working…", disabled = false, destructive = false, onConfirm,
}: ConfirmDialogProps) {
  const { message } = useI18n();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const returnFocus = useRef<HTMLElement | null>(null);
  return (
    <AlertDialog open={open} onOpenChange={value => { if (!inFlight.current) { setError(""); onOpenChange(value); } }}>
      <AlertDialogContent aria-busy={pending}
        onOpenAutoFocus={() => { returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; }}
        onCloseAutoFocus={event => { event.preventDefault(); returnFocus.current?.focus(); }}>
        <AlertDialogHeader>
          <AlertDialogTitle>{message(title)}</AlertDialogTitle>
          <AlertDialogDescription>{message(description)}</AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p role="alert" className="text-sm text-destructive">{message(error)}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{message(cancelLabel)}</AlertDialogCancel>
          <AlertDialogAction
            disabled={disabled || pending}
            onClick={async event => {
              event.preventDefault();
              if (disabled || inFlight.current) return;
              inFlight.current = true;
              setPending(true); setError("");
              try { if (await onConfirm() !== false) onOpenChange(false); }
              catch (error) { setError(error instanceof Error ? error.message : "The action could not be completed. Try again."); }
              finally { inFlight.current = false; setPending(false); }
            }}
            className={destructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
          >
            {message(pending ? pendingLabel : confirmLabel)}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
