import { createContext, useContext, useEffect } from "react";

export type CameraImage = { src: string; width?: number; height?: number; failed: boolean; refresh: () => void; watch: () => () => void };
export const CameraPersonImageContext = createContext<Partial<Record<string, CameraImage>>>({});

export function useCameraPersonImage(cameraId: string) {
  const image = useContext(CameraPersonImageContext)[cameraId];
  const watch = image?.watch;
  useEffect(() => watch?.(), [watch]);
  return image;
}
