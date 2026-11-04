import { createContext } from "react";
import type { CameraImage } from "./CameraPersonImageContext";

export const CameraPreviewImageContext = createContext<Partial<Record<string, CameraImage>>>({});
