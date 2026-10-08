import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

interface PinPadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onSubmit: (code?: string) => Promise<void>;
  codeRequired?: boolean;
  numeric?: boolean;
  disabled?: boolean;
}
export function PinPadModal({ open, onOpenChange, title, description, onSubmit, codeRequired = false, numeric = false, disabled = false }: PinPadModalProps) {
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { if (!open) { setCode(""); setError(""); } }, [open]);
  return <Dialog open={open} onOpenChange={value => { if (!pending) onOpenChange(value); }}><DialogContent className="sm:max-w-[360px]">
    <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
    <form className="space-y-4" onSubmit={async event => {
      event.preventDefault();
      if (disabled || pending) return;
      const entered = code;
      setCode(""); setError(""); setPending(true);
      try { await onSubmit(entered || undefined); onOpenChange(false); }
      catch { setError("Home Assistant did not confirm the request. Check the code, permissions and reported state."); }
      finally { setPending(false); }
    }}>
      {codeRequired && <label className="block space-y-2"><span>Code</span><Input aria-label="Code" type="password" autoComplete="off" inputMode={numeric ? "numeric" : "text"} required disabled={pending || disabled} value={code} onChange={event => setCode(event.target.value)} /></label>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="relative" aria-label="Confirm" aria-busy={pending} disabled={disabled || pending || (codeRequired && !code)}><span className={pending ? "invisible" : undefined}>Confirm</span>{pending && <Loader2 className="absolute h-4 w-4 animate-spin" aria-hidden="true" />}</Button>
      <Button type="button" variant="ghost" autoFocus={!codeRequired} disabled={pending} onClick={() => onOpenChange(false)}>Cancel</Button>
    </form>
  </DialogContent></Dialog>;
}
