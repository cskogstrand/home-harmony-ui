import { createContext } from "react";
import type { CardDensity } from "../../../shared/configuration";

export const cardVariants = { original: "Original", compact: "Compact", supercompact: "Super compact" } as const satisfies Record<CardDensity, string>;
export type CardVariant = typeof cardVariants[CardDensity];
export const CardDisabled = createContext(false);
export const CardPresentation = createContext<{ variant: CardVariant; visible: boolean; title: string }>({ variant: "Original", visible: true, title: "" });
