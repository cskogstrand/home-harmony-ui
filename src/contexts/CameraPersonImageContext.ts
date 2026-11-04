import { createContext, useContext, useEffect } from "react";

export type CameraPersonImage = { src: string; failed: boolean; refresh: () => void; watch: () => () => void };
export const CameraPersonImageContext = createContext<Partial<Record<string, CameraPersonImage>>>({});

export function useCameraPersonImage(cameraId: string) {
  const image = useContext(CameraPersonImageContext)[cameraId];
  const watch = image?.watch;
  useEffect(() => watch?.(), [watch]);
  return image;
}
