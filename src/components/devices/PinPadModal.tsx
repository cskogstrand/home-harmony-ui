import { useState, useCallback } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Delete, Lock, Unlock } from "lucide-react";
import { cn } from "@/lib/utils";

interface PinPadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onSubmit: (pin: string) => void;
  variant?: "lock" | "unlock" | "alarm";
}

export function PinPadModal({ open, onOpenChange, title, description, onSubmit, variant = "lock" }: PinPadModalProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleDigit = useCallback((digit: string) => {
    setError(false);
    setPin(p => (p.length < 6 ? p + digit : p));
  }, []);

  const handleDelete = useCallback(() => {
    setPin(p => p.slice(0, -1));
    setError(false);
  }, []);

  const handleSubmit = useCallback(() => {
    if (pin.length < 4) return;
    setLoading(true);
    // Simulate verification — accept "1234" as valid PIN
    setTimeout(() => {
      if (pin === "1234") {
        onSubmit(pin);
        setPin("");
        setLoading(false);
        onOpenChange(false);
      } else {
        setError(true);
        setPin("");
        setLoading(false);
      }
    }, 800);
  }, [pin, onSubmit, onOpenChange]);

  const iconColor = variant === "unlock" ? "text-success" : variant === "lock" ? "text-primary" : "text-safety";

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setPin(""); setError(false); } onOpenChange(o); }}>
      <DialogContent className="sm:max-w-[340px]">
        <DialogHeader className="items-center">
          <div className={cn("h-12 w-12 rounded-full flex items-center justify-center mb-2", 
            variant === "unlock" ? "bg-success/10" : variant === "lock" ? "bg-primary/10" : "bg-safety/10"
          )}>
            {variant === "unlock" ? <Unlock className={cn("h-6 w-6", iconColor)} /> : <Lock className={cn("h-6 w-6", iconColor)} />}
          </div>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {/* PIN dots */}
        <div className="flex justify-center gap-3 my-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={cn(
              "h-3 w-3 rounded-full transition-all",
              i < pin.length ? (error ? "bg-destructive scale-110" : "bg-primary scale-110") : "bg-muted-foreground/20"
            )} />
          ))}
        </div>

        {error && (
          <p className="text-center text-sm text-destructive font-medium">Incorrect PIN. Try again.</p>
        )}

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-2 max-w-[240px] mx-auto">
          {["1","2","3","4","5","6","7","8","9"].map(d => (
            <Button key={d} variant="outline" size="lg" className="text-lg font-semibold h-14 touch-target"
              onClick={() => handleDigit(d)} disabled={loading}>
              {d}
            </Button>
          ))}
          <Button variant="ghost" size="lg" className="h-14 touch-target" onClick={handleDelete} disabled={loading}>
            <Delete className="h-5 w-5" />
          </Button>
          <Button variant="outline" size="lg" className="text-lg font-semibold h-14 touch-target"
            onClick={() => handleDigit("0")} disabled={loading}>0</Button>
          <Button size="lg" className="h-14 touch-target" onClick={handleSubmit}
            disabled={pin.length < 4 || loading}>
            {loading ? "…" : "OK"}
          </Button>
        </div>
        <p className="text-center text-2xs text-muted-foreground mt-2">Demo PIN: 1234</p>
      </DialogContent>
    </Dialog>
  );
}
