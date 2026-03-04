import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Lightbulb, Thermometer, Lock, Radio, Plug, Zap, CheckCircle2, Loader2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

type PairingStep = "select" | "scanning" | "found" | "pairing" | "success" | "error";

const deviceCategories = [
  { type: "light", label: "Light", icon: Lightbulb },
  { type: "thermostat", label: "Thermostat", icon: Thermometer },
  { type: "doorLock", label: "Door Lock", icon: Lock },
  { type: "sensor", label: "Sensor", icon: Radio },
  { type: "plug", label: "Smart Plug", icon: Plug },
  { type: "evCharger", label: "EV Charger", icon: Zap },
];

interface AddDeviceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddDeviceModal({ open, onOpenChange }: AddDeviceModalProps) {
  const [step, setStep] = useState<PairingStep>("select");
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const reset = () => { setStep("select"); setSelectedType(null); setProgress(0); };

  const startScan = (type: string) => {
    setSelectedType(type);
    setStep("scanning");
    setProgress(0);
    // Simulate scanning
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) { clearInterval(interval); setStep("found"); return 100; }
        return p + 20;
      });
    }, 600);
  };

  const startPairing = () => {
    setStep("pairing");
    setProgress(0);
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) { clearInterval(interval); setStep("success"); return 100; }
        return p + 25;
      });
    }, 500);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === "select" && "Add Device"}
            {step === "scanning" && "Scanning…"}
            {step === "found" && "Device Found"}
            {step === "pairing" && "Pairing…"}
            {step === "success" && "Device Added!"}
            {step === "error" && "Pairing Failed"}
          </DialogTitle>
          <DialogDescription>
            {step === "select" && "Choose the type of device to pair."}
            {step === "scanning" && "Put your device in pairing mode and wait…"}
            {step === "found" && `Found a new ${selectedType} nearby.`}
            {step === "pairing" && "Configuring your device…"}
            {step === "success" && "Your device is ready to use."}
            {step === "error" && "Something went wrong. Please try again."}
          </DialogDescription>
        </DialogHeader>

        {step === "select" && (
          <div className="grid grid-cols-3 gap-3 py-4">
            {deviceCategories.map(cat => (
              <button key={cat.type}
                className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border hover:border-primary hover:bg-accent transition-colors touch-target"
                onClick={() => startScan(cat.type)}>
                <cat.icon className="h-6 w-6 text-primary" />
                <span className="text-sm font-medium">{cat.label}</span>
              </button>
            ))}
          </div>
        )}

        {(step === "scanning" || step === "pairing") && (
          <div className="py-8 flex flex-col items-center gap-4">
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
            <Progress value={progress} className="w-48" />
            <p className="text-sm text-muted-foreground">{progress}%</p>
          </div>
        )}

        {step === "found" && (
          <div className="py-6 flex flex-col items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              {deviceCategories.find(c => c.type === selectedType)?.icon && 
                (() => { const I = deviceCategories.find(c => c.type === selectedType)!.icon; return <I className="h-8 w-8 text-primary" />; })()
              }
            </div>
            <div className="text-center">
              <p className="font-semibold">Mock {selectedType} Device</p>
              <p className="text-sm text-muted-foreground">Model: DEMO-001 • Vendor: Mock Inc.</p>
            </div>
          </div>
        )}

        {step === "success" && (
          <div className="py-6 flex flex-col items-center gap-3">
            <CheckCircle2 className="h-12 w-12 text-success" />
            <p className="text-sm text-muted-foreground">You can now control this device from your dashboard.</p>
          </div>
        )}

        {step === "error" && (
          <div className="py-6 flex flex-col items-center gap-3">
            <AlertTriangle className="h-12 w-12 text-destructive" />
            <p className="text-sm text-muted-foreground">The device did not respond. Check it's in pairing mode.</p>
          </div>
        )}

        <DialogFooter>
          {step === "found" && <Button onClick={startPairing}>Pair Device</Button>}
          {step === "success" && <Button onClick={() => onOpenChange(false)}>Done</Button>}
          {step === "error" && <Button variant="outline" onClick={reset}>Try Again</Button>}
          {step === "scanning" && <Button variant="ghost" onClick={reset}>Cancel</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
