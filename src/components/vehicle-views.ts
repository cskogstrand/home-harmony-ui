import { Armchair, BatteryCharging, CarFront, CircleDot, Cpu, LockKeyhole, Route } from "lucide-react";

export const vehicleViews = {
  Overview: { label: "Overview", icon: CarFront },
  "Battery & charging": { label: "Charging", icon: BatteryCharging },
  "Cabin & seats": { label: "Cabin", icon: Armchair },
  "Doors & security": { label: "Access", icon: LockKeyhole },
  "Trip & position": { label: "Trip", icon: Route },
  "Tyre pressure": { label: "Tyres", icon: CircleDot },
  "Vehicle & service": { label: "Service", icon: Cpu },
} as const;
